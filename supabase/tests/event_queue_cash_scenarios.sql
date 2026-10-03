-- Jornadas reais de fila e caixa. Toda a massa de teste é revertida no fim.
begin;

create function pg_temp.scenario_event(p_racha_id uuid, p_starts_on date)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id,
    is_paid, price, spot_limit, payer_target, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule,
    tie_return_order, consider_position, match_duration_min
  )
  select r.id, p_starts_on, time '19:00', r.place, 'active',
    (select m.profile_id from public.member m where m.racha_id = r.id and m.role = 'OWNER'),
    r.is_paid, r.price, r.spot_limit, r.payer_target, r.reminder_lead_hours,
    r.outfield_per_team, r.game_mode, r.max_consecutive_wins, r.tie_rule,
    r.tie_return_order, r.consider_position, r.match_duration_min
  from public.racha r where r.id = p_racha_id
  returning id into v_id;
  return v_id;
end $$;

do $$
declare
  v_owner uuid;
  v_daily uuid;
  v_monthly uuid;
  v_racha uuid;
  v_event uuid;
  v_guest uuid;
  v_day date := current_date + 21;
  v_month text;
  v_status public.attendance_status;
  v_pos integer;
  v_amount integer;
  v_kind text;
  v_error text;
begin
  -- 1. Racha grátis: 10 vagas, dois na fila, um avulso sai.
  v_owner := gen_random_uuid();
  v_daily := gen_random_uuid();
  v_monthly := gen_random_uuid();
  insert into auth.users (id, raw_user_meta_data)
  select u.id, jsonb_build_object('display_name', u.name, 'birth_date', '1990-01-01',
    'plays_as', 'OUTFIELD', 'primary_position', 'ANY', 'terms_accepted', true)
  from (values (v_owner, 'Dono Grátis'), (v_daily, 'Ana'), (v_monthly, 'Beto')) u(id, name);
  insert into public.racha (name, invite_code, place, weekday, kickoff_time,
    is_paid, price, spot_limit, monthly_price, outfield_per_team, payer_target)
  values ('Simulação Grátis', 'SFREAA', 'Quadra A', 1, time '19:00',
    false, null, 10, null, 5, null) returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_daily, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_monthly, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  v_event := pg_temp.scenario_event(v_racha, v_day);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.confirm_attendance(v_event);
  for v_amount in 1..9 loop
    v_guest := public.add_guest(v_event, 'Avulso ' || chr(64 + v_amount),
      'OUTFIELD'::public.plays_as, 'ANY'::public.position, null::public.position,
      3::smallint, false);
  end loop;
  perform set_config('request.jwt.claim.sub', v_daily::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_monthly::text, true);
  perform public.confirm_attendance(v_event);
  update public.event_attendance set waitlisted_at = now() - interval '2 minutes'
  where event_id = v_event and profile_id = v_daily;
  update public.event_attendance set waitlisted_at = now() - interval '1 minute'
  where event_id = v_event and profile_id = v_monthly;
  if (select count(*) from public.event_attendance where event_id = v_event and status = 'confirmed')
     + (select count(*) from public.event_guest where event_id = v_event) <> 10 then
    raise exception 'free_occupancy';
  end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  begin
    perform public.set_attendance_paid(v_event, v_daily, null, true);
    raise exception 'expected_free_payment_rejection';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'not_allowed' then raise; end if;
  end;
  perform public.remove_guest(v_guest);
  select status into v_status from public.event_attendance
  where event_id = v_event and profile_id = v_daily;
  if v_status <> 'confirmed' then raise exception 'free_fifo_promotion'; end if;
  select status into v_status from public.event_attendance
  where event_id = v_event and profile_id = v_monthly;
  if v_status <> 'waitlisted' then raise exception 'free_second_must_wait'; end if;
  perform public.finish_event(v_event);
  if exists (select 1 from public.event_payment_fact where event_id = v_event)
     or exists (select 1 from public.racha_credit_entry where source_event_id = v_event) then
    raise exception 'free_generated_cash';
  end if;
  raise notice 'PASS grátis: 10/10, FIFO, promoção, pagamento recusado e nenhum crédito';

  -- 2. Diária R$ 50: um pagante promovido falta; outro pagou e ficou na fila.
  v_owner := gen_random_uuid();
  v_daily := gen_random_uuid();
  v_monthly := gen_random_uuid();
  insert into auth.users (id, raw_user_meta_data)
  select u.id, jsonb_build_object('display_name', u.name, 'birth_date', '1990-01-01',
    'plays_as', 'OUTFIELD', 'primary_position', 'ANY', 'terms_accepted', true)
  from (values (v_owner, 'Dono Diária'), (v_daily, 'Caio'), (v_monthly, 'Duda')) u(id, name);
  insert into public.racha (name, invite_code, place, weekday, kickoff_time,
    is_paid, price, spot_limit, monthly_price, outfield_per_team, payer_target)
  values ('Simulação Diária', 'SPAAAA', 'Quadra B', 1, time '19:00',
    true, 50, 10, null, 5, 2) returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_daily, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_monthly, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  v_event := pg_temp.scenario_event(v_racha, v_day);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.confirm_attendance(v_event);
  for v_amount in 1..9 loop
    v_guest := public.add_guest(v_event, 'Avulso ' || chr(64 + v_amount),
      'OUTFIELD'::public.plays_as, 'ANY'::public.position, null::public.position,
      3::smallint, false);
  end loop;
  perform set_config('request.jwt.claim.sub', v_daily::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_monthly::text, true);
  perform public.confirm_attendance(v_event);
  update public.event_attendance set waitlisted_at = now() - interval '2 minutes'
  where event_id = v_event and profile_id = v_daily;
  update public.event_attendance set waitlisted_at = now() - interval '1 minute'
  where event_id = v_event and profile_id = v_monthly;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_paid(v_event, v_daily, null, true);
  perform public.set_attendance_paid(v_event, v_monthly, null, true);
  if (select count(*) from public.event_payment_fact
      where event_id = v_event and had_slot_since_payment) <> 0 then
    raise exception 'daily_waitlist_had_slot';
  end if;
  perform public.remove_guest(v_guest);
  if (select status from public.event_attendance
      where event_id = v_event and profile_id = v_daily) <> 'confirmed'
     or not (select had_slot_since_payment from public.event_payment_fact
      where event_id = v_event and profile_id = v_daily) then
    raise exception 'daily_promotion';
  end if;
  perform public.set_attendance_paid(v_event, v_owner, null, true);
  perform public.set_attendance_attended(v_event, v_owner, null, true);
  select id into v_guest from public.event_guest where event_id = v_event limit 1;
  perform public.set_attendance_paid(v_event, null, v_guest, true);
  perform public.set_attendance_attended(v_event, null, v_guest, true);
  if private.count_present_payers(v_event) <> 2 then raise exception 'daily_target'; end if;
  perform public.finish_event(v_event, true);
  select entry_kind, amount_delta into v_kind, v_amount
  from public.racha_credit_entry where source_event_id = v_event and profile_id = v_daily
    and entry_kind in ('absence_daily', 'waitlist_daily');
  if v_kind is distinct from 'absence_daily' or v_amount <> 50 then
    raise exception 'daily_absence_credit';
  end if;
  select entry_kind, amount_delta into v_kind, v_amount
  from public.racha_credit_entry where source_event_id = v_event and profile_id = v_monthly
    and entry_kind in ('absence_daily', 'waitlist_daily');
  if v_kind is distinct from 'waitlist_daily' or v_amount <> 50 then
    raise exception 'daily_waitlist_credit';
  end if;
  -- Numa semana sem pagantes presentes, a falta não gera crédito.
  v_event := pg_temp.scenario_event(v_racha, v_day + 7);
  perform public.confirm_attendance(v_event);
  perform public.set_attendance_paid(v_event, v_owner, null, true);
  perform public.finish_event(v_event, true);
  if exists (select 1 from public.racha_credit_entry
      where source_event_id = v_event and profile_id = v_owner
        and entry_kind = 'absence_daily') then
    raise exception 'daily_unmet_target_gave_absence_credit';
  end if;
  raise notice 'PASS diária: Meta 2, promoção, falta R$ 50, fila R$ 50 e Meta não atingida';

  -- 3. Mensalistas: diária entra primeiro na fila, mensalista ganha prioridade.
  v_owner := gen_random_uuid();
  v_daily := gen_random_uuid();
  v_monthly := gen_random_uuid();
  insert into auth.users (id, raw_user_meta_data)
  select u.id, jsonb_build_object('display_name', u.name, 'birth_date', '1990-01-01',
    'plays_as', 'OUTFIELD', 'primary_position', 'ANY', 'terms_accepted', true)
  from (values (v_owner, 'Dono Misto'), (v_daily, 'Eva Diária'), (v_monthly, 'Fábio Mensal')) u(id, name);
  insert into public.racha (name, invite_code, place, weekday, kickoff_time,
    is_paid, price, spot_limit, monthly_price, outfield_per_team, payer_target)
  values ('Simulação Mensal', 'SMNAAA', 'Quadra C', 1, time '19:00',
    true, 50, 10, 120, 5, 2) returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_daily, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_monthly, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  v_event := pg_temp.scenario_event(v_racha, v_day);
  v_month := private.event_civil_year_month(v_day, time '19:00');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.confirm_attendance(v_event);
  for v_amount in 1..9 loop
    v_guest := public.add_guest(v_event, 'Avulso ' || chr(64 + v_amount),
      'OUTFIELD'::public.plays_as, 'ANY'::public.position, null::public.position,
      3::smallint, false);
  end loop;
  perform set_config('request.jwt.claim.sub', v_daily::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_monthly::text, true);
  perform public.confirm_attendance(v_event);
  update public.event_attendance set waitlisted_at = now() - interval '2 minutes'
  where event_id = v_event and profile_id = v_daily;
  update public.event_attendance set waitlisted_at = now() - interval '1 minute'
  where event_id = v_event and profile_id = v_monthly;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_paid(v_event, v_daily, null, true);
  perform public.set_monthly_pass(v_racha, v_monthly, v_month, true);
  select queue_position into v_pos from public.list_event_attendance(v_event)
  where profile_id = v_monthly;
  if v_pos <> 1 then raise exception 'monthly_queue_priority'; end if;
  perform public.remove_guest(v_guest);
  if (select status from public.event_attendance
      where event_id = v_event and profile_id = v_monthly) <> 'confirmed'
     or (select status from public.event_attendance
      where event_id = v_event and profile_id = v_daily) <> 'waitlisted' then
    raise exception 'monthly_promotion_priority';
  end if;
  perform public.set_attendance_paid(v_event, v_owner, null, true);
  perform public.set_attendance_attended(v_event, v_owner, null, true);
  perform public.set_attendance_attended(v_event, v_monthly, null, true);
  if private.count_present_payers(v_event) <> 2 then raise exception 'monthly_target'; end if;
  perform public.finish_event(v_event, true);
  if not exists (select 1 from public.event_payment_fact
      where event_id = v_event and profile_id = v_monthly
        and monthly_coverage_month = v_month and paid_marked_at is null
        and cash_paid_amount = 0)
     or exists (select 1 from public.racha_credit_entry
      where source_event_id = v_event and profile_id = v_monthly)
  then
    raise exception 'monthly_daily_cash_or_credit';
  end if;
  select entry_kind, amount_delta into v_kind, v_amount
  from public.racha_credit_entry where source_event_id = v_event and profile_id = v_daily
    and entry_kind in ('absence_daily', 'waitlist_daily');
  if v_kind is distinct from 'waitlist_daily' or v_amount <> 50 then
    raise exception 'monthly_daily_waitlist_credit';
  end if;
  if private.member_has_event_monthly_pass(
      pg_temp.scenario_event(v_racha, (v_day + interval '1 month')::date), v_monthly) then
    raise exception 'monthly_pass_leaked_next_month';
  end if;
  raise notice 'PASS mensalistas: prioridade, cobertura na Meta, diária na fila R$ 50, sem crédito mensal';
end $$;

rollback;
