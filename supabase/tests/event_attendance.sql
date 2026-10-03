begin;

create function pg_temp.make_proof_event(
  p_racha_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_place text,
  p_status public.event_status default 'upcoming',
  p_conductor_id uuid default null,
  p_spot_limit smallint default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id,
    is_paid, price, spot_limit, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule,
    tie_return_order, consider_position, match_duration_min
  )
  select r.id, p_starts_on, p_starts_at, p_place, p_status, p_conductor_id,
    r.is_paid, r.price, coalesce(p_spot_limit, r.spot_limit), r.reminder_lead_hours,
    r.outfield_per_team, r.game_mode, r.max_consecutive_wins, r.tie_rule,
    r.tie_return_order, r.consider_position, r.match_duration_min
  from public.racha r where r.id = p_racha_id
  returning id into v_id;
  return v_id;
end $$;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid();
  v_p2 uuid := gen_random_uuid();
  v_p3 uuid := gen_random_uuid();
  v_p4 uuid := gen_random_uuid();
  v_racha uuid;
  v_event uuid;
  v_future date;
  v_year_month text;
  v_status public.attendance_status;
  v_credit_applied integer;
  v_cash_paid integer;
  v_credit_balance integer;
  v_cnt integer;
  v_grant_id uuid;
  v_apply_grant_id uuid;
