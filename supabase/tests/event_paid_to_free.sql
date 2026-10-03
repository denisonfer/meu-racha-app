-- Pago -> grátis: pagamentos saem da apuração; Crédito aplicado volta ao grant original.
begin;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_cash uuid := gen_random_uuid();
  v_mixed uuid := gen_random_uuid();
  v_monthly uuid := gen_random_uuid();
  v_racha uuid;
  v_event uuid;
  v_existing uuid;
  v_next uuid;
  v_guest uuid;
  v_grant uuid;
  v_day date := current_date + 21;
  v_month text;
  v_error text;
begin
  insert into auth.users (id, raw_user_meta_data)
  select u.id, jsonb_build_object('display_name', u.name, 'birth_date', '1990-01-01',
    'plays_as', 'OUTFIELD', 'primary_position', 'ANY', 'terms_accepted', true)
  from (values (v_owner, 'Dono Grátis'), (v_cash, 'João Dinheiro'),
    (v_mixed, 'Ana Misto'), (v_monthly, 'Beto Mensal')) u(id, name);

  insert into public.racha (name, invite_code, place, weekday, kickoff_time,
    is_paid, price, monthly_price, spot_limit, outfield_per_team, payer_target)
  values ('Simulação Estorno', 'SMTAAA', 'Quadra A', 1, time '19:00',
    true, 50, 120, 10, 5, 2) returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_cash, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_mixed, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_monthly, 'PLAYER', 'OUTFIELD', 'ANY', 3);

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_event := public.create_event(v_racha, v_day, time '19:00', 'Quadra A',
    true, 50, 10::smallint, 2);
  v_month := private.event_civil_year_month(v_day, time '19:00');
  perform public.set_monthly_pass(v_racha, v_monthly, v_month, true);
  perform public.confirm_attendance(v_event);
  perform public.set_attendance_for_member(v_event, v_cash, 'confirmed');
  perform public.set_attendance_for_member(v_event, v_mixed, 'confirmed');
  perform public.set_attendance_for_member(v_event, v_monthly, 'confirmed');
  v_guest := public.add_guest(v_event, 'Avulso Pago',
    'OUTFIELD'::public.plays_as, 'ANY'::public.position, null::public.position,
    3::smallint, false);

  insert into public.racha_credit_entry (racha_id, profile_id, source_event_id,
    operation_key, entry_kind, amount_delta, expires_at)
  values (v_racha, v_mixed, gen_random_uuid(), 'sim:free:old',
    'cancel_daily', 20, now() + interval '3 months') returning id into v_grant;

  perform public.set_attendance_paid(v_event, v_cash, null, true);
  perform public.set_attendance_paid(v_event, v_mixed, null, true);
  perform public.set_attendance_paid(v_event, null, v_guest, true);
  if (select cash_paid_amount from public.event_payment_fact
      where event_id = v_event and profile_id = v_cash) <> 50
     or (select cash_paid_amount from public.event_payment_fact
      where event_id = v_event and profile_id = v_mixed) <> 30
     or (select credit_applied_amount from public.event_payment_fact
      where event_id = v_event and profile_id = v_mixed) <> 20
     or private.credit_balance(v_racha, v_mixed) <> 0 then
    raise exception 'fixture_payment';
  end if;

  -- Falha de validação não pode desfazer parte dos pagamentos.
  begin
    perform public.update_event(v_event, v_day + 35, time '19:00', 'Quadra A',
      false, null, 10::smallint, null);
    raise exception 'expected_event_month_locked';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'event_month_locked' then raise; end if;
  end;
  if (select count(*) from public.event_payment_fact where event_id = v_event) <> 3
     or private.credit_balance(v_racha, v_mixed) <> 0 then
    raise exception 'failed_save_changed_payment';
  end if;
  raise notice 'PASS edição rejeitada: pagamento e Crédito aplicado intactos';

  -- A mudança para grátis limpa dinheiro registrado, cobertura mensal e avulso.
  perform public.update_event(v_event, v_day, time '19:00', 'Quadra A',
    false, 50, 10::smallint, 2);
  if (select is_paid or price is not null or payer_target is not null
      from public.event where id = v_event)
     or exists (select 1 from public.event_payment_fact where event_id = v_event)
     or exists (select 1 from public.racha_credit_entry
      where source_event_id = v_event and entry_kind = 'apply')
     or (select is_paid from public.event_guest where id = v_guest)
     or private.credit_balance(v_racha, v_mixed) <> 20
     or private.grant_remaining(v_grant) <> 20 then
    raise exception 'free_transition_failed';
  end if;
  if exists (select 1 from public.list_event_attendance(v_event)
      where profile_id in (v_cash, v_mixed, v_monthly)
        and (is_paid_effective or is_monthly_pass)) then
    raise exception 'free_attendance_still_paid';
  end if;
  raise notice 'PASS Evento grátis: dinheiro desmarcado, Crédito aplicado devolvido, avulso e mensal sem Pago';

  -- Voltar a Pago inicia novo ciclo; só a cobertura mensal ainda válida reaparece.
  perform public.update_event(v_event, v_day, time '19:00', 'Quadra A',
    true, 50, 10::smallint, 2);
  if exists (select 1 from public.event_payment_fact
      where event_id = v_event and profile_id in (v_cash, v_mixed))
     or not exists (select 1 from public.event_payment_fact
      where event_id = v_event and profile_id = v_monthly
        and monthly_coverage_month = v_month)
     or (select is_paid from public.event_guest where id = v_guest) then
    raise exception 'old_payment_reappeared';
  end if;
  perform public.update_event(v_event, v_day, time '19:00', 'Quadra A',
    false, null, 10::smallint, null);
  perform public.cancel_event(v_event);
  if exists (select 1 from public.racha_credit_entry
      where source_event_id = v_event and entry_kind in
        ('cancel_daily', 'absence_daily', 'waitlist_daily', 'restore'))
     or private.credit_balance(v_racha, v_cash) <> 0
     or private.credit_balance(v_racha, v_mixed) <> 20 then
    raise exception 'cancel_after_free_credited_refunded_money';
  end if;
  raise notice 'PASS cancelamento posterior: nenhum Crédito pelo dinheiro devolvido fora do app';

  -- Mudar só o default do Racha mantém o snapshot do Evento existente.
  select e.id into v_existing from public.event e
  where e.racha_id = v_racha and e.status = 'upcoming';
  if v_existing is null then raise exception 'recurrence_missing'; end if;
  perform public.set_monthly_pass(
    v_racha, v_monthly,
    (select private.event_civil_year_month(e.starts_on, e.starts_at)
     from public.event e where e.id = v_existing),
    true
  );
  perform public.update_racha_logistics(v_racha, 'Quadra A', 1::smallint,
    time '19:00', 30::smallint, false, 50, 120, 10::smallint, 2);
  if (select is_paid or price is not null or monthly_price is not null
      or payer_target is not null from public.racha where id = v_racha)
     or not (select is_paid and price = 50 and payer_target = 2
      from public.event where id = v_existing)
     or not private.member_has_event_monthly_pass(v_existing, v_monthly)
     or not exists (select 1 from public.racha_monthly_pass
      where racha_id = v_racha and profile_id = v_monthly and year_month = v_month)
     or private.credit_balance(v_racha, v_mixed) <> 20 then
    raise exception 'racha_free_snapshot_or_balance';
  end if;
  perform public.cancel_event(v_existing);
  select e.id into v_next from public.event e
  where e.racha_id = v_racha and e.status = 'upcoming';
  if v_next is null
     or (select is_paid or price is not null or payer_target is not null
      from public.event where id = v_next) then
    raise exception 'next_event_not_free';
  end if;
  raise notice 'PASS Racha grátis: valores apagados, Evento anterior intacto, próximo grátis, passe e saldo preservados';

  -- Simula Evento ativo legado: mesmo após encerrar, dinheiro devolvido não vira Crédito.
  update public.event set status = 'active', conductor_id = v_owner where id = v_next;
  select starts_on into v_day from public.event where id = v_next;
  perform public.update_event(v_next, v_day, time '19:00', 'Quadra A',
    true, 50, 10::smallint, 2);
  perform public.set_attendance_for_member(v_next, v_mixed, 'confirmed');
  perform public.set_attendance_paid(v_next, v_mixed, null, true);
  if private.credit_balance(v_racha, v_mixed) <> 0 then
    raise exception 'active_payment_did_not_apply_credit';
  end if;
  perform public.update_event(v_next, v_day, time '19:00', 'Quadra A',
    false, null, 10::smallint, null);
  perform public.finish_event(v_next);
  if private.credit_balance(v_racha, v_mixed) <> 20
     or exists (select 1 from public.event_payment_fact where event_id = v_next)
     or exists (select 1 from public.racha_credit_entry
      where source_event_id = v_next) then
    raise exception 'finished_free_event_settled_payment';
  end if;
  raise notice 'PASS Evento ativo encerrado grátis: aplicação desfeita e nenhuma concessão nova';
end $$;

rollback;
