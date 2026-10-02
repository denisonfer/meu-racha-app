-- Fatia 5b: o Evento, o ciclo e as travas (motor, exclusão, saída, Passagem).

create type public.event_status as enum ('upcoming', 'active', 'finished');

create table public.event (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.racha (id) on delete cascade,
  starts_on date not null,
  starts_at time not null,
  status public.event_status not null default 'upcoming',
  conductor_id uuid references public.profile (id),
  ended_at timestamptz,
  ended_by uuid references public.profile (id),
  place text not null,
  is_paid boolean not null default false,
  price integer,
  spot_limit smallint,
  reminder_lead_hours smallint not null,
  outfield_per_team smallint not null,
  game_mode public.game_mode not null,
  max_consecutive_wins smallint not null,
  tie_rule public.tie_rule not null,
  tie_return_order public.tie_return_order not null,
  consider_position boolean not null,
  match_duration_min smallint,
  -- o Racha pode ficar "A definir"; o evento não, senão ninguém sabe onde jogar
  constraint event_place_text check (
    char_length(place) between 1 and 120
    and place = btrim(place)
    and place <> 'A definir'
  ),
  constraint event_price_range check (price is null or price between 1 and 9999),
  constraint event_price_required_when_paid check (not is_paid or price is not null),
  constraint event_spot_limit_fits_two_teams check (
    spot_limit is null or spot_limit >= 2 * outfield_per_team
  ),
  constraint event_reminder_lead_hours_range check (reminder_lead_hours >= 1),
  constraint event_status_shape check (
    (status = 'upcoming' and conductor_id is null and ended_at is null and ended_by is null)
    or (status = 'active' and conductor_id is not null and ended_at is null and ended_by is null)
    or (status = 'finished' and conductor_id is not null and ended_at is not null and ended_by is not null)
  )
);

-- um Racha tem no máximo um evento por vir e um rolando
create unique index event_one_upcoming on public.event (racha_id) where status = 'upcoming';
create unique index event_one_active on public.event (racha_id) where status = 'active';

alter table public.event enable row level security;
revoke all on public.event from public, anon, authenticated;

