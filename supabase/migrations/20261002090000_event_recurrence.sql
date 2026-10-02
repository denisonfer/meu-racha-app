-- Fatia 5c: fechamento automático e próximo Evento recorrente.
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.event_recurring_issue (
  racha_id uuid not null references public.racha (id) on delete cascade,
  source_event_id uuid not null,
  reason text not null check (reason = 'missing_place'),
  occurred_at timestamptz not null default now(),
  primary key (racha_id, source_event_id, reason)
);
revoke all on private.event_recurring_issue from public, anon, authenticated;
comment on table private.event_recurring_issue is
  'Corrigir o local do Racha e criar o próximo Evento manualmente para retomar a recorrência.';

-- A autoria de um encerramento automático pertence ao sistema, não ao Condutor.
alter table public.event add column ended_by_system boolean not null default false;
alter table public.event drop constraint event_status_shape;
alter table public.event add constraint event_status_shape check (
  (status = 'upcoming' and ended_at is null and ended_by is null and not ended_by_system)
  or (status = 'active' and conductor_id is not null and ended_at is null and ended_by is null and not ended_by_system)
  or (status = 'finished' and conductor_id is not null and ended_at is not null
    and ((ended_by is not null and not ended_by_system)
      or (ended_by is null and ended_by_system)))
);

-- Chamadores já detêm a trava do Racha; a função também a toma para manter
-- a serialização caso seja reutilizada por outra rotina interna.
create function private.create_next_recurring_event(
  p_racha_id uuid,
  p_source_event_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_as_of timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha public.racha%rowtype;
  v_after timestamptz;
  v_next_date date;
  v_next_id uuid;
begin
  select * into v_racha from public.racha r where r.id = p_racha_id for update;
  if not found or v_racha.weekday is null then
    return null;
  end if;

  if exists (
    select 1 from public.event e
    where e.racha_id = p_racha_id and e.status = 'upcoming'
  ) then
    return null;
  end if;

  if v_racha.place = 'A definir' then
    insert into private.event_recurring_issue (racha_id, source_event_id, reason)
    values (p_racha_id, p_source_event_id, 'missing_place')
    on conflict do nothing;
    return null;
  end if;

  v_after := greatest(
    (p_starts_on + p_starts_at) at time zone 'America/Sao_Paulo',
    p_as_of
  );
  v_next_date := (v_after at time zone 'America/Sao_Paulo')::date;
  v_next_date := v_next_date
    + ((v_racha.weekday - extract(isodow from v_next_date)::integer + 7) % 7);

  if (v_next_date + v_racha.kickoff_time) at time zone 'America/Sao_Paulo' <= v_after then
    v_next_date := v_next_date + 7;
  end if;

  insert into public.event (
    racha_id, starts_on, starts_at, place, is_paid, price, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    p_racha_id, v_next_date, v_racha.kickoff_time, v_racha.place,
    v_racha.is_paid, v_racha.price, v_racha.spot_limit,
    v_racha.reminder_lead_hours, v_racha.outfield_per_team, v_racha.game_mode,
    v_racha.max_consecutive_wins, v_racha.tie_rule, v_racha.tie_return_order,
    v_racha.consider_position, v_racha.match_duration_min
  ) returning id into v_next_id;

  return v_next_id;
end $$;

revoke execute on function private.create_next_recurring_event(uuid, uuid, date, time, timestamptz)
  from public, anon, authenticated;

create or replace function public.cancel_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.racha r where r.id = v_event.racha_id for update;
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false)
    or v_event.status is distinct from 'upcoming' then
    raise exception 'not_allowed';
  end if;

  delete from public.event e where e.id = p_event_id;
  perform private.create_next_recurring_event(
    v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, now()
  );
end $$;

create or replace function public.finish_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.event%rowtype;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.racha r where r.id = v_event.racha_id for update;
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  if v_event.status is distinct from 'active' or v_event.conductor_id is distinct from v_uid then
    raise exception 'not_allowed';
  end if;

  update public.event e set
    status = 'finished',
    ended_at = now(),
    ended_by = v_uid,
    ended_by_system = false
  where e.id = p_event_id;

  perform private.create_next_recurring_event(
    v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, now()
  );
end $$;

-- A varredura revalida status e prazo depois da trava do Racha. Chamadas
-- repetidas e corridas com ações manuais não fecham nem recriam duas vezes.
create function private.process_overdue_events(p_as_of timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_event public.event%rowtype;
begin
  for v_candidate in
    select e.id, e.racha_id
    from public.event e
    where e.status in ('upcoming', 'active')
      and ((e.starts_on + e.starts_at) at time zone 'America/Sao_Paulo')
        + interval '12 hours' <= p_as_of
    order by e.racha_id, e.starts_on, e.starts_at, e.id
    limit 500
  loop
    perform 1 from public.racha r where r.id = v_candidate.racha_id for update skip locked;
    if not found then
      continue;
    end if;

    select * into v_event from public.event e where e.id = v_candidate.id;
    if not found or v_event.status not in ('upcoming', 'active')
      or ((v_event.starts_on + v_event.starts_at) at time zone 'America/Sao_Paulo')
        + interval '12 hours' > p_as_of then
      continue;
    end if;

    if v_event.status = 'upcoming' then
      delete from public.event e where e.id = v_event.id;
    else
      update public.event e set
        status = 'finished',
        ended_at = p_as_of,
        ended_by = null,
        ended_by_system = true
      where e.id = v_event.id;
    end if;

    perform private.create_next_recurring_event(
      v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, p_as_of
    );
  end loop;
end $$;

revoke execute on function private.process_overdue_events(timestamptz)
  from public, anon, authenticated;

select cron.schedule(
  'close-overdue-events',
  '* * * * *',
  'select private.process_overdue_events()'
);
