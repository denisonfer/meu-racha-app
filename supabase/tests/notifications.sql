-- Avisos: gravação na mesma transação, leitura, contador e limpeza (7 dias depois de visto, 60 sem ver).
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/notifications.sql
begin;

create function pg_temp.err(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;

create function pg_temp.assert_that(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_msg;
  end if;
end $$;

create function pg_temp.as_(p uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Relógio e recorrência não têm autor: auth.uid() fica nulo.
create function pg_temp.as_nobody() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.person(p_name text, p_plays public.plays_as) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, raw_user_meta_data)
  values (v_id, jsonb_build_object(
    'display_name', p_name,
    'birth_date', '1990-01-01',
    'plays_as', p_plays,
    'primary_position', case when p_plays = 'OUTFIELD' then 'ANY' end,
    'terms_accepted', true
  ));
  return v_id;
end $$;

create function pg_temp.ncount(
  p_who uuid, p_kind text, p_racha uuid default null
) returns integer
language sql as $$
  select count(*)::integer
  from public.notification n
  where (p_who is null or n.recipient_id = p_who)
    and (p_kind is null or n.kind = p_kind)
    and (p_racha is null or n.racha_id = p_racha)
$$;

-- Racha com Dono, Admin e N jogadores de linha. p_tag só com letras (entra no nome).
create function pg_temp.group(p_tag text, p_code text, p_players integer)
returns jsonb
language plpgsql as $$
declare
  v_owner uuid;
  v_admin uuid;
  v_racha uuid;
  v_players uuid[] := '{}';
  v_i integer;
  v_pid uuid;
begin
  v_owner := pg_temp.person('Dono ' || p_tag, 'OUTFIELD');
  v_admin := pg_temp.person('Admin ' || p_tag, 'OUTFIELD');
  insert into public.racha (name, invite_code, place)
  values ('Racha ' || p_tag, p_code, 'Quadra ' || p_tag)
  returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values
    (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_admin, 'ADMIN', 'OUTFIELD', 'ANY', 3);
  for v_i in 1..p_players loop
    v_pid := pg_temp.person('Jogador ' || p_tag || ' ' || chr(64 + v_i), 'OUTFIELD');
    insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
    values (v_racha, v_pid, 'PLAYER', 'OUTFIELD', 'ANY', 3);
    v_players := v_players || v_pid;
  end loop;
  return jsonb_build_object(
    'owner', v_owner, 'admin', v_admin, 'racha', v_racha, 'players', to_jsonb(v_players)
  );
end $$;

-- Evento com Sorteio confirmado. p_sizes[1] = Time 1. Extras ficam fora dos Times.
create function pg_temp.scene(
  p_tag text,
  p_sizes integer[],
  p_limit integer default 5,
  p_extras integer default 0
) returns jsonb
language plpgsql as $$
declare
  v_sfx text := translate(substr(md5(p_tag || clock_timestamp()::text), 1, 4), '0123456789', 'abcdefghij');
  v_owner uuid;
  v_admin uuid;
  v_racha uuid;
  v_event uuid;
  v_code text;
  v_tn integer;
  v_tid uuid;
  v_pid uuid;
  v_i integer;
  v_teams uuid[] := '{}';
  v_gk uuid[] := '{}';
  v_gid uuid;
  v_lines jsonb := '[]'::jsonb;
  v_team_line uuid[];
  v_extras uuid[] := '{}';
  v_all uuid[] := '{}';
begin
  v_owner := pg_temp.person('Dono Cena ' || v_sfx, 'OUTFIELD');
  v_admin := pg_temp.person('Admin Cena ' || v_sfx, 'OUTFIELD');
  v_code := translate(upper(substr(md5(v_sfx || p_tag), 1, 6)), '01', 'ZY');

  insert into public.racha (name, invite_code, place, spot_limit, outfield_per_team)
  values ('Prova Aviso ' || v_sfx, v_code, 'Quadra Aviso', 50, p_limit)
  returning id into v_racha;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values
    (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_admin, 'ADMIN', 'OUTFIELD', 'ANY', 3);

  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    v_racha, current_date, time '19:00', 'Quadra Aviso', 'active', v_owner, 50,
    24, p_limit, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10
  ) returning id into v_event;

  insert into public.event_sort (
    event_id, status, signature, version, leftover_ids, mode, goalkeepers_per_team,
    balance_score, balance_label, balance_diff, super_diff, capped_by_super,
    confirmed_at, confirmed_by
  ) values (
    v_event, 'confirmed', 'aviso', 1, '{}', 'normal', true,
    80, 'Equilibrado', 0, 0, false, now(), v_owner
  );

  for v_tn in 1..cardinality(p_sizes) loop
    insert into public.event_sort_team (event_id, team_number, queue_order, win_streak)
    values (v_event, v_tn, v_tn, 0)
    returning id into v_tid;
    v_teams := v_teams || v_tid;
    v_team_line := '{}';
    for v_i in 1..p_sizes[v_tn] loop
      v_pid := pg_temp.person(
        'Linha ' || v_sfx || chr(64 + v_tn) || chr(96 + v_i), 'OUTFIELD'
      );
      insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
      values (v_racha, v_pid, 'PLAYER', 'OUTFIELD', 'ANY', 3);
      insert into public.event_sort_team_player (
        event_id, team_id, profile_id, stars_snapshot, is_super_star_snapshot,
        primary_position_snapshot
      ) values (v_event, v_tid, v_pid, 3, false, 'ANY');
      v_team_line := v_team_line || v_pid;
      v_all := v_all || v_pid;
    end loop;
    v_lines := v_lines || jsonb_build_array(to_jsonb(v_team_line));

    v_gid := pg_temp.person('Goleiro ' || v_sfx || chr(64 + v_tn), 'GOALKEEPER');
    insert into public.member (racha_id, profile_id, role, plays_as)
    values (v_racha, v_gid, 'PLAYER', 'GOALKEEPER');
    insert into public.event_sort_goalkeeper (event_id, team_id, profile_id)
    values (v_event, v_tid, v_gid);
    v_gk := v_gk || v_gid;
    v_all := v_all || v_gid;
  end loop;

  for v_i in 1..p_extras loop
    v_pid := pg_temp.person('Extra ' || v_sfx || chr(96 + v_i), 'OUTFIELD');
    insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
    values (v_racha, v_pid, 'PLAYER', 'OUTFIELD', 'ANY', 3);
    v_extras := v_extras || v_pid;
  end loop;

  insert into public.event_attendance (event_id, profile_id, status, did_attend)
  select v_event, u, 'confirmed', true from unnest(v_all) u;

  return jsonb_build_object(
    'owner', v_owner, 'admin', v_admin, 'racha', v_racha, 'event', v_event,
    'teams', to_jsonb(v_teams), 'line', v_lines, 'gk', to_jsonb(v_gk),
    'extras', to_jsonb(v_extras)
  );
end $$;

-- ============================================================
-- 1 e 2. Solicitação nova e aprovação
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_admin uuid;
  v_player uuid;
  v_racha uuid;
  v_request uuid;
  v_owner_row jsonb;
  v_admin_row jsonb;
begin
  v := pg_temp.group('Pedido', 'ABCS23', 0);
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;
  v_player := pg_temp.person('Jogador Pedido A', 'OUTFIELD');
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_(v_player);
  insert into public.join_request (racha_id) values (v_racha) returning id into v_request;

  perform pg_temp.assert_that(
    pg_temp.ncount(v_owner, 'join_request', v_racha) = 1
    and pg_temp.ncount(v_admin, 'join_request', v_racha) = 1
    and pg_temp.ncount(v_player, 'join_request', v_racha) = 0,
    'Dono e Admin recebem o pedido; quem pediu, não'
  );
  perform pg_temp.assert_that(
    (select n.actor_name from public.notification n
      where n.recipient_id = v_owner and n.kind = 'join_request') = 'Jogador Pedido A'
    and (select n.payload from public.notification n
      where n.recipient_id = v_owner and n.kind = 'join_request') = '{}'::jsonb,
    'pedido copia o nome de quem pediu e payload vazio'
  );

  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    (public.get_notifications() -> 0 -> 'resolution') = 'null'::jsonb,
    'pedido pendente ainda não tem resolução'
  );

  perform pg_temp.as_(v_admin);
  perform public.approve_join_request(v_request, 3::smallint, false);

  perform pg_temp.assert_that(
    pg_temp.ncount(v_player, 'join_approved', v_racha) = 1
    and pg_temp.ncount(v_admin, 'join_approved', v_racha) = 0
    and pg_temp.ncount(v_owner, 'join_approved', v_racha) = 0,
    'quem pediu recebe join_approved; quem aprovou, não'
  );

  perform pg_temp.as_(v_owner);
  select x into v_owner_row
  from jsonb_array_elements(public.get_notifications()) x
  where x ->> 'kind' = 'join_request';
  perform pg_temp.as_(v_admin);
  select x into v_admin_row
  from jsonb_array_elements(public.get_notifications()) x
  where x ->> 'kind' = 'join_request';

  perform pg_temp.assert_that(
    v_owner_row -> 'resolution' ->> 'status' = 'approved'
    and (v_owner_row -> 'resolution' ->> 'by_me')::boolean is false
    and v_owner_row -> 'resolution' ->> 'by_name' = 'Admin Pedido'
    and v_admin_row -> 'resolution' ->> 'status' = 'approved'
    and (v_admin_row -> 'resolution' ->> 'by_me')::boolean is true,
    'aprovação lida na hora: por ele para o outro, por você para quem aprovou'
  );
  raise notice 'PASS: solicitação nova avisa Dono e Admins, não quem pediu';
  raise notice 'PASS: aprovação mostra por quem foi e avisa quem pediu';
