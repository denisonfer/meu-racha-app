-- Fatia 5e: Meta de pagantes, ciclo de pagamento, settle falta/fila, pagou na fila, finished.

-- --- schema ---

alter table public.racha
  add column if not exists payer_target integer;

alter table public.event
  add column if not exists payer_target integer;

alter table public.racha
  drop constraint if exists racha_payer_target_positive;
alter table public.racha
  add constraint racha_payer_target_positive
  check (payer_target is null or payer_target > 0);

alter table public.event
  drop constraint if exists event_payer_target_positive;
alter table public.event
  add constraint event_payer_target_positive
  check (payer_target is null or payer_target > 0);

alter table public.event_payment_fact
  add column if not exists had_slot_since_payment boolean not null default false;

alter table public.event_payment_fact
  add column if not exists payment_cycle_id uuid;

-- fatos legados: ciclo único; evidência de vaga só quando reconstruível
update public.event_payment_fact f set
  payment_cycle_id = coalesce(f.payment_cycle_id, gen_random_uuid()),
  had_slot_since_payment = case
    when exists (
      select 1 from public.event_attendance ea
      where ea.event_id = f.event_id
        and ea.profile_id = f.profile_id
        and ea.status = 'confirmed'
    ) then true
    when exists (
      select 1 from public.event_attendance ea
      where ea.event_id = f.event_id
        and ea.profile_id = f.profile_id
        and ea.status = 'waitlisted'
    ) then false
    else true
  end;

alter table public.event_payment_fact
  alter column payment_cycle_id set not null,
  alter column payment_cycle_id set default gen_random_uuid();

alter table public.racha_credit_entry
  drop constraint if exists racha_credit_entry_entry_kind_check;

alter table public.racha_credit_entry
  add constraint racha_credit_entry_entry_kind_check check (
    entry_kind in (
      'cancel_daily', 'absence_daily', 'waitlist_daily', 'apply', 'restore'
    )
  );

-- --- helpers: saldo reconhece novos grants ---

create or replace function private.grant_remaining(p_grant_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    g.amount_delta
    + coalesce((
      select sum(c.amount_delta)
      from public.racha_credit_entry c
      where c.source_grant_id = g.id
    ), 0)
  )::integer
  from public.racha_credit_entry g
  where g.id = p_grant_id
    and g.entry_kind in ('cancel_daily', 'absence_daily', 'waitlist_daily');
$$;

create or replace function private.credit_balance(p_racha_id uuid, p_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(private.grant_remaining(g.id)), 0)::integer
  from public.racha_credit_entry g
  where g.racha_id = p_racha_id
    and g.profile_id = p_profile_id
    and g.entry_kind in ('cancel_daily', 'absence_daily', 'waitlist_daily')
    and (g.expires_at is null or g.expires_at > now())
    and private.grant_remaining(g.id) > 0;
$$;

