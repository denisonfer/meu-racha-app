begin;

create function pg_temp.make_caixa_event(
  p_racha_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_place text,
  p_status public.event_status default 'active',
  p_conductor_id uuid default null,
  p_spot_limit smallint default null,
  p_payer_target integer default 2
)
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
  select r.id, p_starts_on, p_starts_at, p_place, p_status, p_conductor_id,
    true, r.price, coalesce(p_spot_limit, r.spot_limit), p_payer_target,
    r.reminder_lead_hours, r.outfield_per_team, r.game_mode,
    r.max_consecutive_wins, r.tie_rule, r.tie_return_order,
    r.consider_position, r.match_duration_min
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
  v_racha uuid;
  v_event uuid;
  v_event2 uuid;
  v_future date := current_date + 21;
  v_past date := current_date - 7;
  v_balance integer;
  v_kind text;
  v_had boolean;
  v_err text;
  v_grant uuid;
  v_cycle uuid;
begin
  insert into auth.users (id, raw_user_meta_data)
  values
    (v_owner, '{"display_name":"Dono Caixa","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb),
    (v_p1, '{"display_name":"Jogador Um","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb),
    (v_p2, '{"display_name":"Jogador Dois","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb),
    (v_p3, '{"display_name":"Jogador Tres","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb);

  insert into public.racha
    (name, invite_code, place, weekday, kickoff_time, is_paid, price, spot_limit,
     monthly_price, outfield_per_team, payer_target)
  values ('Prova Caixa', 'ZZZZCX', 'Quadra Caixa', 1, '19:00', true, 50, 20,
          100, 5, 2)
  returning id into v_racha;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values
    (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_p1, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_p2, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_p3, 'PLAYER', 'OUTFIELD', 'ANY', 3);

  -- 1) Meta obrigatória no save pago
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  begin
    perform public.update_racha_logistics(
      v_racha,
      'Quadra Caixa',
      1::smallint,
      time '19:00',
      30::smallint,
      true,
      50,
      100,
      20::smallint,
      null::integer
    );
    raise exception 'expected_payer_target_required';
  exception when others then
    if sqlerrm not like '%payer_target_required%' then
      raise;
    end if;
  end;
  raise notice 'PASS: 1 payer_target_required sem Meta';

  -- 3) pagou waitlisted → had_slot false (teto 10 = 1 membro + 9 avulsos)
  v_event := pg_temp.make_caixa_event(
    v_racha, v_future, time '19:00', 'Quadra Caixa',
    'upcoming'::public.event_status, null::uuid, 10::smallint, 2
  );
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.confirm_attendance(v_event);
  for v_balance in 1..9 loop
    perform public.add_guest(
      v_event, 'Avulso Caixa ' || chr(64 + v_balance),
      'OUTFIELD'::public.plays_as, 'ANY'::public.position, null::public.position,
      3::smallint, false
    );
  end loop;
  perform set_config('request.jwt.claim.sub', v_p1::text, true);
  perform public.confirm_attendance(v_event);
  if (select status from public.event_attendance where event_id = v_event and profile_id = v_p1)
    <> 'waitlisted' then
    raise exception 'p1_not_waitlisted';
  end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_paid(v_event, v_p1, null, true);
  select had_slot_since_payment into v_had
  from public.event_payment_fact where event_id = v_event and profile_id = v_p1;
  if v_had is distinct from false then
    raise exception 'waitlisted_pay_had_slot_true';
  end if;
  raise notice 'PASS: 3 pagou na fila had_slot=false';

  -- promover → had_slot true (remove um avulso)
  perform public.remove_guest(
    (select id from public.event_guest where event_id = v_event limit 1)
  );
  select had_slot_since_payment into v_had
  from public.event_payment_fact where event_id = v_event and profile_id = v_p1;
  if v_had is distinct from true then
    raise exception 'promoted_had_slot_not_true';
  end if;
  raise notice 'PASS: 5 promoção liga had_slot';

  delete from public.event where id = v_event;

  -- 4) confirmed→cancel→waitlisted→pagou → fila
  v_event := pg_temp.make_caixa_event(
    v_racha, v_future, time '19:00', 'Quadra Caixa',
    'active'::public.event_status, v_owner, 10::smallint, 2
  );
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.confirm_attendance(v_event);
  for v_balance in 1..9 loop
    perform public.add_guest(
      v_event, 'Avulso Beta ' || chr(64 + v_balance),
      'OUTFIELD'::public.plays_as, 'ANY'::public.position, null::public.position,
      3::smallint, false
    );
  end loop;
  perform set_config('request.jwt.claim.sub', v_p2::text, true);
  perform public.confirm_attendance(v_event); -- waitlisted
  perform public.cancel_attendance(v_event);
  perform public.confirm_attendance(v_event); -- waitlisted de novo
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_paid(v_event, v_p2, null, true);
  select had_slot_since_payment into v_had
  from public.event_payment_fact where event_id = v_event and profile_id = v_p2;
  if v_had is distinct from false then
    raise exception 'case4_had_slot';
  end if;

  update public.event e set
    status = 'finished', ended_at = now(), ended_by = v_owner, ended_by_system = false
  where e.id = v_event;
  perform private.settle_event_credits(v_event);

  select entry_kind into v_kind
  from public.racha_credit_entry
  where source_event_id = v_event and profile_id = v_p2
    and entry_kind in ('absence_daily', 'waitlist_daily');
  if v_kind is distinct from 'waitlist_daily' then
    raise exception 'case4_not_waitlist_grant: %', v_kind;
  end if;
  raise notice 'PASS: 4 fila mesmo com confirmed antigo';

  -- 7) falta com Meta; Meta null não gera falta
  delete from public.racha_credit_entry where source_event_id = v_event;
  delete from public.event where id = v_event;

  v_event := pg_temp.make_caixa_event(
    v_racha, v_past, time '19:00', 'Quadra Caixa',
    'active'::public.event_status, v_owner, 10::smallint, 2
  );
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_p1::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_p3::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_paid(v_event, v_owner, null, true);
  perform public.set_attendance_paid(v_event, v_p1, null, true);
  perform public.set_attendance_attended(v_event, v_owner, null, true);
  perform public.set_attendance_attended(v_event, v_p1, null, true);
  -- p3 confirmed pago sem veio; Meta=2 e X=2 → falta
  perform public.set_attendance_paid(v_event, v_p3, null, true);

  update public.event e set
    status = 'finished', ended_at = now(), ended_by = v_owner, ended_by_system = false
  where e.id = v_event;
  perform private.settle_event_credits(v_event);

  select entry_kind into v_kind
  from public.racha_credit_entry
  where source_event_id = v_event and profile_id = v_p3
    and entry_kind in ('absence_daily', 'waitlist_daily');
  if v_kind is distinct from 'absence_daily' then
    raise exception 'absence_not_granted: %', v_kind;
  end if;
  raise notice 'PASS: 7 falta com Meta atingida';

  -- Meta null → falta não gera (reapurar após limpar grant e zerar meta)
  delete from public.racha_credit_entry
  where source_event_id = v_event and profile_id = v_p3
    and entry_kind = 'absence_daily';
  update public.event set payer_target = null where id = v_event;
  perform private.settle_event_credits(v_event);
  if exists (
    select 1 from public.racha_credit_entry
    where source_event_id = v_event and profile_id = v_p3
      and entry_kind = 'absence_daily'
  ) then
    raise exception 'null_meta_still_granted_absence';
  end if;
  raise notice 'PASS: Meta null não gera falta';

  -- 8) finish_event chama settle; upcoming delete não
  update public.event set payer_target = 2 where id = v_event;
  -- já finished; settle idempotente
  perform private.settle_event_credits(v_event);
  if (
    select count(*) from public.racha_credit_entry
    where source_event_id = v_event and profile_id = v_p3 and entry_kind = 'absence_daily'
  ) <> 1 then
    raise exception 'settle_not_idempotent';
  end if;
  raise notice 'PASS: 8 settle idempotente';

  v_event2 := pg_temp.make_caixa_event(
    v_racha, v_future, time '20:00', 'Quadra Caixa',
    'upcoming'::public.event_status, null::uuid, 10::smallint, 2
  );
  perform set_config('request.jwt.claim.sub', v_p1::text, true);
  perform public.confirm_attendance(v_event2);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_paid(v_event2, v_p1, null, true);
  perform public.cancel_event(v_event2);
  if exists (
    select 1 from public.racha_credit_entry
    where profile_id = v_p1 and entry_kind = 'waitlist_daily'
  ) then
    raise exception 'upcoming_cancel_used_waitlist_kind';
  end if;
  if not exists (
    select 1 from public.racha_credit_entry
    where profile_id = v_p1 and entry_kind = 'cancel_daily'
  ) then
    raise exception 'upcoming_cancel_missing_cancel_daily';
  end if;
  raise notice 'PASS: 8 upcoming usa cancel_daily da 5d';

  -- 11) cash + credit restore
  -- limpa saldo p2 e prepara grant prévio
  delete from public.racha_credit_entry where profile_id = v_p2;
  insert into public.racha_credit_entry (
    racha_id, profile_id, source_event_id, operation_key, entry_kind,
    amount_delta, expires_at
  ) values (
    v_racha, v_p2, v_event, 'seed:p2', 'cancel_daily', 20, now() + interval '6 months'
  ) returning id into v_grant;

  v_event2 := pg_temp.make_caixa_event(
    v_racha, v_past, time '18:00', 'Quadra Caixa',
    'active'::public.event_status, v_owner, 10::smallint, 1
  );
  perform set_config('request.jwt.claim.sub', v_p2::text, true);
  perform public.confirm_attendance(v_event2);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  -- fila paga sem vaga: spot 1, owner confirmed first
  perform public.confirm_attendance(v_event2);
  -- p2 already confirmed; cancel owner, keep p2; then cancel p2 and waitlist path:
  -- simpler: mark paid on waitlisted
  delete from public.event where id = v_event2;

  v_event2 := pg_temp.make_caixa_event(
    v_racha, v_past, time '18:00', 'Quadra Caixa',
    'active'::public.event_status, v_owner, 10::smallint, 1
  );
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.confirm_attendance(v_event2);
  for v_balance in 1..9 loop
    perform public.add_guest(
      v_event2, 'Avulso Gama ' || chr(64 + v_balance),
      'OUTFIELD'::public.plays_as, 'ANY'::public.position, null::public.position,
      3::smallint, false
    );
  end loop;
  perform set_config('request.jwt.claim.sub', v_p2::text, true);
  perform public.confirm_attendance(v_event2);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_paid(v_event2, v_p2, null, true);
  if (select cash_paid_amount from public.event_payment_fact
      where event_id = v_event2 and profile_id = v_p2) <> 30 then
    raise exception 'cash_not_30_after_credit';
  end if;
  if (select credit_applied_amount from public.event_payment_fact
      where event_id = v_event2 and profile_id = v_p2) <> 20 then
    raise exception 'credit_applied_not_20';
  end if;

  update public.event e set
    status = 'finished', ended_at = now(), ended_by = v_owner, ended_by_system = false
  where e.id = v_event2;
  perform private.settle_event_credits(v_event2);

  if not exists (
    select 1 from public.racha_credit_entry
    where source_event_id = v_event2 and profile_id = v_p2
      and entry_kind = 'waitlist_daily' and amount_delta = 30
  ) then
    raise exception 'waitlist_grant_30_missing';
  end if;
  if not exists (
    select 1 from public.racha_credit_entry
    where source_event_id = v_event2 and profile_id = v_p2
      and entry_kind = 'restore' and amount_delta = 20
  ) then
    raise exception 'restore_20_missing';
  end if;
  raise notice 'PASS: 11 grant cash + restore crédito';

  -- 10) credit_already_used bloqueia correção
  select payment_cycle_id into v_cycle
  from public.event_payment_fact where event_id = v_event2 and profile_id = v_p2;

  -- consome o grant waitlist noutro evento
  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id,
    is_paid, price, spot_limit, payer_target, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule,
    tie_return_order, consider_position, match_duration_min, ended_at, ended_by, ended_by_system
  )
  select r.id, v_past, time '17:00', 'X', 'finished', v_owner,
    true, 50, 10, 2, r.reminder_lead_hours, r.outfield_per_team, r.game_mode,
    r.max_consecutive_wins, r.tie_rule, r.tie_return_order, r.consider_position,
    r.match_duration_min, now(), v_owner, false
  from public.racha r where r.id = v_racha
  returning id into v_event;

  perform private.apply_credit_fifo(
    v_racha, v_p2, v_event, 'consume:other', 30
  );

  begin
    perform public.set_attendance_paid(v_event2, v_p2, null, false);
    raise exception 'expected_credit_already_used';
  exception when others then
    if sqlerrm not like '%credit_already_used%' then
      raise;
    end if;
  end;
  raise notice 'PASS: 10 credit_already_used bloqueia correção';

  -- 12) job de 12h com Partida aberta: descarta e encerra; settle uma vez
  v_event := pg_temp.make_caixa_event(
    v_racha, v_past, time '16:00', 'Quadra Caixa',
    'active'::public.event_status, v_owner, 10::smallint, 1
  );
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.confirm_attendance(v_event);
  perform public.set_attendance_paid(v_event, v_owner, null, true);
  perform public.set_attendance_attended(v_event, v_owner, null, true);
  perform set_config('request.jwt.claim.sub', v_p1::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_paid(v_event, v_p1, null, true);

  insert into public.event_sort (
    event_id, status, signature, version, leftover_ids, mode, goalkeepers_per_team,
    balance_score, balance_label, balance_diff, super_diff, capped_by_super,
    confirmed_at, confirmed_by
  ) values (
    v_event, 'confirmed', 'caixa-match', 1, '{}', 'normal', true,
    80, 'Equilibrado', 0, 0, false, now(), v_owner
  );

  insert into public.event_sort_team (event_id, team_number, queue_order)
  values (v_event, 1, 1), (v_event, 2, 2);

  insert into public.event_match (
    event_id, number, home_team_id, away_team_id, queue_before, started_by
  )
  select v_event, 1, t1.id, t2.id, '{}'::jsonb, v_owner
  from public.event_sort_team t1
  join public.event_sort_team t2 on t2.event_id = v_event and t2.queue_order = 2
  where t1.event_id = v_event and t1.queue_order = 1;

  perform private.process_overdue_events(now());

  if (select status from public.event where id = v_event) is distinct from 'finished'
     or not (select ended_by_system from public.event where id = v_event) then
    raise exception 'overdue_did_not_finish_event_with_open_match';
  end if;
  if (select status from public.event_match where event_id = v_event)
     is distinct from 'discarded' then
    raise exception 'overdue_did_not_discard_open_match';
  end if;

  v_balance := (
    select count(*)::integer from public.racha_credit_entry
    where source_event_id = v_event
  );
  if v_balance < 1 then
    raise exception 'overdue_settle_missing_entries';
  end if;
  perform private.settle_event_credits(v_event);
  if (
    select count(*)::integer from public.racha_credit_entry
    where source_event_id = v_event
  ) <> v_balance then
    raise exception 'overdue_settle_ran_more_than_once';
  end if;
  raise notice 'PASS: 12 job 12h descarta Partida aberta e settle uma vez';

  raise notice 'ALL_CAIXA_PASS';
end $$;

rollback;