end $$;

-- ============================================================
-- 19. Recusa: snapshot sobrevive ao delete da Solicitação
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_admin uuid;
  v_player uuid;
  v_racha uuid;
  v_request uuid;
  v_row jsonb;
begin
  v := pg_temp.group('Recusa', 'ABCS24', 0);
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;
  v_player := pg_temp.person('Jogador Recusa A', 'OUTFIELD');
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_(v_player);
  insert into public.join_request (racha_id) values (v_racha) returning id into v_request;

  perform pg_temp.as_(v_owner);
  perform public.refuse_join_request(v_request);

  perform pg_temp.assert_that(
    not exists (select 1 from public.join_request jr where jr.id = v_request),
    'recusa continua apagando a Solicitação'
  );
  perform pg_temp.assert_that(
    pg_temp.ncount(v_player, 'join_refused', v_racha) = 1
    and pg_temp.ncount(v_owner, 'join_refused', v_racha) = 0,
    'quem pediu recebe join_refused; quem recusou, não'
  );

  perform pg_temp.as_(v_player);
  select x into v_row
  from jsonb_array_elements(public.get_notifications()) x
  where x ->> 'kind' = 'join_refused';
  perform pg_temp.assert_that(
    v_row ->> 'target' = 'available',
    'recusa aparece available para quem foi recusado'
  );

  perform pg_temp.as_(v_admin);
  select x into v_row
  from jsonb_array_elements(public.get_notifications()) x
  where x ->> 'kind' = 'join_request';
  perform pg_temp.assert_that(
    v_row -> 'resolution' ->> 'status' = 'refused'
    and (v_row -> 'resolution' ->> 'by_me')::boolean is false
    and v_row -> 'resolution' ->> 'by_name' = 'Dono Recusa',
    'Admin lê recusado por o Dono depois do delete'
  );

  perform pg_temp.as_(v_owner);
  select x into v_row
  from jsonb_array_elements(public.get_notifications()) x
  where x ->> 'kind' = 'join_request';
  perform pg_temp.assert_that(
    v_row -> 'resolution' ->> 'status' = 'refused'
    and (v_row -> 'resolution' ->> 'by_me')::boolean is true,
    'quem recusou lê por você, mesmo sem a linha da Solicitação'
  );
  raise notice 'PASS: recusa avisa quem pediu e o pedido dos Admins fica refused depois do delete';
end $$;

-- ============================================================
-- 3. Evento criado pelo Dono e pela recorrência
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_admin uuid;
  v_player uuid;
  v_idle uuid;
  v_racha uuid;
  v_event uuid;
  v_day date := current_date + 14;
  v_next uuid;
  v_payload jsonb;