begin
  v_future := current_date + 14;

  insert into auth.users (id, raw_user_meta_data)
  values
    (v_owner, '{"display_name":"Dono Presenca","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb),
    (v_p1, '{"display_name":"Primeiro Jogador","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb),
    (v_p2, '{"display_name":"Segundo Jogador","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb),
    (v_p3, '{"display_name":"Terceiro Jogador","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb),
    (v_p4, '{"display_name":"Quarto Jogador","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb);

  insert into public.racha
    (name, invite_code, place, weekday, kickoff_time, is_paid, price, spot_limit, monthly_price, outfield_per_team)
  values ('Prova Presenca', 'ZZZZPA', 'Quadra Presenca', 1, '19:00', true, 50, 10, 100, 5)
  returning id into v_racha;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values
    (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_p1, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_p2, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_p3, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_p4, 'PLAYER', 'OUTFIELD', 'ANY', 3);

  v_event := pg_temp.make_proof_event(
    v_racha, v_future, time '19:00', 'Quadra Presenca',
    'upcoming'::public.event_status, null::uuid, 10::smallint
  );
  v_year_month := private.event_civil_year_month(v_future, time '19:00');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_p1::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  for v_cnt in 1..8 loop
    perform public.add_guest(
      v_event,
      'Avulso ' || chr(64 + v_cnt),
      'OUTFIELD'::public.plays_as,
      'ANY'::public.position,
      null::public.position,
      3::smallint,
      false
    );
  end loop;
  perform set_config('request.jwt.claim.sub', v_p2::text, true);
  perform public.confirm_attendance(v_event);

  if (select status from public.event_attendance where event_id = v_event and profile_id = v_p2)
    <> 'waitlisted' then
    raise exception 'third_confirm_not_waitlisted';
  end if;
  if private.event_occupancy(v_event) <> 10 then
    raise exception 'occupancy_not_at_limit';
  end if;
  -- confirmed_count nos cards = ocupação (2 membros + 8 Avulsos), não só membros.
  if (select confirmed_count from public.list_open_events(v_racha) where id = v_event) <> 10 then
    raise exception 'list_open_events_confirmed_count_not_occupancy';
  end if;
  if (select confirmed_count from public.list_my_racha_events() where id = v_event) <> 10 then
    raise exception 'list_my_racha_events_confirmed_count_not_occupancy';
  end if;
  raise notice 'PASS: confirmar até teto coloca o terceiro na fila';

  perform set_config('request.jwt.claim.sub', v_p3::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_p4::text, true);
  perform public.confirm_attendance(v_event);

  -- Garante FIFO determinístico entre p2 e p4 (mesmo now() no insert).
  update public.event_attendance set waitlisted_at = now() - interval '2 minutes'
  where event_id = v_event and profile_id = v_p2 and status = 'waitlisted';
  update public.event_attendance set waitlisted_at = now() - interval '1 minute'
  where event_id = v_event and profile_id = v_p4 and status = 'waitlisted';

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_monthly_pass(v_racha, v_p3, v_year_month, true);

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  delete from public.event_guest g
  where g.event_id = v_event and g.display_name = 'Avulso A';
  perform private.promote_waitlist_for_event(v_event);

  select status into strict v_status from public.event_attendance
  where event_id = v_event and profile_id = v_p3;
  if v_status <> 'confirmed' then
    raise exception 'monthly_not_promoted_first';
  end if;
  if (select status from public.event_attendance where event_id = v_event and profile_id = v_p2)
    <> 'waitlisted' then
    raise exception 'fifo_member_still_waitlisted';
  end if;
  if (select status from public.event_attendance where event_id = v_event and profile_id = v_p4)
    <> 'waitlisted' then
    raise exception 'p4_still_waitlisted';
  end if;
  raise notice 'PASS: remoção de Avulso promove Mensalista antes do FIFO';

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  begin
    perform public.add_guest(
      v_event, 'Avulso Teste', 'OUTFIELD'::public.plays_as, 'ANY'::public.position,
      null::public.position, 3::smallint, false
    );
    raise exception 'guest_should_fail_with_waitlist';
  exception when others then
    if sqlerrm <> 'spot_limit' then raise; end if;
  end;
  raise notice 'PASS: add_guest com fila ativa retorna spot_limit';

  begin
    perform public.update_event(
      v_event, v_future, time '19:00', 'Quadra Presenca', true, 50, 5::smallint
    );
    raise exception 'spot_limit_below_occupancy_succeeded';
  exception when others then
    if sqlerrm <> 'spot_limit_below_occupancy' then raise; end if;
  end;
  raise notice 'PASS: update_event recusa spot_limit abaixo da ocupação';

  begin
    perform public.set_attendance_attended(v_event, v_p2, null, true);
    raise exception 'attended_waitlisted_succeeded';
  exception when others then
    if sqlerrm <> 'not_confirmed' then raise; end if;
  end;
  raise notice 'PASS: veio em waitlisted retorna not_confirmed';

  begin
    perform public.set_attendance_paid(v_event, v_p3, null, false);
    raise exception 'mensalista_unpay_succeeded';
  exception when others then
    if sqlerrm <> 'mensalista_paid' then raise; end if;
  end;
  raise notice 'PASS: desmarcar pago de Mensalista retorna mensalista_paid';

  begin
    perform public.update_event(
      v_event, v_future + 35, time '19:00', 'Quadra Presenca', true, 50, 10::smallint
    );
    raise exception 'month_move_with_monthly_coverage_succeeded';
  exception when others then
    if sqlerrm <> 'event_month_locked' then raise; end if;
  end;
  raise notice 'PASS: monthly_coverage_month trava mudança de mês civil';

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_monthly_pass(v_racha, v_p3, v_year_month, false);
  if exists (
    select 1 from public.event_payment_fact
    where event_id = v_event and profile_id = v_p3
      and monthly_coverage_month is not null
  ) then
    raise exception 'pass_disable_did_not_clear_coverage';
  end if;
  perform public.set_monthly_pass(v_racha, v_p3, v_year_month, true);
  raise notice 'PASS: desmarcar passe limpa monthly_coverage_month em Evento aberto';

  update public.racha set monthly_price = null where id = v_racha;
  begin
    perform public.set_monthly_pass(v_racha, v_p2, v_year_month, true);
    raise exception 'monthly_without_price_succeeded';
  exception when others then
    if sqlerrm <> 'monthly_price_required' then raise; end if;
  end;
  update public.racha set monthly_price = 100 where id = v_racha;
  raise notice 'PASS: mensalista exige monthly_price';

  insert into public.racha_credit_entry (
    racha_id, profile_id, source_event_id, operation_key, entry_kind, amount_delta, expires_at
  ) values (
    v_racha, v_p1, v_event, 'proof:grant:p1', 'cancel_daily', 30, now() + interval '6 months'
  ) returning id into v_grant_id;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_paid(v_event, v_p1, null, true);

  select credit_applied_amount, cash_paid_amount into strict v_credit_applied, v_cash_paid
  from public.event_payment_fact where event_id = v_event and profile_id = v_p1;
  if v_credit_applied <> 30 or v_cash_paid <> 20 then
    raise exception 'credit_apply_wrong_split';
  end if;

  select source_grant_id into v_apply_grant_id
  from public.racha_credit_entry
  where entry_kind = 'apply'
    and source_event_id = v_event
    and profile_id = v_p1;
  if v_apply_grant_id is distinct from v_grant_id then
    raise exception 'credit_apply_missing_source_grant';
  end if;
  raise notice 'PASS: marcar pago aplica crédito FIFO com source_grant_id';

  -- Ciclo desmarcar → remarcar: apply removida no unpay; rematch reaplica de verdade.
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_paid(v_event, v_p1, null, false);
  if private.grant_remaining(v_grant_id) <> 30 then
    raise exception 'unpay_did_not_restore_grant';
  end if;
  if exists (
    select 1 from public.racha_credit_entry
    where entry_kind = 'apply' and source_event_id = v_event and profile_id = v_p1
  ) then
    raise exception 'unpay_left_apply_rows';
  end if;
  if exists (
    select 1 from public.event_payment_fact
    where event_id = v_event and profile_id = v_p1
  ) then
    raise exception 'unpay_left_payment_fact';
  end if;

  perform public.set_attendance_paid(v_event, v_p1, null, true);
  select credit_applied_amount, cash_paid_amount into strict v_credit_applied, v_cash_paid
  from public.event_payment_fact where event_id = v_event and profile_id = v_p1;
  if v_credit_applied <> 30 or v_cash_paid <> 20 then
    raise exception 'repay_credit_split_wrong';
  end if;
  if private.grant_remaining(v_grant_id) <> 0 then
    raise exception 'repay_grant_remaining_still_positive';
  end if;
  if not exists (
    select 1 from public.racha_credit_entry
    where entry_kind = 'apply'
      and source_grant_id = v_grant_id
      and amount_delta = -30
      and source_event_id = v_event
  ) then
    raise exception 'repay_missing_apply_row';
  end if;
  raise notice 'PASS: desmarcar→remarcar pago reaplica crédito (grant_remaining coerente)';

  -- Desmarcar passe não sobrescreve diária já paga.
  perform public.set_monthly_pass(v_racha, v_p1, v_year_month, true);
  perform public.set_monthly_pass(v_racha, v_p1, v_year_month, false);
  select credit_applied_amount, cash_paid_amount into strict v_credit_applied, v_cash_paid
  from public.event_payment_fact where event_id = v_event and profile_id = v_p1;
  if v_credit_applied <> 30 or v_cash_paid <> 20 then
    raise exception 'pass_disable_overwrote_daily_payment';
  end if;
  raise notice 'PASS: desmarcar passe não sobrescreve diária já paga';

  perform private.process_event_cancellation_credits(v_event, v_racha);
  perform private.process_event_cancellation_credits(v_event, v_racha);
  select count(*) into v_cnt from public.racha_credit_entry
  where operation_key = format('cancel_event:%s:restore:%s:%s', v_event, v_p1, v_grant_id);
  if v_cnt <> 1 then
    raise exception 'credit_restore_not_idempotent';
  end if;
  if not exists (
    select 1 from public.racha_credit_entry
    where entry_kind = 'restore'
      and source_grant_id = v_grant_id
      and amount_delta = 30
      and source_event_id = v_event
  ) then
    raise exception 'credit_restore_not_exact_parcel';
  end if;
  raise notice 'PASS: restauração de crédito restaura parcela exata e não duplica no retry';

  -- Reabre o fato para as provas seguintes (process_event_cancellation_credits marcou cancelled_at).
  update public.event_payment_fact f set cancelled_at = null
  where f.event_id = v_event and f.profile_id = v_p1;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  begin
    perform public.update_event(
      v_event, v_future + 35, time '19:00', 'Quadra Presenca', true, 50, 10::smallint
    );
    raise exception 'month_move_with_payment_succeeded';
  exception when others then
    if sqlerrm <> 'event_month_locked' then raise; end if;
  end;
  raise notice 'PASS: update_event recusa mudança de mês com pagamento registrado';

  perform set_config('request.jwt.claim.sub', v_p3::text, true);
  perform public.leave_racha(v_racha);

  if (select status from public.event_attendance where event_id = v_event and profile_id = v_p2)
    <> 'confirmed' then
    raise exception 'leave_racha_did_not_promote';
  end if;
  if exists (
    select 1 from public.event_attendance where event_id = v_event and profile_id = v_p3
  ) then
    raise exception 'leave_racha_left_attendance_row';
  end if;
  raise notice 'PASS: leave_racha remove presença e promove a fila';

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.update_event(
    v_event, v_future, time '19:00', 'Quadra Presenca', true, 50, 12::smallint
  );
  if (select status from public.event_attendance where event_id = v_event and profile_id = v_p4)
    <> 'confirmed' then
    raise exception 'spot_limit_increase_did_not_promote';
  end if;
  raise notice 'PASS: aumento de spot_limit promove da fila';

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.cancel_event(v_event);
  select coalesce(sum(amount_delta), 0) into v_credit_balance
  from public.racha_credit_entry
  where racha_id = v_racha and profile_id = v_p1
    and entry_kind = 'cancel_daily';
  if v_credit_balance < 20 then
    raise exception 'cancel_event_no_daily_credit';
  end if;
  raise notice 'PASS: cancel_event gera crédito da diária paga em dinheiro';
end $$;

rollback;