-- leitura: quem não é Membro não vê a agenda
create function public.list_open_events(p_racha_id uuid)
returns table (
  id uuid,
  status public.event_status,
  starts_on date,
  starts_at time,
  place text,
  is_paid boolean,
  price integer,
  spot_limit smallint,
  outfield_per_team smallint,
  conductor_id uuid,
  conductor_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.my_racha_role(p_racha_id) is null then
    raise exception 'not_member';
  end if;

  return query
    select e.id, e.status, e.starts_on, e.starts_at, e.place, e.is_paid, e.price,
      e.spot_limit, e.outfield_per_team, e.conductor_id, p.display_name
    from public.event e
    left join public.profile p on p.id = e.conductor_id
    where e.racha_id = p_racha_id
      and e.status in ('upcoming'::public.event_status, 'active'::public.event_status)
    order by e.starts_on, e.starts_at, e.id;
end $$;

revoke execute on function public.list_open_events(uuid) from public, anon;
grant execute on function public.list_open_events(uuid) to authenticated;

-- Dono ou Admin; copia o motor e o lembrete, não idade, mensalidade nem dia
create function public.create_event(
  p_racha_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_place text,
  p_is_paid boolean,
  p_price integer,
  p_spot_limit smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha public.racha%rowtype;
  v_event_id uuid;
begin
  select * into v_racha from public.racha r where r.id = p_racha_id for update;
  if not found then
    raise exception 'not_allowed';
  end if;

  if not coalesce(public.my_racha_role(p_racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if exists (
    select 1 from public.event e
    where e.racha_id = p_racha_id and e.status = 'upcoming'
  ) then
    raise exception 'event_exists';
  end if;

  -- a data do Brasil, não a do servidor em UTC; horário passado no dia de hoje entra
  if p_starts_on < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'past_date';
  end if;

  insert into public.event (
    racha_id, starts_on, starts_at, place, is_paid, price, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    p_racha_id, p_starts_on, p_starts_at, btrim(p_place), p_is_paid, p_price, p_spot_limit,
    v_racha.reminder_lead_hours, v_racha.outfield_per_team, v_racha.game_mode,
    v_racha.max_consecutive_wins, v_racha.tie_rule, v_racha.tie_return_order,
    v_racha.consider_position, v_racha.match_duration_min
  ) returning id into v_event_id;

  return v_event_id;
end $$;

revoke execute on function public.create_event(uuid, date, time, text, boolean, integer, smallint) from public, anon;
grant execute on function public.create_event(uuid, date, time, text, boolean, integer, smallint) to authenticated;

-- upcoming: Dono ou Admin; active: só o Condutor; outro status não edita
create function public.update_event(
  p_event_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_place text,
  p_is_paid boolean,
  p_price integer,
  p_spot_limit smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.event%rowtype;
  v_role public.member_role;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.racha r where r.id = v_event.racha_id for update;

  -- relê depois da trava: o status pode ter mudado enquanto esperava
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  v_role := public.my_racha_role(v_event.racha_id);

  if v_event.status = 'upcoming' then
    if not coalesce(v_role in ('OWNER', 'ADMIN'), false) then
      raise exception 'not_allowed';
    end if;
  elsif v_event.status = 'active' then
    if v_event.conductor_id is distinct from v_uid then
      raise exception 'not_allowed';
    end if;
  else
    raise exception 'not_allowed';
  end if;

  -- a data do Brasil, não a do servidor em UTC; horário passado no dia de hoje entra
  if p_starts_on < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'past_date';
  end if;

  update public.event e set
    starts_on = p_starts_on,
    starts_at = p_starts_at,
    place = btrim(p_place),
    is_paid = p_is_paid,
    price = p_price,
    spot_limit = p_spot_limit
  where e.id = p_event_id;
end $$;

revoke execute on function public.update_event(uuid, date, time, text, boolean, integer, smallint) from public, anon;
grant execute on function public.update_event(uuid, date, time, text, boolean, integer, smallint) to authenticated;

-- Dono ou Admin apaga só o que ainda não começou
create function public.cancel_event(p_event_id uuid)
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

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;
  if v_event.status is distinct from 'upcoming' then
    raise exception 'not_allowed';
  end if;

  delete from public.event e where e.id = p_event_id;
end $$;

revoke execute on function public.cancel_event(uuid) from public, anon;
grant execute on function public.cancel_event(uuid) to authenticated;

-- Dono ou Admin; não lê o relógio: evento de hoje com horário passado também começa
create function public.start_event(p_event_id uuid)
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

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;
  if v_event.status is distinct from 'upcoming' then
    raise exception 'not_allowed';
  end if;

  update public.event e set
    status = 'active',
    conductor_id = v_uid
  where e.id = p_event_id;
end $$;

revoke execute on function public.start_event(uuid) from public, anon;
grant execute on function public.start_event(uuid) to authenticated;

-- só o Condutor encerra; não nasce o próximo evento
create function public.finish_event(p_event_id uuid)
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
    ended_by = v_uid
  where e.id = p_event_id;
end $$;

revoke execute on function public.finish_event(uuid) from public, anon;
grant execute on function public.finish_event(uuid) to authenticated;

create function public.racha_has_active_event(p_racha_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event e
    where e.racha_id = p_racha_id and e.status = 'active'
  );
$$;

revoke execute on function public.racha_has_active_event(uuid) from public, anon;
grant execute on function public.racha_has_active_event(uuid) to authenticated;

-- com evento rolando o motor fica; nome, local, dia, horário, idade, pago, valores, limite e lembrete passam
create function public.guard_racha_motor_while_event_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.racha_has_active_event(old.id)
     and (
       new.outfield_per_team is distinct from old.outfield_per_team
       or new.game_mode is distinct from old.game_mode
       or new.max_consecutive_wins is distinct from old.max_consecutive_wins
       or new.tie_rule is distinct from old.tie_rule
       or new.tie_return_order is distinct from old.tie_return_order
       or new.consider_position is distinct from old.consider_position
       or new.match_duration_min is distinct from old.match_duration_min
     )
  then
    raise exception 'event_active';
  end if;
  return new;
end $$;

revoke execute on function public.guard_racha_motor_while_event_active() from public, anon;
grant execute on function public.guard_racha_motor_while_event_active() to authenticated;

create trigger racha_guard_motor_while_event_active
  before update on public.racha
  for each row execute function public.guard_racha_motor_while_event_active();

-- Dono não exclui o Racha enquanto um evento está rolando
drop policy "racha: Dono exclui" on public.racha;
create policy "racha: Dono exclui" on public.racha for delete
  to authenticated
  using (
    public.my_racha_role(id) = 'OWNER'
    and not public.racha_has_active_event(id)
  );

create or replace function public.leave_racha(p_racha_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role;
begin
  -- a Passagem trava o Racha: sair e receber a Passagem ao mesmo tempo não deixa o Racha sem Dono
  perform 1 from public.racha r where r.id = p_racha_id for update;

  v_my_role := public.my_racha_role(p_racha_id);
  if v_my_role is null then
    raise exception 'not_member';
  end if;
  -- o Dono só sai pela Passagem (3.5)
  if v_my_role = 'OWNER' then
    raise exception 'owner_cannot_leave';
  end if;
  -- o Condutor não abandona o evento que está rolando; quem não conduz sai como antes
  if exists (
    select 1 from public.event e
    where e.racha_id = p_racha_id
      and e.status = 'active'
      and e.conductor_id = (select auth.uid())
  ) then
    raise exception 'conductor';
  end if;

  update public.member m set is_active = false
    where m.racha_id = p_racha_id and m.profile_id = (select auth.uid());

  delete from public.join_request jr
    where jr.racha_id = p_racha_id and jr.profile_id = (select auth.uid());
end $$;

create or replace function public.transfer_ownership(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target public.member%rowtype;
begin
  perform 1 from public.racha r where r.id = p_racha_id for update;

  if public.my_racha_role(p_racha_id) is distinct from 'OWNER' or p_profile_id = v_uid then
    raise exception 'not_allowed';
  end if;

  -- mesma chave do create_racha: quem recebe não cria um Racha enquanto recebe outro
  perform pg_advisory_xact_lock(hashtext('create_racha:' || p_profile_id::text));

  select * into v_target from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
    for update;
  if not found then
    raise exception 'not_member';
  end if;

  -- teto do Free (3.5, 12.1); sem Plano no banco, todo mundo é Free
  if exists (
    select 1 from public.member m
    where m.profile_id = p_profile_id and m.role = 'OWNER' and m.is_active
  ) then
    raise exception 'plan_owner_limit';
  end if;

  -- rebaixa antes de promover: o índice de um Dono só não pode ver dois
  update public.member m set role = 'ADMIN'
    where m.racha_id = p_racha_id and m.profile_id = v_uid;
  update public.member m set role = 'OWNER' where m.id = v_target.id;

  -- só leva a condução quem está conduzindo; um Admin Condutor continua no apito
  update public.event e
    set conductor_id = p_profile_id
    where e.racha_id = p_racha_id
      and e.status = 'active'
      and e.conductor_id = v_uid;

  -- quem passa o Racha não é mais dono: o aviso que recebeu antes deixa de ser verdade
  delete from public.racha_notice n
    where n.profile_id = (select auth.uid())
      and n.racha_id = p_racha_id
      and n.kind = 'OWNERSHIP_RECEIVED';

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select p_profile_id, r.id, r.name, 'OWNERSHIP_RECEIVED'
    from public.racha r where r.id = p_racha_id;
end $$;