create or replace function private.apply_credit_fifo(
  p_racha_id uuid,
  p_profile_id uuid,
  p_source_event_id uuid,
  p_operation_prefix text,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_needed integer := p_amount;
  v_grant record;
  v_remaining integer;
  v_take integer;
  v_applied integer := 0;
  v_op_key text;
  v_got integer;
begin
  if p_amount <= 0 then
    return 0;
  end if;

  perform private.lock_credit_balance(p_racha_id, p_profile_id);

  for v_grant in
    select g.id, g.expires_at
    from public.racha_credit_entry g
    where g.racha_id = p_racha_id
      and g.profile_id = p_profile_id
      and g.entry_kind in ('cancel_daily', 'absence_daily', 'waitlist_daily')
      and (g.expires_at is null or g.expires_at > now())
    order by g.created_at, g.id
    for update of g
  loop
    exit when v_needed <= 0;

    v_remaining := private.grant_remaining(v_grant.id);
    if v_remaining <= 0 then
      continue;
    end if;

    v_take := least(v_remaining, v_needed);
    v_op_key := format('%s:%s', p_operation_prefix, v_grant.id);

    insert into public.racha_credit_entry (
      racha_id, profile_id, source_event_id, operation_key, entry_kind,
      amount_delta, expires_at, source_grant_id
    ) values (
      p_racha_id, p_profile_id, p_source_event_id, v_op_key, 'apply',
      -v_take, null, v_grant.id
    )
    on conflict (operation_key) do nothing
    returning abs(amount_delta) into v_got;

    if v_got is null then
      select abs(c.amount_delta) into v_got
      from public.racha_credit_entry c
      where c.operation_key = v_op_key and c.entry_kind = 'apply';
    end if;

    if v_got is null then
      continue;
    end if;

    v_applied := v_applied + v_got;
    v_needed := v_needed - v_got;
  end loop;

  return v_applied;
end $$;

create function private.mark_paid_fact_had_slot(p_event_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_payment_fact f set
    had_slot_since_payment = true
  where f.event_id = p_event_id
    and f.profile_id = p_profile_id
    and f.paid_marked_at is not null
    and not f.had_slot_since_payment;
end $$;

revoke execute on function private.mark_paid_fact_had_slot(uuid, uuid)
  from public, anon, authenticated;

create or replace function private.try_confirm_member(p_event_id uuid, p_profile_id uuid)
returns public.attendance_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_has_slot boolean;
begin
  select * into v_event from public.event e where e.id = p_event_id;

  perform private.promote_waitlist_for_event(p_event_id);

  v_has_slot := v_event.spot_limit is null
    or private.event_occupancy(p_event_id) < v_event.spot_limit;

  if v_has_slot then
    insert into public.event_attendance (event_id, profile_id, status)
    values (p_event_id, p_profile_id, 'confirmed')
    on conflict (event_id, profile_id) do update set
      status = 'confirmed',
      waitlisted_at = null;
    perform private.sync_monthly_coverage_for_member(p_event_id, p_profile_id);
    perform private.mark_paid_fact_had_slot(p_event_id, p_profile_id);
    return 'confirmed'::public.attendance_status;
  end if;

  insert into public.event_attendance (event_id, profile_id, status, waitlisted_at)
  values (p_event_id, p_profile_id, 'waitlisted', now())
  on conflict (event_id, profile_id) do update set
    status = 'waitlisted',
    waitlisted_at = coalesce(event_attendance.waitlisted_at, now());

  return 'waitlisted'::public.attendance_status;
end $$;

create or replace function private.promote_waitlist_for_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_slots integer;
  v_profile_id uuid;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    return;
  end if;

  loop
    if v_event.spot_limit is not null then
      v_slots := v_event.spot_limit - private.event_occupancy(p_event_id);
      if v_slots <= 0 then
        exit;
      end if;
    end if;

    select ea.profile_id into v_profile_id
    from public.event_attendance ea
    where ea.event_id = p_event_id and ea.status = 'waitlisted'
    order by
      case when private.member_has_event_monthly_pass(p_event_id, ea.profile_id) then 0 else 1 end,
      ea.waitlisted_at,
      ea.profile_id
    limit 1
    for update of ea;

    if not found then
      exit;
    end if;

    update public.event_attendance ea set
      status = 'confirmed',
      waitlisted_at = null
    where ea.event_id = p_event_id and ea.profile_id = v_profile_id;

    perform private.sync_monthly_coverage_for_member(p_event_id, v_profile_id);
    perform private.mark_paid_fact_had_slot(p_event_id, v_profile_id);
  end loop;
end $$;

-- --- settle ---

create function private.count_present_payers(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (
      select count(*)::integer
      from public.event_payment_fact f
      where f.event_id = p_event_id
        and f.did_attend
        and (
          f.paid_marked_at is not null
          or coalesce(f.cash_paid_amount, 0) + coalesce(f.credit_applied_amount, 0) > 0
          or f.monthly_coverage_month is not null
        )
    )
    + (
      select count(*)::integer
      from public.event_guest g
      where g.event_id = p_event_id
        and g.did_attend
        and g.is_paid
    )
  );
$$;

revoke execute on function private.count_present_payers(uuid)
  from public, anon, authenticated;

create function private.settlement_op_prefix(
  p_event_id uuid,
  p_profile_id uuid,
  p_cycle_id uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select format('settle:%s:%s:%s', p_event_id, p_profile_id, p_cycle_id);
$$;

revoke execute on function private.settlement_op_prefix(uuid, uuid, uuid)
  from public, anon, authenticated;

create function private.settlement_consumed(
  p_event_id uuid,
  p_profile_id uuid,
  p_cycle_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prefix text := private.settlement_op_prefix(p_event_id, p_profile_id, p_cycle_id);
begin
  -- grant settle já usado noutro Evento
  if exists (
    select 1
    from public.racha_credit_entry g
    join public.racha_credit_entry a
      on a.source_grant_id = g.id and a.entry_kind = 'apply'
    where g.source_event_id = p_event_id
      and g.profile_id = p_profile_id
      and g.entry_kind in ('absence_daily', 'waitlist_daily')
      and g.operation_key = v_prefix || ':grant'
      and a.source_event_id is distinct from p_event_id
  ) then
    return true;
  end if;

  -- parcela restaurada pelo settle e depois reaplicada noutro Evento
  if exists (
    select 1
    from public.racha_credit_entry r
    join public.racha_credit_entry a
      on a.source_grant_id = r.source_grant_id
     and a.entry_kind = 'apply'
     and a.created_at > r.created_at
     and a.source_event_id is distinct from p_event_id
    where r.source_event_id = p_event_id
      and r.profile_id = p_profile_id
      and r.entry_kind = 'restore'
      and r.operation_key like v_prefix || ':restore:%'
  ) then
    return true;
  end if;

  return false;
end $$;

revoke execute on function private.settlement_consumed(uuid, uuid, uuid)
  from public, anon, authenticated;

create function private.clear_settlement_entries(
  p_event_id uuid,
  p_profile_id uuid,
  p_cycle_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text := private.settlement_op_prefix(p_event_id, p_profile_id, p_cycle_id);
begin
  delete from public.racha_credit_entry c
  where c.source_event_id = p_event_id
    and c.profile_id = p_profile_id
    and (
      c.operation_key = v_prefix || ':grant'
      or c.operation_key like v_prefix || ':restore:%'
    );
end $$;

revoke execute on function private.clear_settlement_entries(uuid, uuid, uuid)
  from public, anon, authenticated;

create function private.settle_member_fact(
  p_event public.event,
  p_fact public.event_payment_fact,
  p_present_payers integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_kind text;
  v_meta_met boolean;
begin
  v_prefix := private.settlement_op_prefix(
    p_fact.event_id, p_fact.profile_id, p_fact.payment_cycle_id
  );

  if private.settlement_consumed(
    p_fact.event_id, p_fact.profile_id, p_fact.payment_cycle_id
  ) then
    raise exception 'credit_already_used';
  end if;

  perform private.clear_settlement_entries(
    p_fact.event_id, p_fact.profile_id, p_fact.payment_cycle_id
  );

  -- mensal / veio / sem diária marcada → só limpa settle anterior
  if p_fact.monthly_coverage_month is not null
     or p_fact.paid_marked_at is null
     or p_fact.did_attend then
    return;
  end if;

  v_meta_met := p_event.payer_target is not null
    and p_present_payers >= p_event.payer_target;

  if p_fact.had_slot_since_payment then
    if not v_meta_met then
      return;
    end if;
    v_kind := 'absence_daily';
  else
    v_kind := 'waitlist_daily';
  end if;

  if p_fact.cash_paid_amount > 0 then
    perform private.insert_credit_entry(
      p_event.racha_id,
      p_fact.profile_id,
      p_fact.event_id,
      v_prefix || ':grant',
      v_kind,
      p_fact.cash_paid_amount,
      now() + interval '6 months',
      null
    );
  end if;

  if p_fact.credit_applied_amount > 0 then
    perform private.restore_credit_applies(
      p_event.racha_id,
      p_fact.profile_id,
      p_fact.event_id,
      v_prefix || ':restore'
    );
  end if;
end $$;

revoke execute on function private.settle_member_fact(public.event, public.event_payment_fact, integer)
  from public, anon, authenticated;

create function private.settle_event_credits(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_fact public.event_payment_fact%rowtype;
  v_present integer;
begin
  select * into v_event from public.event e where e.id = p_event_id for update;
  if not found then
    return;
  end if;

  if not v_event.is_paid or v_event.status is distinct from 'finished' then
    return;
  end if;

  v_present := private.count_present_payers(p_event_id);

  for v_fact in
    select f.*
    from public.event_payment_fact f
    where f.event_id = p_event_id
    for update
  loop
    perform private.lock_credit_balance(v_event.racha_id, v_fact.profile_id);
    perform private.settle_member_fact(v_event, v_fact, v_present);
  end loop;
end $$;

revoke execute on function private.settle_event_credits(uuid)
  from public, anon, authenticated;

-- --- finish + relógio ---

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

  perform private.settle_event_credits(p_event_id);

  perform private.create_next_recurring_event(
    v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, now()
  );
end $$;

create or replace function private.process_overdue_events(p_as_of timestamptz default now())
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
      perform private.process_event_cancellation_credits(v_event.id, v_event.racha_id);
      delete from public.event e where e.id = v_event.id;
    else
      update public.event e set
        status = 'finished',
        ended_at = p_as_of,
        ended_by = null,
        ended_by_system = true
      where e.id = v_event.id;
      perform private.settle_event_credits(v_event.id);
    end if;

    perform private.create_next_recurring_event(
      v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, p_as_of
    );
  end loop;
end $$;

-- --- pagou / veio (open + finished) ---

create or replace function public.set_attendance_attended(
  p_event_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_did_attend boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_attendance public.event_attendance%rowtype;
  v_fact public.event_payment_fact%rowtype;
begin
  if (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(p_event_id);

  if v_event.status not in ('upcoming', 'active', 'finished') then
    raise exception 'not_allowed';
  end if;

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if p_guest_id is not null then
    if v_event.status <> 'finished' then
      perform private.assert_open_attendance_event(v_event);
    end if;
    update public.event_guest g set did_attend = p_did_attend
    where g.id = p_guest_id and g.event_id = p_event_id;
    if not found then
      raise exception 'not_allowed';
    end if;
    if v_event.status = 'finished' then
      perform private.settle_event_credits(p_event_id);
    end if;
    return;
  end if;

  select * into v_attendance from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id;
  select * into v_fact from public.event_payment_fact f
  where f.event_id = p_event_id and f.profile_id = p_profile_id;

  if v_event.status = 'finished' then
    if v_attendance.profile_id is null and v_fact.profile_id is null then
      raise exception 'not_allowed';
    end if;
    if p_did_attend
       and coalesce(v_attendance.status, 'cancelled') is distinct from 'confirmed'
       and not coalesce(v_fact.had_slot_since_payment, false) then
      raise exception 'not_confirmed';
    end if;

    if v_attendance.profile_id is not null then
      update public.event_attendance ea set did_attend = p_did_attend
      where ea.event_id = p_event_id and ea.profile_id = p_profile_id;
    end if;
    if v_fact.profile_id is not null then
      update public.event_payment_fact f set did_attend = p_did_attend
      where f.event_id = p_event_id and f.profile_id = p_profile_id;
    end if;

    perform private.settle_event_credits(p_event_id);
    return;
  end if;

  perform private.assert_open_attendance_event(v_event);

  if p_did_attend
     and (v_attendance.profile_id is null or v_attendance.status <> 'confirmed') then
    raise exception 'not_confirmed';
  end if;

  update public.event_attendance ea set did_attend = p_did_attend
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id;

  update public.event_payment_fact f set did_attend = p_did_attend
  where f.event_id = p_event_id and f.profile_id = p_profile_id;
end $$;

create or replace function public.set_attendance_paid(
  p_event_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_paid boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_attendance public.event_attendance%rowtype;
  v_fact public.event_payment_fact%rowtype;
  v_year_month text;
  v_apply integer;
  v_cash integer;
  v_cycle uuid;
  v_had_slot boolean;
begin
  if (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(p_event_id);

  if v_event.status not in ('upcoming', 'active', 'finished') then
    raise exception 'not_allowed';
  end if;

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if not v_event.is_paid or v_event.price is null then
    raise exception 'not_allowed';
  end if;

  v_year_month := private.event_civil_year_month(v_event.starts_on, v_event.starts_at);

  if p_guest_id is not null then
    if v_event.status <> 'finished' then
      perform private.assert_open_attendance_event(v_event);
    end if;
    update public.event_guest g set is_paid = p_paid
    where g.id = p_guest_id and g.event_id = p_event_id;
    if not found then
      raise exception 'not_allowed';
    end if;
    if v_event.status = 'finished' then
      perform private.settle_event_credits(p_event_id);
    end if;
    return;
  end if;

  select * into v_attendance from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id;
  select * into v_fact from public.event_payment_fact f
  where f.event_id = p_event_id and f.profile_id = p_profile_id;

  if v_event.status = 'finished' then
    if v_attendance.profile_id is null and v_fact.profile_id is null then
      raise exception 'not_confirmed';
    end if;
  else
    perform private.assert_open_attendance_event(v_event);
    if v_attendance.profile_id is null
       or v_attendance.status not in ('confirmed', 'waitlisted') then
      raise exception 'not_confirmed';
    end if;
  end if;

  if private.member_has_event_monthly_pass(p_event_id, p_profile_id)
     or coalesce(v_fact.monthly_coverage_month = v_year_month, false) then
    if not p_paid then
      raise exception 'mensalista_paid';
    end if;
    return;
  end if;

  if not p_paid then
    if v_event.status = 'finished'
       and v_fact.payment_cycle_id is not null
       and private.settlement_consumed(
         p_event_id, p_profile_id, v_fact.payment_cycle_id
       ) then
      raise exception 'credit_already_used';
    end if;

    if v_fact.payment_cycle_id is not null then
      perform private.clear_settlement_entries(
        p_event_id, p_profile_id, v_fact.payment_cycle_id
      );
    end if;

    if coalesce(v_fact.credit_applied_amount, 0) > 0 then
      perform private.lock_credit_balance(v_event.racha_id, p_profile_id);
      delete from public.racha_credit_entry c
      where c.racha_id = v_event.racha_id
        and c.profile_id = p_profile_id
        and c.source_event_id = p_event_id
        and c.entry_kind = 'apply';
    end if;

    delete from public.event_payment_fact f
    where f.event_id = p_event_id and f.profile_id = p_profile_id
      and f.paid_marked_at is not null;

    if v_event.status = 'finished' then
      perform private.settle_event_credits(p_event_id);
    end if;
    return;
  end if;

  if v_fact.paid_marked_at is not null then
    if v_event.status = 'finished' then
      perform private.settle_event_credits(p_event_id);
    end if;
    return;
  end if;

  v_cycle := gen_random_uuid();
  v_had_slot := coalesce(v_attendance.status = 'confirmed', false)
    or coalesce(v_fact.had_slot_since_payment, false);

  v_apply := private.apply_credit_fifo(
    v_event.racha_id,
    p_profile_id,
    p_event_id,
    format('mark_paid:%s:apply:%s:%s', p_event_id, p_profile_id, v_cycle),
    v_event.price
  );
  v_cash := v_event.price - v_apply;

  insert into public.event_payment_fact (
    event_id, racha_id, profile_id, event_year_month, daily_amount_snapshot,
    cash_paid_amount, credit_applied_amount, did_attend, paid_marked_at,
    had_slot_since_payment, payment_cycle_id
  ) values (
    p_event_id, v_event.racha_id, p_profile_id, v_year_month, v_event.price,
    v_cash, v_apply,
    coalesce(v_attendance.did_attend, v_fact.did_attend, false),
    now(),
    v_had_slot,
    v_cycle
  )
  on conflict (event_id, profile_id) do update set
    daily_amount_snapshot = excluded.daily_amount_snapshot,
    cash_paid_amount = excluded.cash_paid_amount,
    credit_applied_amount = excluded.credit_applied_amount,
    did_attend = excluded.did_attend,
    paid_marked_at = excluded.paid_marked_at,
    had_slot_since_payment = excluded.had_slot_since_payment,
    payment_cycle_id = excluded.payment_cycle_id;

  if v_event.status = 'finished' then
    perform private.settle_event_credits(p_event_id);
  end if;
end $$;

-- --- listagem ---

drop function if exists public.list_event_attendance(uuid);

create function public.list_event_attendance(p_event_id uuid)
returns table (
  kind text,
  profile_id uuid,
  guest_id uuid,
  status public.attendance_status,
  queue_position integer,
  display_name text,
  did_attend boolean,
  is_paid_effective boolean,
  is_monthly_pass boolean,
  cash_paid_amount integer,
  credit_applied_amount integer,
  plays_as public.plays_as,
  stars smallint,
  is_super_star boolean,
  avatar_path text,
  primary_position public.position,
  secondary_position public.position,
  role public.member_role,
  credit_balance integer,
  present_payer_count integer,
  payer_target integer,
  event_status public.event_status,
  my_credit_balance integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_role public.member_role;
  v_year_month text;
  v_uid uuid := (select auth.uid());
  v_present integer;
  v_my_credit integer;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  if public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_member';
  end if;

  v_role := public.my_racha_role(v_event.racha_id);
  v_year_month := private.event_civil_year_month(v_event.starts_on, v_event.starts_at);
  v_present := private.count_present_payers(p_event_id);
  v_my_credit := private.credit_balance(v_event.racha_id, v_uid);

  return query
    select
      'member'::text,
      ea.profile_id,
      null::uuid,
      ea.status,
      case when ea.status = 'waitlisted'
        then private.my_waitlist_position(p_event_id, ea.profile_id)
        else null
      end,
      p.display_name,
      ea.did_attend,
      (
        private.member_has_event_monthly_pass(p_event_id, ea.profile_id)
        or coalesce(f.paid_marked_at is not null, false)
        or coalesce(f.monthly_coverage_month = v_year_month, false)
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false)
      ),
      private.member_has_event_monthly_pass(p_event_id, ea.profile_id),
      f.cash_paid_amount,
      f.credit_applied_amount,
      m.plays_as,
      m.stars,
      m.is_super_star,
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role,
      case
        when v_role in ('OWNER', 'ADMIN') then private.credit_balance(v_event.racha_id, ea.profile_id)
        when ea.profile_id = v_uid then v_my_credit
        else null
      end,
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit
    from public.event_attendance ea
    join public.profile p on p.id = ea.profile_id
    join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = ea.profile_id
    where ea.event_id = p_event_id
      and ea.status in ('confirmed', 'waitlisted')
    union all
    select
      'member'::text,
      ea.profile_id,
      null::uuid,
      ea.status,
      null::integer,
      p.display_name,
      ea.did_attend,
      coalesce(f.paid_marked_at is not null, false)
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false),
      false,
      f.cash_paid_amount,
      f.credit_applied_amount,
      m.plays_as,
      m.stars,
      m.is_super_star,
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role,
      case
        when v_role in ('OWNER', 'ADMIN') then private.credit_balance(v_event.racha_id, ea.profile_id)
        when ea.profile_id = v_uid then v_my_credit
        else null
      end,
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit
    from public.event_attendance ea
    join public.profile p on p.id = ea.profile_id
    join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = ea.profile_id
    where ea.event_id = p_event_id
      and ea.status = 'cancelled'
      and coalesce(v_role in ('OWNER', 'ADMIN'), false)
    union all
    -- fatos sem attendance (saída/expulsão), só admin
    select
      'member'::text,
      f.profile_id,
      null::uuid,
      null::public.attendance_status,
      null::integer,
      p.display_name,
      f.did_attend,
      (
        f.paid_marked_at is not null
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false)
        or f.monthly_coverage_month is not null
      ),
      coalesce(f.monthly_coverage_month = v_year_month, false),
      f.cash_paid_amount,
      f.credit_applied_amount,
      coalesce(m.plays_as, 'OUTFIELD'::public.plays_as),
      m.stars,
      coalesce(m.is_super_star, false),
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role,
      private.credit_balance(v_event.racha_id, f.profile_id),
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit
    from public.event_payment_fact f
    join public.profile p on p.id = f.profile_id
    left join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = f.profile_id
    where f.event_id = p_event_id
      and coalesce(v_role in ('OWNER', 'ADMIN'), false)
      and not exists (
        select 1 from public.event_attendance ea
        where ea.event_id = p_event_id and ea.profile_id = f.profile_id
      )
    union all
    select
      'guest'::text,
      null::uuid,
      g.id,
      'confirmed'::public.attendance_status,
      null::integer,
      g.display_name,
      g.did_attend,
      g.is_paid,
      false,
      case when g.is_paid then v_event.price else null end,
      null::integer,
      g.plays_as,
      g.stars,
      g.is_super_star,
      null::text,
      g.primary_position,
      g.secondary_position,
      null::public.member_role,
      null::integer,
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit
    from public.event_guest g
    where g.event_id = p_event_id
    order by 1, 4 nulls last, 5 nulls last, 6;
end $$;

revoke execute on function public.list_event_attendance(uuid) from public, anon;
grant execute on function public.list_event_attendance(uuid) to authenticated;

-- --- logística / create / update event (+ payer_target) ---

create or replace function private.assert_payer_target(p_is_paid boolean, p_payer_target integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_is_paid then
    if p_payer_target is null then
      raise exception 'payer_target_required';
    end if;
    if p_payer_target <= 0 then
      raise exception 'payer_target_invalid';
    end if;
  end if;
end $$;

revoke execute on function private.assert_payer_target(boolean, integer)
  from public, anon, authenticated;

drop function if exists public.update_racha_logistics(
  uuid, text, smallint, time, smallint, boolean, integer, integer, smallint
);

create function public.update_racha_logistics(
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
    price = p_price,
    monthly_price = p_monthly_price,
    spot_limit = p_spot_limit,
    payer_target = case when p_is_paid then p_payer_target else r.payer_target end
  where r.id = p_racha_id;
end $$;

revoke execute on function public.update_racha_logistics(
  uuid, text, smallint, time, smallint, boolean, integer, integer, smallint, integer
) from public, anon;
grant execute on function public.update_racha_logistics(
  uuid, text, smallint, time, smallint, boolean, integer, integer, smallint, integer
) to authenticated;

drop function if exists public.create_event(
  uuid, date, time, text, boolean, integer, smallint
);

create function public.create_event(
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
    p_racha_id, p_starts_on, p_starts_at, btrim(p_place), p_is_paid, p_price, p_spot_limit,
    case when p_is_paid then v_target else null end,
    v_racha.reminder_lead_hours, v_racha.outfield_per_team, v_racha.game_mode,
    v_racha.max_consecutive_wins, v_racha.tie_rule, v_racha.tie_return_order,
    v_racha.consider_position, v_racha.match_duration_min
  ) returning id into v_event_id;

  return v_event_id;
end $$;

revoke execute on function public.create_event(
  uuid, date, time, text, boolean, integer, smallint, integer
) from public, anon;
grant execute on function public.create_event(
  uuid, date, time, text, boolean, integer, smallint, integer
) to authenticated;

drop function if exists public.update_event(
  uuid, date, time, text, boolean, integer, smallint
);

create function public.update_event(
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

  update public.event e set
    starts_on = p_starts_on,
    starts_at = p_starts_at,
    place = btrim(p_place),
    is_paid = p_is_paid,
    price = p_price,
    spot_limit = p_spot_limit,
    payer_target = case when p_is_paid then p_payer_target else e.payer_target end
  where e.id = p_event_id;

  perform private.promote_waitlist_for_event(p_event_id);
end $$;

revoke execute on function public.update_event(
  uuid, date, time, text, boolean, integer, smallint, integer
) from public, anon;
grant execute on function public.update_event(
  uuid, date, time, text, boolean, integer, smallint, integer
) to authenticated;

create or replace function private.create_next_recurring_event(
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
    racha_id, starts_on, starts_at, place, is_paid, price, spot_limit, payer_target,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    p_racha_id, v_next_date, v_racha.kickoff_time, v_racha.place,
    v_racha.is_paid, v_racha.price, v_racha.spot_limit,
    case when v_racha.is_paid then v_racha.payer_target else null end,
    v_racha.reminder_lead_hours, v_racha.outfield_per_team, v_racha.game_mode,
    v_racha.max_consecutive_wins, v_racha.tie_rule, v_racha.tie_return_order,
    v_racha.consider_position, v_racha.match_duration_min
  ) returning id into v_next_id;

  return v_next_id;
end $$;
