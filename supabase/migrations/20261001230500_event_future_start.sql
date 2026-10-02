-- Eventos agendados precisam começar no futuro; eventos em andamento podem ter começado hoje.

create or replace function public.create_event(
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

  -- Compara data e hora no mesmo fuso civil usado para agendar o evento.
  if p_starts_on + p_starts_at <= (now() at time zone 'America/Sao_Paulo') then
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

create or replace function public.update_event(
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

  -- O evento em andamento pode ter começado hoje; o agendado ainda precisa estar no futuro.
  if (v_event.status = 'upcoming' and p_starts_on + p_starts_at <= (now() at time zone 'America/Sao_Paulo'))
    or (v_event.status = 'active' and p_starts_on < (now() at time zone 'America/Sao_Paulo')::date) then
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
