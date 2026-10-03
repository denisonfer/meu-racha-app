-- Desligar Pago desfaz o registro daquele Evento; dinheiro real é acertado fora do app.

create or replace function private.member_has_event_monthly_pass(p_event_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event e
    join public.racha_monthly_pass mp
      on mp.racha_id = e.racha_id
     and mp.profile_id = p_profile_id
     and mp.year_month = private.event_civil_year_month(e.starts_on, e.starts_at)
    where e.id = p_event_id and e.is_paid
  );
$$;

create function private.clear_event_payment_for_free(p_event_id uuid, p_racha_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  -- A mesma trava usada ao gastar Crédito impede que outro Evento use o saldo no meio do acerto.
  for v_profile_id in
    select distinct c.profile_id
    from public.racha_credit_entry c
    where c.racha_id = p_racha_id
      and c.source_event_id = p_event_id
      and c.entry_kind = 'apply'
    order by c.profile_id
  loop
    perform private.lock_credit_balance(p_racha_id, v_profile_id);
  end loop;

  -- Retirar a aplicação devolve cada parcela à concessão original e à sua validade.
  delete from public.racha_credit_entry c
  where c.racha_id = p_racha_id
    and c.source_event_id = p_event_id
    and c.entry_kind = 'apply';

  -- Sem fato pago, cancelamento e encerramento posteriores não criam Crédito duplicado.
  delete from public.event_payment_fact f where f.event_id = p_event_id;
  update public.event_guest g set is_paid = false
  where g.event_id = p_event_id and g.is_paid;
end $$;

revoke execute on function private.clear_event_payment_for_free(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.update_racha_logistics(
  p_racha_id uuid,
  p_place text,
  p_weekday smallint,
  p_kickoff_time time,
  p_min_age smallint,
  p_is_paid boolean,
  p_price integer,
  p_monthly_price integer,
  p_spot_limit smallint,
  p_payer_target integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.my_racha_role(p_racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  perform private.assert_payer_target(p_is_paid, p_payer_target);

  update public.racha r set
    place = btrim(p_place),
    weekday = p_weekday,
    kickoff_time = p_kickoff_time,
    min_age = p_min_age,
    is_paid = p_is_paid,
    price = case when p_is_paid then p_price else null end,
    monthly_price = case when p_is_paid then p_monthly_price else null end,
    spot_limit = p_spot_limit,
    payer_target = case when p_is_paid then p_payer_target else null end
  where r.id = p_racha_id;
end $$;

create or replace function public.create_event(
  p_racha_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_place text,
  p_is_paid boolean,
  p_price integer,
  p_spot_limit smallint,
  p_payer_target integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha public.racha%rowtype;
  v_event_id uuid;
  v_target integer;
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

  if p_starts_on + p_starts_at <= (now() at time zone 'America/Sao_Paulo') then
    raise exception 'past_date';
  end if;

  v_target := coalesce(p_payer_target, v_racha.payer_target);
  perform private.assert_payer_target(p_is_paid, v_target);

  insert into public.event (
    racha_id, starts_on, starts_at, place, is_paid, price, spot_limit, payer_target,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    p_racha_id, p_starts_on, p_starts_at, btrim(p_place), p_is_paid,
    case when p_is_paid then p_price else null end, p_spot_limit,
    case when p_is_paid then v_target else null end,
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
  p_spot_limit smallint,
  p_payer_target integer
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
  v_old_month text;
  v_new_month text;
  v_profile_id uuid;
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

  if (v_event.status = 'upcoming' and p_starts_on + p_starts_at <= (now() at time zone 'America/Sao_Paulo'))
    or (v_event.status = 'active' and p_starts_on < (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'past_date';
  end if;

  perform private.assert_payer_target(p_is_paid, p_payer_target);

  v_old_month := private.event_civil_year_month(v_event.starts_on, v_event.starts_at);
  v_new_month := private.event_civil_year_month(p_starts_on, p_starts_at);
  if v_old_month <> v_new_month and exists (
    select 1 from public.event_payment_fact f
    where f.event_id = p_event_id
      and (
        f.paid_marked_at is not null
        or f.cash_paid_amount > 0
        or f.credit_applied_amount > 0
        or f.monthly_coverage_month is not null
      )
  ) then
    raise exception 'event_month_locked';
  end if;

  if p_spot_limit is not null and p_spot_limit < private.event_occupancy(p_event_id) then
    raise exception 'spot_limit_below_occupancy';
  end if;

  if v_event.is_paid and not p_is_paid then
    perform private.clear_event_payment_for_free(p_event_id, v_event.racha_id);
  end if;

  update public.event e set
    starts_on = p_starts_on,
    starts_at = p_starts_at,
    place = btrim(p_place),
    is_paid = p_is_paid,
    price = case when p_is_paid then p_price else null end,
    spot_limit = p_spot_limit,
    payer_target = case when p_is_paid then p_payer_target else null end
  where e.id = p_event_id;

  -- Ao religar Pago, quem já confirmou e tem passe do mês recebe cobertura do dia.
  if not v_event.is_paid and p_is_paid then
    for v_profile_id in
      select ea.profile_id from public.event_attendance ea
      where ea.event_id = p_event_id and ea.status = 'confirmed'
    loop
      perform private.sync_monthly_coverage_for_member(p_event_id, v_profile_id);
    end loop;
  end if;

  perform private.promote_waitlist_for_event(p_event_id);
end $$;
