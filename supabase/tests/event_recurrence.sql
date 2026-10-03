\set ON_ERROR_STOP on
begin;

create function pg_temp.make_proof_event(
  p_racha_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_place text,
  p_status public.event_status default 'upcoming',
  p_conductor_id uuid default null
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
    r.is_paid, r.price, r.spot_limit, r.reminder_lead_hours,
    r.outfield_per_team, r.game_mode, r.max_consecutive_wins, r.tie_rule,
    r.tie_return_order, r.consider_position, r.match_duration_min
  from public.racha r where r.id = p_racha_id
  returning id into v_id;
  return v_id;
end $$;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_recurring uuid;
  v_occupied uuid;
  v_one_off uuid;
  v_automatic uuid;
  v_invalid_place uuid;
  v_source uuid;
  v_active uuid;
  v_upcoming uuid;
  v_source_date date;
  v_next public.event%rowtype;
  v_deadline timestamptz := '2026-10-02 10:00:00+00';
begin
  if ((date '2026-10-05' + time '19:00') at time zone 'America/Sao_Paulo')
    <> '2026-10-05 22:00:00+00'::timestamptz then
    raise exception 'timezone_conversion_failed';
  end if;

  insert into auth.users (id, raw_user_meta_data)
  values
    (v_owner, '{"display_name":"Prova Recorrencia","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb),
    (v_other, '{"display_name":"Outra Pessoa","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb);

  insert into public.racha
    (name, invite_code, place, weekday, kickoff_time, is_paid, price, monthly_price)
  values ('Prova Recorrente', 'ZZZZQA', 'Quadra Antiga', 1, '19:00', false, null, 20)
  returning id into v_recurring;
  insert into public.racha
    (name, invite_code, place, weekday, kickoff_time)
  values ('Prova Ocupada', 'ZZZZQB', 'Quadra', 1, '19:00')
  returning id into v_occupied;
  insert into public.racha (name, invite_code, place)
  values ('Prova Avulsa', 'ZZZZQC', 'Quadra')
  returning id into v_one_off;
  insert into public.racha
    (name, invite_code, place, weekday, kickoff_time)
  values ('Prova Automatica', 'ZZZZQD', 'Quadra', 4, '19:00')
  returning id into v_automatic;
  insert into public.racha
    (name, invite_code, place, weekday, kickoff_time)
  values ('Prova Sem Local', 'ZZZZQE', 'A definir', 1, '19:00')
  returning id into v_invalid_place;

  insert into public.member
    (racha_id, profile_id, role, plays_as, primary_position, stars)
  select r.id, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3
  from public.racha r
  where r.id in (v_recurring, v_occupied, v_one_off, v_automatic, v_invalid_place);
  if exists (select 1 from public.event
    where racha_id in (v_recurring, v_occupied, v_one_off, v_automatic, v_invalid_place)) then
    raise exception 'configured_slot_created_first_event';
  end if;

  v_source_date := current_date
    + ((1 - extract(isodow from current_date)::integer + 7) % 7) + 7;
  v_source := pg_temp.make_proof_event(v_recurring, v_source_date, '19:00', 'Quadra Antiga');
  update public.racha set
    place = 'Quadra Nova', is_paid = true, price = 40, monthly_price = 100,
    reminder_lead_hours = 3, outfield_per_team = 6,
    game_mode = 'ROTATION', consider_position = true
  where id = v_recurring;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  begin
    perform public.cancel_event(v_source);
    raise exception 'unauthorized_cancel_succeeded';
  exception when others then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.cancel_event(v_source);
  if exists (select 1 from public.event where id = v_source) then
    raise exception 'manual_cancel_did_not_delete';
  end if;
  select * into strict v_next from public.event
  where racha_id = v_recurring and status = 'upcoming';
  if v_next.starts_on <> v_source_date + 7 or v_next.starts_at <> time '19:00'
    or v_next.place <> 'Quadra Nova' or not v_next.is_paid or v_next.price <> 40
    or v_next.reminder_lead_hours <> 3 or v_next.outfield_per_team <> 6
    or v_next.game_mode <> 'ROTATION' or not v_next.consider_position
    or (v_next.starts_on + v_next.starts_at) at time zone 'America/Sao_Paulo'
      <= greatest((v_source_date + time '19:00') at time zone 'America/Sao_Paulo', now()) then
    raise exception 'manual_cancel_next_event_wrong';
  end if;
  if (select count(*) from public.event where racha_id = v_recurring) <> 1 then
    raise exception 'manual_cancel_duplicated';
  end if;
  raise notice 'PASS: cancelamento manual, fuso, semana seguinte e defaults atuais';

  delete from public.event where id = v_next.id;
  v_active := pg_temp.make_proof_event(v_recurring, v_source_date, '19:00', 'Quadra Nova', 'active', v_owner);
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  begin
    perform public.finish_event(v_active);
    raise exception 'unauthorized_finish_succeeded';
  exception when others then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.finish_event(v_active, true);
  select * into strict v_next from public.event
  where racha_id = v_recurring and status = 'upcoming';
  if v_next.starts_on <> v_source_date + 7
    or not exists (select 1 from public.event where id = v_active
      and status = 'finished' and ended_by = v_owner and not ended_by_system) then
    raise exception 'manual_finish_next_event_wrong';
  end if;
  raise notice 'PASS: encerramento manual recorrente cria o proximo';

  v_active := pg_temp.make_proof_event(v_occupied, v_source_date, '19:00', 'Quadra', 'active', v_owner);
  v_upcoming := pg_temp.make_proof_event(v_occupied, v_source_date + 7, '19:00', 'Quadra');
  perform public.finish_event(v_active, true);
  if not exists (
    select 1 from public.event where id = v_active and status = 'finished'
      and ended_by = v_owner and not ended_by_system and ended_at is not null
  ) or (select count(*) from public.event where racha_id = v_occupied and status = 'upcoming') <> 1
    or not exists (select 1 from public.event where id = v_upcoming) then
    raise exception 'manual_finish_or_occupied_slot_failed';
  end if;
  raise notice 'PASS: encerramento manual e vaga upcoming ocupada';

  v_source := pg_temp.make_proof_event(v_one_off, v_source_date, '19:00', 'Quadra');
  perform public.cancel_event(v_source);
  if exists (select 1 from public.event where racha_id = v_one_off) then
    raise exception 'nonrecurring_created_event';
  end if;
  raise notice 'PASS: sem recorrencia nao cria Evento';

  v_source := pg_temp.make_proof_event(v_automatic, '2026-10-01', '19:00', 'Quadra', 'upcoming', v_owner);
  perform private.process_overdue_events(v_deadline - interval '1 second');
  if not exists (select 1 from public.event where id = v_source and status = 'upcoming') then
    raise exception 'upcoming_closed_before_12h';
  end if;
  perform private.process_overdue_events(v_deadline);
  if exists (select 1 from public.event where id = v_source) then
    raise exception 'upcoming_not_deleted_at_12h';
  end if;
  select * into strict v_next from public.event
  where racha_id = v_automatic and status = 'upcoming';
  if v_next.starts_on <> date '2026-10-08' or v_next.starts_at <> time '19:00' then
    raise exception 'automatic_successor_wrong';
  end if;
  perform private.process_overdue_events(v_deadline);
  if (select count(*) from public.event where racha_id = v_automatic) <> 1 then
    raise exception 'cron_not_idempotent';
  end if;
  raise notice 'PASS: fronteira 12h, upcoming com Condutor e cron idempotente';

  delete from public.event where id = v_next.id;
  v_active := pg_temp.make_proof_event(v_automatic, '2026-10-01', '19:00', 'Quadra', 'active', v_owner);
  perform private.process_overdue_events(v_deadline);
  select * into strict v_next from public.event
  where racha_id = v_automatic and status = 'upcoming';
  if v_next.starts_on <> date '2026-10-08'
    or not exists (select 1 from public.event where id = v_active
      and status = 'finished' and ended_at = v_deadline
      and ended_by is null and ended_by_system) then
    raise exception 'automatic_finish_next_event_wrong';
  end if;
  raise notice 'PASS: encerramento automatico recorrente cria o proximo';

  v_active := pg_temp.make_proof_event(v_one_off, '2026-10-01', '19:00', 'Quadra', 'active', v_owner);
  perform private.process_overdue_events(v_deadline);
  if not exists (
    select 1 from public.event where id = v_active and status = 'finished'
      and ended_at = v_deadline and ended_by is null and ended_by_system
  ) then
    raise exception 'automatic_finish_actor_failed';
  end if;
  raise notice 'PASS: active encerra com autoria do sistema';

  v_source := pg_temp.make_proof_event(v_invalid_place, v_source_date, '19:00', 'Quadra Temporaria');
  perform public.cancel_event(v_source);
  if exists (select 1 from public.event where id = v_source)
    or exists (select 1 from public.event where racha_id = v_invalid_place)
    or not exists (
      select 1 from private.event_recurring_issue
      where racha_id = v_invalid_place and source_event_id = v_source
        and reason = 'missing_place'
    ) then
    raise exception 'invalid_place_blocked_close_or_not_recorded';
  end if;
  raise notice 'PASS: local legado invalido nao bloqueia, ocorrencia registrada';

  if has_schema_privilege('authenticated', 'private', 'USAGE')
    or has_schema_privilege('anon', 'private', 'USAGE')
    or has_function_privilege('authenticated',
      'private.process_overdue_events(timestamptz)', 'EXECUTE')
    or has_function_privilege('anon',
      'private.create_next_recurring_event(uuid,uuid,date,time without time zone,timestamptz)',
      'EXECUTE') then
    raise exception 'private_function_exposed';
  end if;
  if not exists (
    select 1 from cron.job where jobname = 'close-overdue-events'
      and schedule = '* * * * *'
      and username = 'postgres'
      and command = 'select private.process_overdue_events()'
  ) or not has_schema_privilege('postgres', 'private', 'USAGE') then
    raise exception 'cron_job_missing';
  end if;
  raise notice 'PASS: rotina privada e cron a cada minuto';
end $$;

rollback;