begin
  v := pg_temp.group('Criado', 'ABCS25', 2);
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;
  v_player := (v #>> '{players,0}')::uuid;
  v_idle := (v #>> '{players,1}')::uuid;
  v_racha := (v ->> 'racha')::uuid;
  update public.member set is_active = false
  where racha_id = v_racha and profile_id = v_idle;

  perform pg_temp.as_(v_owner);
  v_event := public.create_event(
    v_racha, v_day, time '16:00', 'Quadra Centro', false, null::integer, null::smallint, null::integer
  );
  select n.payload into v_payload
  from public.notification n
  where n.recipient_id = v_player and n.kind = 'event_created' and n.event_id = v_event;

  perform pg_temp.assert_that(
    pg_temp.ncount(v_owner, 'event_created', v_racha) = 0
    and pg_temp.ncount(v_admin, 'event_created', v_racha) = 1
    and pg_temp.ncount(v_player, 'event_created', v_racha) = 1
    and pg_temp.ncount(v_idle, 'event_created', v_racha) = 0
    and v_payload ->> 'event_date' = to_char(v_day, 'YYYY-MM-DD')
    and v_payload ->> 'event_time' = '16:00'
    and v_payload ->> 'place' = 'Quadra Centro'
    and (select n.actor_name from public.notification n
      where n.recipient_id = v_player and n.kind = 'event_created') = 'Dono Criado',
    'criado pelo Dono: Membros ativos menos o Dono, com data, hora e local'
  );

  perform public.cancel_event(v_event);
  delete from public.notification where racha_id = v_racha;

  update public.racha
  set weekday = 6, kickoff_time = time '19:00', place = 'Quadra Centro'
  where id = v_racha;

  perform pg_temp.as_nobody();
  v_next := private.create_next_recurring_event(
    v_racha, gen_random_uuid(), current_date, time '19:00', now()
  );
  perform pg_temp.assert_that(v_next is not null, 'recorrência criou o próximo Evento');
  perform pg_temp.assert_that(
    pg_temp.ncount(v_owner, 'event_created', v_racha) = 1
    and pg_temp.ncount(v_admin, 'event_created', v_racha) = 1
    and pg_temp.ncount(v_player, 'event_created', v_racha) = 1
    and pg_temp.ncount(v_idle, 'event_created', v_racha) = 0
    and (select n.actor_name from public.notification n
      where n.event_id = v_next and n.kind = 'event_created' limit 1) is null,
    'recorrência sem autor avisa todos os Membros ativos'
  );

  perform pg_temp.as_(v_owner);
  perform public.cancel_event(v_next);
  perform pg_temp.assert_that(
    pg_temp.ncount(v_owner, 'event_created', v_racha) = 2,
    'cancel_event com sessão ainda avisa o Dono do próximo Evento'
  );
  raise notice 'PASS: evento criado pelo Dono tira o Dono; pela recorrência avisa todos';
  raise notice 'PASS: recorrência disparada por cancel_event com sessão avisa quem cancelou';
end $$;

-- ============================================================
-- 4. Evento alterado: só o que mudou; sem mudança de data/hora/local não avisa
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_player uuid;
  v_racha uuid;
  v_event uuid;
  v_day date := current_date + 21;
begin
  v := pg_temp.group('Mudanca', 'ABCS26', 1);
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{players,0}')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_(v_owner);
  v_event := public.create_event(
    v_racha, v_day, time '19:00', 'Quadra Centro', false, null::integer, null::smallint, null::integer
  );

  perform public.update_event(
    v_event, v_day, time '19:00', 'Quadra Centro', false, null::integer, 20::smallint, null::integer
  );
  perform pg_temp.assert_that(
    pg_temp.ncount(null, 'event_changed', v_racha) = 0,
    'mudar só o limite não avisa'
  );

  perform public.update_event(
    v_event, v_day, time '20:00', 'Quadra Centro', false, null::integer, 20::smallint, null::integer
  );
  perform public.update_event(
    v_event, v_day + 1, time '20:00', 'Quadra Centro', false, null::integer, 20::smallint, null::integer
  );
  perform public.update_event(
    v_event, v_day + 2, time '21:00', 'Quadra Centro', false, null::integer, 20::smallint, null::integer
  );

  -- now() é o mesmo na transação: os três avisos não se ordenam por created_at.
  perform pg_temp.assert_that(
    pg_temp.ncount(v_owner, 'event_changed', v_racha) = 0
    and pg_temp.ncount(v_player, 'event_changed', v_racha) = 3
    and exists (
      select 1 from public.notification n
      where n.recipient_id = v_player and n.kind = 'event_changed'
        and n.payload ->> 'event_time' = '20:00'
        and n.payload ->> 'event_date' = to_char(v_day, 'YYYY-MM-DD')
        and n.payload ->> 'place' = 'Quadra Centro'
        and n.payload -> 'change' = jsonb_build_object('time', '20:00')
    )
    and exists (
      select 1 from public.notification n
      where n.recipient_id = v_player and n.kind = 'event_changed'
        and n.payload -> 'change' = jsonb_build_object('date', to_char(v_day + 1, 'YYYY-MM-DD'))
    )
    and exists (
      select 1 from public.notification n
      where n.recipient_id = v_player and n.kind = 'event_changed'
        and n.payload ->> 'event_date' = to_char(v_day + 1, 'YYYY-MM-DD')
        and n.payload ->> 'event_time' = '21:00'
        and n.payload -> 'change' = jsonb_build_object(
          'date', to_char(v_day + 2, 'YYYY-MM-DD'),
          'time', '21:00'
        )
        and not (n.payload -> 'change' ? 'place')
    ),
    'change traz só horário, só data, ou os dois; local igual fica de fora'
  );
  raise notice 'PASS: alteração avisa só data, horário ou local que mudou';
end $$;

-- ============================================================
-- 5. Cancelamento manual e pelo relógio: só confirmados
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_yes uuid;
  v_also uuid;
  v_wait uuid;
  v_racha uuid;
  v_event uuid;
  v_day date := current_date + 10;
  v_past uuid;
begin
  v := pg_temp.group('Cancela', 'ABCS27', 3);
  v_owner := (v ->> 'owner')::uuid;
  v_yes := (v #>> '{players,0}')::uuid;
  v_also := (v #>> '{players,1}')::uuid;
  v_wait := (v #>> '{players,2}')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_(v_owner);
  v_event := public.create_event(
    v_racha, v_day, time '18:00', 'Quadra Centro', false, null::integer, null::smallint, null::integer
  );
  insert into public.event_attendance (event_id, profile_id, status)
  values (v_event, v_yes, 'confirmed'), (v_event, v_also, 'confirmed');
  insert into public.event_attendance (event_id, profile_id, status, waitlisted_at)
  values (v_event, v_wait, 'waitlisted', now());

  perform public.cancel_event(v_event);
  perform pg_temp.assert_that(
    pg_temp.ncount(v_yes, 'event_cancelled', v_racha) = 1
    and pg_temp.ncount(v_also, 'event_cancelled', v_racha) = 1
    and pg_temp.ncount(v_wait, 'event_cancelled', v_racha) = 0
    and pg_temp.ncount(v_owner, 'event_cancelled', v_racha) = 0
    and (select n.payload ->> 'event_date' from public.notification n
      where n.recipient_id = v_yes and n.kind = 'event_cancelled') = to_char(v_day, 'YYYY-MM-DD'),
    'cancelar avisa só quem estava confirmado'
  );

  insert into public.event (
    racha_id, starts_on, starts_at, place, status, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  )
  select r.id, current_date - 2, time '08:00', 'Quadra Centro', 'upcoming', null::smallint,
    r.reminder_lead_hours, r.outfield_per_team, r.game_mode, r.max_consecutive_wins,
    r.tie_rule, r.tie_return_order, false, r.match_duration_min
  from public.racha r where r.id = v_racha
  returning id into v_past;

  insert into public.event_attendance (event_id, profile_id, status)
  values (v_past, v_yes, 'confirmed'), (v_past, v_also, 'confirmed');
  insert into public.event_attendance (event_id, profile_id, status, waitlisted_at)
  values (v_past, v_wait, 'waitlisted', now());

  perform pg_temp.as_nobody();
  perform private.process_overdue_events(now());
  perform pg_temp.assert_that(
    not exists (select 1 from public.event e where e.id = v_past),
    'relógio apagou o Evento atrasado'
  );
  perform pg_temp.assert_that(
    pg_temp.ncount(v_yes, 'event_cancelled', v_racha) = 2
    and pg_temp.ncount(v_also, 'event_cancelled', v_racha) = 2
    and pg_temp.ncount(v_wait, 'event_cancelled', v_racha) = 0,
    'relógio avisa os confirmados e não a fila'
  );
  raise notice 'PASS: cancelamento manual e pelo relógio avisam só os confirmados';
end $$;

-- ============================================================
-- 6. Sorteio confirmado: cada um o seu Time; Condutor e Avulso, não
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_players uuid[] := '{}';
  v_idle uuid;
  v_racha uuid;
  v_event uuid;
  v_guest uuid;
  v_day date := current_date + 16;
  v_i integer;
  v_pr jsonb;
  v_ver integer;
  v_bad integer;
begin
  v := pg_temp.group('Sorteio', 'ABCS28', 7);
  v_owner := (v ->> 'owner')::uuid;
  v_racha := (v ->> 'racha')::uuid;
  for v_i in 0..5 loop
    v_players := v_players || (v #>> array['players', v_i::text])::uuid;
  end loop;
  v_idle := (v #>> '{players,6}')::uuid;

  perform pg_temp.as_(v_owner);
  v_event := public.create_event(
    v_racha, v_day, time '19:00', 'Quadra Centro', false, null::integer, null::smallint, null::integer
  );
  perform public.assume_event_conduction(v_event);
  perform public.confirm_attendance(v_event);
  for v_i in 1..6 loop
    perform pg_temp.as_(v_players[v_i]);
    perform public.confirm_attendance(v_event);
  end loop;
  perform pg_temp.as_(v_owner);
  v_guest := public.add_guest(v_event, 'Avulso Alfa', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  -- O elenco do Sorteio só conta quem compareceu.
  update public.event_attendance set did_attend = true where event_id = v_event;
  update public.event_guest set did_attend = true where event_id = v_event;
  v_pr := public.prepare_event_sort(v_event);
  v_ver := (v_pr ->> 'version')::integer;
  perform public.confirm_event_sort(v_event, v_ver);

  perform pg_temp.assert_that(
    pg_temp.ncount(v_owner, 'sort_confirmed', v_racha) = 0
    and pg_temp.ncount(v_idle, 'sort_confirmed', v_racha) = 0
    and not exists (
      select 1 from public.notification n
      where n.kind = 'sort_confirmed' and n.event_id = v_event and n.recipient_id = v_guest
    ),
    'Condutor, quem não jogou e Avulso não recebem o Sorteio'
  );

  select count(*) into v_bad
  from public.notification n
  join public.event_sort_team_player tp
    on tp.event_id = v_event and tp.profile_id = n.recipient_id and tp.left_at is null
  join public.event_sort_team t on t.id = tp.team_id
  where n.kind = 'sort_confirmed' and n.event_id = v_event
    and (n.payload ->> 'team')::integer is distinct from t.team_number;

  perform pg_temp.assert_that(
    v_bad = 0
    and pg_temp.ncount(null, 'sort_confirmed', v_racha)
      = (select count(*)::integer from public.event_sort_team_player tp
         where tp.event_id = v_event and tp.left_at is null and tp.profile_id is not null
           and tp.profile_id <> v_owner)
    and not exists (
      select 1 from public.event_sort_team_player tp
      where tp.event_id = v_event and tp.left_at is null and tp.profile_id is not null
        and tp.profile_id <> v_owner
        and not exists (
          select 1 from public.notification n
          where n.recipient_id = tp.profile_id and n.kind = 'sort_confirmed' and n.event_id = v_event
        )
    ),
    'cada Membro de linha recebe o número do próprio Time'
  );
  raise notice 'PASS: sorteio confirmado entrega o Time de cada um, sem Condutor nem Avulso';
end $$;

-- ============================================================
-- 7. Bolinhas movem 2 pessoas
-- ============================================================
do $$
declare
  v jsonb;
  v_event uuid;
  v_owner uuid;
  v_giver uuid;
  v_receiver uuid;
  v_team_no integer;
  v_moved integer;
begin
  v := pg_temp.scene('bolinhas', array[4, 2], 4, 0);
  v_event := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_giver := (v #>> '{teams,0}')::uuid;
  v_receiver := (v #>> '{teams,1}')::uuid;
  select t.team_number into v_team_no from public.event_sort_team t where t.id = v_receiver;

  perform pg_temp.as_(v_owner);
  perform public.draw_event_bolinhas(v_event, v_giver, v_receiver);

  select count(*) into v_moved
  from public.notification n
  where n.event_id = v_event and n.kind = 'team_changed';

  perform pg_temp.assert_that(
    v_moved = 2
    and not exists (
      select 1 from public.notification n
      where n.event_id = v_event and n.kind = 'team_changed'
        and (n.payload ->> 'team')::integer is distinct from v_team_no
    )
    and not exists (
      select 1 from public.notification n
      where n.event_id = v_event and n.kind = 'team_changed'
        and n.recipient_id <> all (
          select (x.value #>> '{}')::uuid
          from jsonb_array_elements(v -> 'line' -> 0) x
        )
    )
    and (
      select count(*) from public.event_sort_team_player tp
      where tp.team_id = v_giver and tp.left_at is null
    ) = 2,
    'as duas pessoas que saíram recebem o Time novo; quem ficou, não'
  );
  raise notice 'PASS: bolinhas que movem duas pessoas avisam as duas com o Time novo';
end $$;

-- ============================================================
-- 7b. Bolinhas esvaziam o Time e o rebalanceio muda o número do Goleiro
-- ============================================================
do $$
declare
  v jsonb;
  v_event uuid;
  v_owner uuid;
  v_giver uuid;
  v_receiver uuid;
  v_gk uuid;
  v_line uuid;
  v_before integer;
  v_after integer;
begin
  v := pg_temp.scene('goleiro muda', array[1, 4], 5, 0);
  v_event := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_giver := (v #>> '{teams,0}')::uuid;
  v_receiver := (v #>> '{teams,1}')::uuid;
  v_gk := (v #>> '{gk,0}')::uuid;
  v_line := (v #>> '{line,0,0}')::uuid;

  select t.team_number into v_before
  from public.event_sort_goalkeeper k
  join public.event_sort_team t on t.id = k.team_id
  where k.profile_id = v_gk;

  -- Quem recebe fica sem goleiro. Ao esvaziar quem cede, o rebalanceio leva
  -- o goleiro de lá para um Time que ainda tem número.
  delete from public.event_sort_goalkeeper k
  where k.event_id = v_event and k.team_id = v_receiver;

  perform pg_temp.as_(v_owner);
  perform public.draw_event_bolinhas(v_event, v_giver, v_receiver);

  select t.team_number into v_after
  from public.event_sort_goalkeeper k
  join public.event_sort_team t on t.id = k.team_id
  where k.profile_id = v_gk;

  perform pg_temp.assert_that(
    v_after is not null and v_after is distinct from v_before,
    'rebalanceio mudou o número do Goleiro'
  );
  perform pg_temp.assert_that(
    pg_temp.ncount(v_gk, 'team_changed', (v ->> 'racha')::uuid) = 1
    and (select (n.payload ->> 'team')::integer from public.notification n
      where n.recipient_id = v_gk and n.kind = 'team_changed') = v_after
    and pg_temp.ncount(v_line, 'team_changed', (v ->> 'racha')::uuid) = 1
    and (select (n.payload ->> 'team')::integer from public.notification n
      where n.recipient_id = v_line and n.kind = 'team_changed') = v_after,
    'goleiro cujo Time mudou de número recebe team_changed com o número novo'
  );
  raise notice 'PASS: bolinhas que mudam o número do Goleiro avisam o Goleiro';
end $$;

-- ============================================================
-- 8. Cargo, expulsão e passagem: só o afetado
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_p3 uuid;
  v_racha uuid;
begin
  v := pg_temp.group('Cargo', 'ABCS29', 3);
  v_owner := (v ->> 'owner')::uuid;
  v_p1 := (v #>> '{players,0}')::uuid;
  v_p2 := (v #>> '{players,1}')::uuid;
  v_p3 := (v #>> '{players,2}')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_(v_owner);
  perform public.update_member(v_racha, v_p1, 4::smallint, false, 'ADMIN');
  perform pg_temp.assert_that(
    pg_temp.ncount(v_p1, 'role_changed', v_racha) = 1
    and pg_temp.ncount(v_p2, 'role_changed', v_racha) = 0
    and (select n.payload ->> 'role' from public.notification n
      where n.recipient_id = v_p1 and n.kind = 'role_changed') = 'ADMIN',
    'promoção avisa só o Membro, com o Cargo novo'
  );

  perform public.update_member(v_racha, v_p1, 2::smallint, true, null);
  perform pg_temp.assert_that(
    pg_temp.ncount(v_p1, 'role_changed', v_racha) = 1,
    'mexer só nas Estrelas não avisa Cargo'
  );

  perform public.update_member(v_racha, v_p1, 2::smallint, true, 'PLAYER');
  -- now() é o mesmo na transação inteira; created_at e o uuid não dizem qual aviso veio depois.
  perform pg_temp.assert_that(
    pg_temp.ncount(v_p1, 'role_changed', v_racha) = 2
    and exists (
      select 1 from public.notification n
      where n.recipient_id = v_p1
        and n.kind = 'role_changed'
        and n.payload ->> 'role' = 'ADMIN'
    )
    and exists (
      select 1 from public.notification n
      where n.recipient_id = v_p1
        and n.kind = 'role_changed'
        and n.payload ->> 'role' = 'PLAYER'
    ),
    'rebaixamento avisa só o Membro'
  );

  perform public.expel_member(v_racha, v_p2);
  perform pg_temp.assert_that(
    pg_temp.ncount(v_p2, 'expelled', v_racha) = 1
    and pg_temp.ncount(v_p1, 'expelled', v_racha) = 0
    and pg_temp.ncount(v_owner, 'expelled', v_racha) = 0
    and (select n.payload from public.notification n
      where n.recipient_id = v_p2 and n.kind = 'expelled') = '{}'::jsonb,
    'expulsão avisa só o expulso'
  );

  perform public.transfer_ownership(v_racha, v_p3);
  perform pg_temp.assert_that(
    pg_temp.ncount(v_p3, 'ownership_transferred', v_racha) = 1
    and pg_temp.ncount(v_owner, 'ownership_transferred', v_racha) = 0
    and pg_temp.ncount(v_p1, 'ownership_transferred', v_racha) = 0,
    'passagem avisa só o novo Dono'
  );
  raise notice 'PASS: promoção, rebaixamento, expulsão e passagem avisam só o afetado';
end $$;

-- ============================================================
-- 9. Condução assumida: só o Condutor anterior
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_admin uuid;
  v_racha uuid;
  v_event uuid;
begin
  v := pg_temp.group('Conducao', 'ABCS32', 0);
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_(v_owner);
  v_event := public.create_event(
    v_racha, current_date + 12, time '19:00', 'Quadra Centro',
    false, null::integer, null::smallint, null::integer
  );
  perform public.assume_event_conduction(v_event);
  perform pg_temp.assert_that(
    pg_temp.ncount(null, 'conduction_taken', v_racha) = 0,
    'primeiro Condutor não gera aviso: não havia anterior'
  );

  perform pg_temp.as_(v_admin);
  perform public.assume_event_conduction(v_event);
  perform pg_temp.assert_that(
    pg_temp.ncount(v_owner, 'conduction_taken', v_racha) = 1
    and pg_temp.ncount(v_admin, 'conduction_taken', v_racha) = 0
    and (select n.actor_name from public.notification n
      where n.recipient_id = v_owner and n.kind = 'conduction_taken') = 'Admin Conducao'
    and (select n.payload from public.notification n
      where n.recipient_id = v_owner and n.kind = 'conduction_taken') = '{}'::jsonb,
    'só o Condutor anterior recebe, com o nome de quem assumiu'
  );
  raise notice 'PASS: condução assumida avisa só o Condutor anterior';
end $$;

-- ============================================================
-- 10. Vaga liberada: só o primeiro da fila
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_hold uuid;
  v_first uuid;
  v_second uuid;
  v_racha uuid;
  v_event uuid;
begin
  v := pg_temp.group('Fila', 'ABCS33', 8);
  v_owner := (v ->> 'owner')::uuid;
  v_hold := (v #>> '{players,0}')::uuid;
  v_first := (v #>> '{players,6}')::uuid;
  v_second := (v #>> '{players,7}')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  -- Limite mínimo cabe dois Times de 3. Seis confirmados enchem; cancelar um abre uma vaga.
  update public.racha set outfield_per_team = 3 where id = v_racha;
  perform pg_temp.as_(v_owner);
  v_event := public.create_event(
    v_racha, current_date + 11, time '19:00', 'Quadra Centro',
    false, null::integer, 6::smallint, null::integer
  );
  insert into public.event_attendance (event_id, profile_id, status)
  select v_event, (v #>> array['players', i::text])::uuid, 'confirmed'
  from generate_series(0, 5) i;
  insert into public.event_attendance (event_id, profile_id, status, waitlisted_at)
  values
    (v_event, v_first, 'waitlisted', now() - interval '2 minutes'),
    (v_event, v_second, 'waitlisted', now() - interval '1 minute');

  perform pg_temp.as_(v_hold);
  perform public.cancel_attendance(v_event);

  perform pg_temp.assert_that(
    (select ea.status from public.event_attendance ea
      where ea.event_id = v_event and ea.profile_id = v_first) = 'confirmed'
    and (select ea.status from public.event_attendance ea
      where ea.event_id = v_event and ea.profile_id = v_second) = 'waitlisted'
    and pg_temp.ncount(v_first, 'waitlist_promoted', v_racha) = 1
    and pg_temp.ncount(v_second, 'waitlist_promoted', v_racha) = 0
    and pg_temp.ncount(v_hold, 'waitlist_promoted', v_racha) = 0
    and (select n.payload ->> 'event_date' from public.notification n
      where n.recipient_id = v_first and n.kind = 'waitlist_promoted')
      = to_char(current_date + 11, 'YYYY-MM-DD'),
    'só o primeiro da fila promovido recebe a vaga, com a data do Evento'
  );
  raise notice 'PASS: vaga liberada avisa só o primeiro da fila promovido';
end $$;

-- ============================================================
-- 11. Crédito: falta e fila avisam; restore, apply e cancel_daily não
-- ============================================================
do $$
declare
  v jsonb;
  v_player uuid;
  v_racha uuid;
  v_until timestamptz := timestamptz '2026-04-09 15:00:00-03';
  v_payload jsonb;
begin
  v := pg_temp.group('Credito', 'ABCS34', 1);
  v_player := (v #>> '{players,0}')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_nobody();
  perform private.insert_credit_entry(
    v_racha, v_player, gen_random_uuid(), 'grant:absence', 'absence_daily', 20, v_until, null
  );
  perform private.insert_credit_entry(
    v_racha, v_player, gen_random_uuid(), 'grant:absence', 'absence_daily', 20, v_until, null
  );
  perform private.insert_credit_entry(
    v_racha, v_player, gen_random_uuid(), 'grant:wait', 'waitlist_daily', 15, v_until, null
  );
  perform private.insert_credit_entry(
    v_racha, v_player, gen_random_uuid(), 'grant:restore', 'restore', 20, v_until, null
  );
  perform private.insert_credit_entry(
    v_racha, v_player, gen_random_uuid(), 'grant:apply', 'apply', -20, v_until, null
  );
  perform private.insert_credit_entry(
    v_racha, v_player, gen_random_uuid(), 'grant:cancel', 'cancel_daily', 20, v_until, null
  );

  select n.payload into v_payload
  from public.notification n
  where n.recipient_id = v_player and n.kind = 'credit_created'
    and (n.payload ->> 'amount_cents')::integer = 20;

  perform pg_temp.assert_that(
    pg_temp.ncount(v_player, 'credit_created', v_racha) = 2
    and v_payload ->> 'valid_until' = '2026-04-09'
    and exists (
      select 1 from public.notification n
      where n.recipient_id = v_player and n.kind = 'credit_created'
        and (n.payload ->> 'amount_cents')::integer = 15
        and n.payload ->> 'valid_until' = '2026-04-09'
    ),
    'falta e fila avisam valor e validade; conflito não duplica'
  );
  raise notice 'PASS: crédito de falta ou fila avisa; restore, apply e cancel_daily não';
end $$;

-- ============================================================
-- 12. Contador: marca zera; aviso posterior volta a contar
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_player uuid;
  v_racha uuid;
  v_event uuid;
  v_fresh uuid;
begin
  v := pg_temp.group('Contagem', 'ABCS35', 1);
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{players,0}')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_(v_owner);
  v_event := public.create_event(
    v_racha, current_date + 18, time '19:00', 'Quadra Centro',
    false, null::integer, null::smallint, null::integer
  );

  perform pg_temp.as_(v_player);
  perform pg_temp.assert_that(
    public.get_unseen_notifications_count() = 1
    and (public.get_notifications() -> 0 ->> 'is_new')::boolean,
    'aviso novo entra no contador'
  );

  perform public.mark_notifications_seen();
  perform pg_temp.assert_that(
    public.get_unseen_notifications_count() = 0
    and not (public.get_notifications() -> 0 ->> 'is_new')::boolean
    and (select n.seen_at from public.notification n
      where n.recipient_id = v_player and n.event_id = v_event) is not null,
    'abrir a aba zera o contador'
  );

  insert into public.notification (recipient_id, kind, racha_id, racha_name, payload, created_at)
  values (v_player, 'role_changed', v_racha, 'Racha Contagem', '{"role":"ADMIN"}', now() + interval '1 second')
  returning id into v_fresh;

  perform pg_temp.assert_that(
    public.get_unseen_notifications_count() = 1
    and (public.get_notifications() -> 0 ->> 'is_new')::boolean,
    'aviso chegado depois da visita volta a contar'
  );

  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    public.get_unseen_notifications_count() = 0,
    'contador do Dono não inclui o aviso do Jogador'
  );
  raise notice 'PASS: contador conta os novos, zera ao marcar e volta com aviso posterior';
end $$;

-- ============================================================
-- 13, 14 e 15. Destino: Racha excluído, saiu, Evento encerrado
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_player uuid;
  v_other uuid;
  v_racha uuid;
  v_event uuid;
  v_row jsonb;
  v_day date := current_date + 19;
  v_pr jsonb;
  v_i integer;
begin
  v := pg_temp.group('Destino', 'ABCS36', 7);
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{players,0}')::uuid;
  v_other := (v #>> '{players,1}')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_(v_owner);
  v_event := public.create_event(
    v_racha, v_day, time '19:00', 'Quadra Centro', false, null::integer, null::smallint, null::integer
  );
  perform public.assume_event_conduction(v_event);
  perform public.confirm_attendance(v_event);
  for v_i in 0..5 loop
    perform pg_temp.as_((v #>> array['players', v_i::text])::uuid);
    perform public.confirm_attendance(v_event);
  end loop;
  perform pg_temp.as_(v_owner);
  perform public.add_guest(v_event, 'Avulso Beta', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  update public.event_attendance set did_attend = true where event_id = v_event;
  update public.event_guest set did_attend = true where event_id = v_event;
  v_pr := public.prepare_event_sort(v_event);
  perform public.confirm_event_sort(v_event, (v_pr ->> 'version')::integer);
  perform public.finish_event(v_event, false);

  perform pg_temp.as_(v_player);
  select x into v_row
  from jsonb_array_elements(public.get_notifications()) x
  where x ->> 'kind' = 'sort_confirmed';
  perform pg_temp.assert_that(v_row ->> 'target' = 'event_finished', 'sorteio de Evento encerrado vai à Resenha');
  select x into v_row
  from jsonb_array_elements(public.get_notifications()) x
  where x ->> 'kind' = 'event_created';
  perform pg_temp.assert_that(
    v_row ->> 'target' = 'available',
    'evento criado não vira event_finished'
  );

  perform pg_temp.as_(v_owner);
  perform public.expel_member(v_racha, v_other);
  perform pg_temp.as_(v_other);
  select x into v_row
  from jsonb_array_elements(public.get_notifications()) x
  where x ->> 'kind' = 'event_created';
  perform pg_temp.assert_that(v_row ->> 'target' = 'not_member', 'saiu: avisos antigos ficam not_member');
  select x into v_row
  from jsonb_array_elements(public.get_notifications()) x
  where x ->> 'kind' = 'expelled';
  perform pg_temp.assert_that(v_row ->> 'target' = 'available', 'expulsão continua available');

  delete from public.racha where id = v_racha;
  perform pg_temp.as_(v_player);
  perform pg_temp.assert_that(
    exists (select 1 from public.notification n where n.racha_id = v_racha and n.recipient_id = v_player)
    and not exists (
      select 1 from jsonb_array_elements(public.get_notifications()) x
      where x ->> 'racha_id' = v_racha::text and x ->> 'target' is distinct from 'racha_deleted'
    )
    and exists (
      select 1 from jsonb_array_elements(public.get_notifications()) x
      where x ->> 'racha_id' = v_racha::text
    ),
    'Racha excluído: os Avisos ficam, com target racha_deleted'
  );
  raise notice 'PASS: Racha excluído marca racha_deleted e os Avisos ficam';
  raise notice 'PASS: saiu do Racha marca not_member, menos a expulsão';
  raise notice 'PASS: Evento encerrado marca event_finished no Aviso do Sorteio';
end $$;

-- ============================================================
-- 16. Prazo: visto some 7 dias depois; não visto fica até 60 dias
-- ============================================================
do $$
declare
  v jsonb;
  v_player uuid;
  v_racha uuid;
  v_seen6 uuid;
  v_seen8 uuid;
  v_new30 uuid;
  v_new61 uuid;
  v_ids uuid[];
  v_seen6_at timestamptz;
  v_cmd text;
begin
  v := pg_temp.group('Prazo', 'ABCS37', 1);
  v_player := (v #>> '{players,0}')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  insert into public.notification (recipient_id, kind, racha_id, racha_name, payload, created_at, seen_at)
  values (v_player, 'role_changed', v_racha, 'Racha Prazo', '{"role":"ADMIN"}',
    now() - interval '40 days', now() - interval '6 days')
  returning id into v_seen6;
  insert into public.notification (recipient_id, kind, racha_id, racha_name, payload, created_at, seen_at)
  values (v_player, 'role_changed', v_racha, 'Racha Prazo', '{"role":"PLAYER"}',
    now() - interval '10 days', now() - interval '8 days')
  returning id into v_seen8;
  insert into public.notification (recipient_id, kind, racha_id, racha_name, payload, created_at)
  values (v_player, 'expelled', v_racha, 'Racha Prazo', '{}', now() - interval '30 days')
  returning id into v_new30;
  insert into public.notification (recipient_id, kind, racha_id, racha_name, payload, created_at)
  values (v_player, 'expelled', v_racha, 'Racha Prazo', '{}', now() - interval '61 days')
  returning id into v_new61;

  perform pg_temp.as_(v_player);
  select array_agg((x ->> 'id')::uuid) into v_ids from jsonb_array_elements(public.get_notifications()) x;
  perform pg_temp.assert_that(
    v_seen6 = any(v_ids) and not v_seen8 = any(v_ids),
    'visto há 6 dias aparece; visto há 8 não'
  );
  perform pg_temp.assert_that(
    v_new30 = any(v_ids) and not v_new61 = any(v_ids)
    and (select (x ->> 'is_new')::boolean from jsonb_array_elements(public.get_notifications()) x
      where (x ->> 'id')::uuid = v_new30)
    and not (select (x ->> 'is_new')::boolean from jsonb_array_elements(public.get_notifications()) x
      where (x ->> 'id')::uuid = v_seen6),
    'não visto com 30 dias aparece como novo; com 61 não aparece'
  );
  perform pg_temp.assert_that(
    public.get_unseen_notifications_count() = 1,
    'contador conta só os não vistos dentro de 60 dias'
  );

  select n.seen_at into v_seen6_at from public.notification n where n.id = v_seen6;
  perform public.mark_notifications_seen();
  perform pg_temp.assert_that(
    (select n.seen_at from public.notification n where n.id = v_seen6) = v_seen6_at
    and (select n.seen_at from public.notification n where n.id = v_seen8) < now() - interval '7 days'
    and (select n.seen_at from public.notification n where n.id = v_new30) = now()
    and (select n.seen_at from public.notification n where n.id = v_new61) = now()
    and public.get_unseen_notifications_count() = 0,
    'marcar grava seen_at só nos não vistos e não mexe nos já vistos'
  );
  update public.notification set seen_at = null where id in (v_new30, v_new61);

  select j.command into v_cmd from cron.job j where j.jobname = 'purge-old-notifications';
  perform pg_temp.assert_that(
    (select j.schedule from cron.job j where j.jobname = 'purge-old-notifications') = '15 4 * * *'
    and (select count(*) from cron.job j where j.jobname = 'purge-old-notifications') = 1
    and exists (select 1 from cron.job j where j.jobname = 'close-overdue-events'),
    'job diário de limpeza existe uma vez e o de Eventos atrasados segue lá'
  );
  execute v_cmd;
  perform pg_temp.assert_that(
    exists (select 1 from public.notification n where n.id = v_seen6)
    and not exists (select 1 from public.notification n where n.id = v_seen8)
    and exists (select 1 from public.notification n where n.id = v_new30)
    and not exists (select 1 from public.notification n where n.id = v_new61)
    and exists (select 1 from public.notification n where n.racha_id <> v_racha),
    'o SQL do job apaga visto há mais de 7 dias e não visto com mais de 60, nada além'
  );
  raise notice 'PASS: visto some 7 dias depois, não visto fica até 60 dias e o job apaga só isso';
end $$;

-- ============================================================
-- 17. Ninguém lê o Aviso de outro Perfil
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_player uuid;
  v_racha uuid;
  v_seen timestamptz;
  v_note uuid;
begin
  v := pg_temp.group('Privado', 'ABCS38', 1);
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{players,0}')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_(v_owner);
  perform public.create_event(
    v_racha, current_date + 20, time '19:00', 'Quadra Centro',
    false, null::integer, null::smallint, null::integer
  );

  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    public.get_unseen_notifications_count() = 0
    and jsonb_array_length(public.get_notifications()) = 0,
    'Dono não vê o aviso que foi para o Jogador'
  );

  perform pg_temp.as_(v_player);
  perform pg_temp.assert_that(jsonb_array_length(public.get_notifications()) = 1, 'Jogador vê o próprio');
  perform public.mark_notifications_seen();

  select n.id, n.seen_at into v_note, v_seen from public.notification n where n.recipient_id = v_player;
  update public.notification set seen_at = null where id = v_note;

  perform pg_temp.as_(v_owner);
  perform public.mark_notifications_seen();
  perform pg_temp.assert_that(
    v_seen is not null
    and (select n.seen_at from public.notification n where n.id = v_note) is null,
    'marcar visto não mexe no Aviso de outro Perfil'
  );

  perform pg_temp.as_nobody();
  perform pg_temp.assert_that(
    pg_temp.err('select public.get_notifications()') = 'not_allowed'
    and pg_temp.err('select public.get_unseen_notifications_count()') = 'not_allowed'
    and pg_temp.err('select public.mark_notifications_seen()') = 'not_allowed',
    'sem sessão as três leituras recusam'
  );
  perform pg_temp.assert_that(
    (select c.relrowsecurity from pg_class c where c.oid = 'public.notification'::regclass)
    and not exists (select 1 from pg_policy p where p.polrelid = 'public.notification'::regclass)
    and not has_table_privilege('authenticated', 'public.notification', 'SELECT')
    and not has_table_privilege('anon', 'public.notification', 'SELECT')
    and has_function_privilege('authenticated', 'public.get_notifications()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_notifications()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_unseen_notifications_count()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.mark_notifications_seen()', 'EXECUTE'),
    'tabela com RLS e sem política; leitura só para authenticated'
  );
  raise notice 'PASS: cada Perfil só lê, conta e marca os próprios Avisos';
end $$;

-- ============================================================
-- 18. Reforço avisa a pessoa puxada (Membro), não o Avulso
-- ============================================================
do $$
declare
  v jsonb;
  v_event uuid;
  v_owner uuid;
  v_leaver uuid;
  v_pulled uuid;
  v_donor uuid;
  v_match uuid;
  v_guest uuid;
  v_t3 uuid;
  v_team_no integer;
begin
  v := pg_temp.scene('reforco', array[5, 5, 1], 5, 0);
  v_event := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_leaver := (v #>> '{line,0,0}')::uuid;
  v_pulled := (v #>> '{line,2,0}')::uuid;
  v_donor := (v #>> '{teams,2}')::uuid;

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_event) #>> '{match,id}')::uuid;
  perform public.reinforce_event_match(v_match, v_leaver, null, v_donor);
  select t.team_number into v_team_no
  from public.event_sort_team_player tp
  join public.event_sort_team t on t.id = tp.team_id
  where tp.event_id = v_event and tp.profile_id = v_pulled and tp.left_at is null;

  perform pg_temp.assert_that(
    pg_temp.ncount(v_pulled, 'team_changed', (v ->> 'racha')::uuid) = 1
    and pg_temp.ncount(v_leaver, 'team_changed', (v ->> 'racha')::uuid) = 0
    and (select (n.payload ->> 'team')::integer from public.notification n
      where n.recipient_id = v_pulled and n.kind = 'team_changed') = v_team_no,
    'Reforço avisa o Membro puxado com o Time novo, não quem saiu'
  );

  v := pg_temp.scene('avulso', array[5, 5, 1], 5, 0);
  v_event := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_leaver := (v #>> '{line,0,0}')::uuid;
  v_pulled := (v #>> '{line,2,0}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;

  insert into public.event_guest (event_id, display_name, plays_as, primary_position, stars, did_attend)
  values (v_event, 'Avulso Puxado', 'OUTFIELD', 'ANY', 3, true)
  returning id into v_guest;
  delete from public.event_sort_team_player tp
  where tp.team_id = v_t3 and tp.profile_id = v_pulled;
  insert into public.event_sort_team_player (
    event_id, team_id, guest_id, stars_snapshot, is_super_star_snapshot, primary_position_snapshot
  ) values (v_event, v_t3, v_guest, 3, false, 'ANY');

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_event) #>> '{match,id}')::uuid;
  perform public.reinforce_event_match(v_match, v_leaver, null, v_t3);
  perform pg_temp.assert_that(
    pg_temp.ncount(null, 'team_changed', (v ->> 'racha')::uuid) = 0,
    'Reforço que puxa Avulso não gera Aviso'
  );
  raise notice 'PASS: reforço avisa a pessoa puxada quando é Membro, não quando é Avulso';
end $$;

rollback;
