-- Troca de Condutor no meio da Partida, etapa 1: banco.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/event_conduction_takeover.sql
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

-- Evento com Sorteio confirmado, Presença confirmada e Times do tamanho pedido.
-- p_sizes[1] = Time 1, etc. Extras não entram em Time (Inclusão). Um Goleiro extra.
create function pg_temp.scene(
  p_tag text,
  p_sizes integer[],
  p_limit integer default 5,
  p_extras integer default 3
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
  v_extra_gk uuid;
  v_all uuid[] := '{}';
begin
  v_owner := pg_temp.person('Dono Cena ' || v_sfx, 'OUTFIELD');
  v_admin := pg_temp.person('Admin Cena ' || v_sfx, 'OUTFIELD');
  v_code := translate(upper(substr(md5(v_sfx || p_tag), 1, 6)), '01', 'ZY');

  insert into public.racha (name, invite_code, place, spot_limit, outfield_per_team)
  values ('Prova Reforco ' || v_sfx, v_code, 'Quadra Reforco', 50, p_limit)
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
    v_racha, current_date, time '19:00', 'Quadra Reforco', 'active', v_owner, 50,
    24, p_limit, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10
  ) returning id into v_event;

  insert into public.event_sort (
    event_id, status, signature, version, leftover_ids, mode, goalkeepers_per_team,
    balance_score, balance_label, balance_diff, super_diff, capped_by_super,
    confirmed_at, confirmed_by
  ) values (
    v_event, 'confirmed', 'reinforce', 1, '{}', 'normal', true,
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

  v_extra_gk := pg_temp.person('Goleiro Extra ' || v_sfx, 'GOALKEEPER');
  insert into public.member (racha_id, profile_id, role, plays_as)
  values (v_racha, v_extra_gk, 'PLAYER', 'GOALKEEPER');

  insert into public.event_attendance (event_id, profile_id, status, did_attend)
  select v_event, u, 'confirmed', true from unnest(v_all) u;

  return jsonb_build_object(
    'owner', v_owner, 'admin', v_admin, 'racha', v_racha, 'event', v_event,
    'teams', to_jsonb(v_teams), 'line', v_lines, 'gk', to_jsonb(v_gk),
    'extras', to_jsonb(v_extras), 'extra_gk', v_extra_gk
  );
end $$;

create function pg_temp.view_of(p uuid, p_event uuid) returns jsonb
language plpgsql as $$
begin
  perform pg_temp.as_(p);
  return public.get_event_match(p_event);
end $$;

create function pg_temp.notified(p_event uuid, p_seq bigint) returns boolean
language sql as $$
  select exists (
    select 1 from realtime.messages m
    where m.topic = 'event:' || p_event::text
      and m.event = 'match_changed'
      and (m.payload ->> 'seq')::bigint = p_seq
  )
$$;

create function pg_temp.notify_count(p_event uuid) returns integer
language sql as $$
  select count(*)::integer from realtime.messages m
  where m.topic = 'event:' || p_event::text and m.event = 'match_changed'
$$;

-- ============================================================
-- 1, 3, 4, 5 e 7. Troca com Partida aberta
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_admin uuid;
  v_player uuid;
  v_t1 uuid;
  v_match uuid;
  v_before jsonb;
  v_after jsonb;
  v_row public.event_match;
  v_row_after public.event_match;
  v_cards integer;
  v_seq bigint;
  v_msg text;
begin
  v := pg_temp.scene('open', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_card(v_match, v_player, null, 'yellow');
  perform public.pause_event_match(v_match);

  perform pg_temp.assert_that(
    (pg_temp.view_of(v_admin, v_e) #>> '{viewer,can_assume}')::boolean
    and not (pg_temp.view_of(v_owner, v_e) #>> '{viewer,can_assume}')::boolean
    and not (pg_temp.view_of(v_player, v_e) #>> '{viewer,can_assume}')::boolean,
    'caso 5: Admin pode assumir; Condutor e Jogador não');

  v_before := pg_temp.view_of(v_owner, v_e);
  select * into v_row from public.event_match m where m.id = v_match;
  select count(*) into v_cards from public.event_match_card c where c.match_id = v_match;

  perform pg_temp.as_(v_admin);
  perform public.assume_event_conduction(v_e);
  v_after := pg_temp.view_of(v_admin, v_e);
  v_seq := (v_after ->> 'seq')::bigint;
  select * into v_row_after from public.event_match m where m.id = v_match;

  perform pg_temp.assert_that(
    (select e.conductor_id from public.event e where e.id = v_e) = v_admin
    and v_seq > (v_before ->> 'seq')::bigint
    and v_seq = (select e.conduction_seq from public.event e where e.id = v_e)
    and v_row_after.started_at = v_row.started_at
    and v_row_after.paused_at = v_row.paused_at
    and v_row_after.paused_seconds = v_row.paused_seconds
    and v_row_after.seq = v_row.seq
    and v_after -> 'started_at' = v_before -> 'started_at'
    and v_after -> 'paused_at' = v_before -> 'paused_at'
    and v_after -> 'paused_seconds' = v_before -> 'paused_seconds'
    and v_after #> '{match,cards}' = v_before #> '{match,cards}'
    and (select count(*) from public.event_match_card c where c.match_id = v_match) = v_cards,
    'caso 1: condutor muda, seq sobe, relógio, Partida e cartões ficam');

  perform pg_temp.assert_that(
    pg_temp.notified(v_e, v_seq),
    'caso 4: match_changed em event:<id> com o seq novo');

  perform pg_temp.assert_that(
    v_after ->> 'conductor_name' = (select p.display_name from public.profile p where p.id = v_admin)
    and (v_after #>> '{viewer,can_conduct}')::boolean
    and not (v_after #>> '{viewer,can_assume}')::boolean
    and (pg_temp.view_of(v_owner, v_e) #>> '{viewer,can_assume}')::boolean,
    'caso 5: conductor_name de quem assumiu; Dono que não conduz pode assumir');

  perform pg_temp.as_(v_owner);
  v_msg := pg_temp.err(format(
    'select public.add_event_match_goal(%L, %L, %L, %L)', v_match, 'k-old', v_t1, v_player));
  perform pg_temp.assert_that(
    v_msg = 'not_conductor'
    and not exists (select 1 from public.event_match_goal g where g.match_id = v_match),
    'caso 7: Condutor anterior recebe not_conductor');

  perform pg_temp.as_(v_admin);
  perform public.resume_event_match(v_match);
  perform pg_temp.assert_that(
    (pg_temp.view_of(v_admin, v_e) ->> 'seq')::bigint > v_seq
    and (select m.seq from public.event_match m where m.id = v_match) > v_seq,
    'caso 3: ação de Partida depois da troca gera seq maior');

  raise notice 'PASS: troca com Partida aberta';
end $$;

-- ============================================================
-- 2. Antes da primeira Partida e entre Partidas
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_admin uuid;
  v_match uuid;
  v_seq bigint;
  v_last bigint;
begin
  v := pg_temp.scene('before', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;

  perform pg_temp.assert_that(
    (pg_temp.view_of(v_owner, v_e) ->> 'seq')::bigint = 0,
    'caso 2: sem Partida o seq é 0');
  perform pg_temp.as_(v_admin);
  perform public.assume_event_conduction(v_e);
  v_seq := (pg_temp.view_of(v_admin, v_e) ->> 'seq')::bigint;
  perform pg_temp.assert_that(
    v_seq > 0 and pg_temp.notified(v_e, v_seq)
    and pg_temp.view_of(v_admin, v_e) ->> 'state' = 'ready',
    'caso 2: antes da primeira Partida o seq sai de 0 e avisa');

  perform pg_temp.as_(v_admin);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.finish_event_match(v_match);
  v_last := (select m.seq from public.event_match m where m.id = v_match);
  perform pg_temp.assert_that(
    (pg_temp.view_of(v_owner, v_e) ->> 'seq')::bigint = v_last,
    'caso 2: entre Partidas o seq é o da última');

  perform pg_temp.as_(v_owner);
  perform public.assume_event_conduction(v_e);
  v_seq := (pg_temp.view_of(v_owner, v_e) ->> 'seq')::bigint;
  perform pg_temp.assert_that(
    v_seq > v_last and pg_temp.notified(v_e, v_seq)
    and (select e.conductor_id from public.event e where e.id = v_e) = v_owner,
    'caso 2: entre Partidas o seq passa o da última Partida');

  raise notice 'PASS: antes da primeira Partida e entre Partidas';
end $$;

-- ============================================================
-- 5, 6 e 8. Recusas, Evento upcoming e duas trocas seguidas
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_up uuid;
  v_racha uuid;
  v_owner uuid;
  v_admin uuid;
  v_admin2 uuid;
  v_inactive uuid;
  v_player uuid;
  v_count integer;
  v_seq0 bigint;
  v_seq1 bigint;
  v_seq2 bigint;
  v_msg text;
begin
  v := pg_temp.scene('refuse', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_racha := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_admin2 := pg_temp.person('Admin Dois', 'OUTFIELD');
  v_inactive := pg_temp.person('Admin Inativo', 'OUTFIELD');
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars, is_active)
  values
    (v_racha, v_admin2, 'ADMIN', 'OUTFIELD', 'ANY', 3, true),
    (v_racha, v_inactive, 'ADMIN', 'OUTFIELD', 'ANY', 3, false);

  v_count := pg_temp.notify_count(v_e);
  v_seq0 := (pg_temp.view_of(v_owner, v_e) ->> 'seq')::bigint;

  perform pg_temp.as_(v_player);
  v_msg := pg_temp.err(format('select public.assume_event_conduction(%L)', v_e));
  perform pg_temp.assert_that(v_msg = 'not_allowed', 'caso 6: Jogador recebe not_allowed');
  perform pg_temp.as_(v_inactive);
  v_msg := pg_temp.err(format('select public.assume_event_conduction(%L)', v_e));
  perform pg_temp.assert_that(v_msg = 'not_allowed', 'caso 6: Membro inativo recebe not_allowed');
  perform pg_temp.assert_that(
    (select e.conductor_id from public.event e where e.id = v_e) = v_owner
    and (select e.conduction_seq from public.event e where e.id = v_e) is null
    and pg_temp.notify_count(v_e) = v_count
    and (pg_temp.view_of(v_owner, v_e) ->> 'seq')::bigint = v_seq0,
    'caso 6: recusa não muda nem avisa');

  perform pg_temp.as_(v_admin);
  perform public.assume_event_conduction(v_e);
  v_seq1 := (pg_temp.view_of(v_admin, v_e) ->> 'seq')::bigint;
  perform pg_temp.as_(v_admin2);
  perform public.assume_event_conduction(v_e);
  v_seq2 := (pg_temp.view_of(v_admin2, v_e) ->> 'seq')::bigint;
  perform pg_temp.assert_that(
    (select e.conductor_id from public.event e where e.id = v_e) = v_admin2
    and v_seq1 > v_seq0 and v_seq2 > v_seq1
    and pg_temp.notified(v_e, v_seq1) and pg_temp.notified(v_e, v_seq2)
    and pg_temp.notify_count(v_e) = v_count + 2
    and pg_temp.view_of(v_admin2, v_e) ->> 'conductor_name' = 'Admin Dois'
    and (pg_temp.view_of(v_admin, v_e) #>> '{viewer,can_assume}')::boolean,
    'caso 8: fica o último e cada troca sobe o seq');

  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    v_racha, current_date + 7, time '19:00', 'Quadra Reforco', 'upcoming', v_owner, 50,
    24, 5, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10
  ) returning id into v_up;
  perform pg_temp.assert_that(
    not (pg_temp.view_of(v_admin, v_up) #>> '{viewer,can_assume}')::boolean,
    'caso 5: Evento upcoming não oferece assumir');

  v_count := pg_temp.notify_count(v_up);
  perform pg_temp.as_(v_admin);
  perform public.assume_event_conduction(v_up);
  perform pg_temp.assert_that(
    (select e.conductor_id from public.event e where e.id = v_up) = v_admin
    and pg_temp.notify_count(v_up) = v_count + 1
    and (pg_temp.view_of(v_admin, v_up) ->> 'seq')::bigint > 0,
    'assumir Evento upcoming também avisa');

  raise notice 'PASS: recusas, upcoming e duas trocas';
end $$;

rollback;
