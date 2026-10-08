-- Temporada: totais do Ranking e lista de Eventos, só na leitura.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/season_ranking.sql
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

-- Segundo Evento no mesmo Racha, com o elenco passado (não precisa ser o da cena).
create function pg_temp.event_on(
  p_racha uuid,
  p_owner uuid,
  p_tag text,
  p_line jsonb,
  p_gk jsonb
) returns jsonb
language plpgsql as $$
declare
  v_event uuid;
  v_tn integer;
  v_tid uuid;
  v_i integer;
  v_teams uuid[] := '{}';
  v_line uuid[];
begin
  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    p_racha, current_date + 1, time '20:00', 'Quadra Reforco', 'active', p_owner, 50,
    24, 5, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10
  ) returning id into v_event;

  insert into public.event_sort (
    event_id, status, signature, version, leftover_ids, mode, goalkeepers_per_team,
    balance_score, balance_label, balance_diff, super_diff, capped_by_super,
    confirmed_at, confirmed_by
  ) values (
    v_event, 'confirmed', p_tag, 1, '{}', 'normal', true,
    80, 'Equilibrado', 0, 0, false, now(), p_owner
  );

  for v_tn in 0..jsonb_array_length(p_line) - 1 loop
    insert into public.event_sort_team (event_id, team_number, queue_order, win_streak)
    values (v_event, v_tn + 1, v_tn + 1, 0)
    returning id into v_tid;
    v_teams := v_teams || v_tid;
    select array_agg(x::uuid) into v_line
    from jsonb_array_elements_text(p_line -> v_tn) x;
    for v_i in 1..cardinality(v_line) loop
      insert into public.event_sort_team_player (
        event_id, team_id, profile_id, stars_snapshot, is_super_star_snapshot,
        primary_position_snapshot
      ) values (v_event, v_tid, v_line[v_i], 3, false, 'ANY');
    end loop;
    insert into public.event_sort_goalkeeper (event_id, team_id, profile_id)
    values (v_event, v_tid, (p_gk ->> v_tn)::uuid);
  end loop;

  insert into public.event_attendance (event_id, profile_id, status, did_attend)
  select v_event, x::uuid, 'confirmed', true
  from (
    select jsonb_array_elements_text(jsonb_array_elements(p_line)) as x
    union
    select jsonb_array_elements_text(p_gk)
  ) s;

  return jsonb_build_object('event', v_event, 'teams', to_jsonb(v_teams));
end $$;

create function pg_temp.rank_member(p jsonb, p_id uuid) returns jsonb
language sql as $$
  select x
  from jsonb_array_elements(coalesce(p -> 'members', '[]'::jsonb)) x
  where x ->> 'profile_id' = p_id::text
$$;

-- O motor reescreve o goleiro do Time no fim da Partida; repor antes de cada
-- Iniciar deixa o crédito no papel certo mesmo se a fila do gol rodar.
create function pg_temp.put_gk(p_event uuid, p_team uuid, p_person uuid, p_slot smallint)
returns void
language plpgsql as $$
begin
  update public.event_sort_goalkeeper
  set team_id = null, queue_order = p_slot
  where event_id = p_event and team_id = p_team and person_id is distinct from p_person;
  update public.event_sort_goalkeeper
  set team_id = p_team, queue_order = null
  where event_id = p_event and profile_id = p_person;
end $$;

-- ============================================================
-- 1. Gol e assistência de goleiro somam nas listas
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_star uuid;
  v_k uuid;
  v_match uuid;
  v_rank jsonb;
  v_k_row jsonb;
  v_star_row jsonb;
  v_shown integer;
  v_year integer;
begin
  v := pg_temp.scene('k-lists', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  v_k := (v #>> '{gk,0}')::uuid;
  update public.profile set display_name = 'Diego' where id = v_star;
  update public.profile set display_name = 'Juninho' where id = v_k;
  perform pg_temp.as_(v_owner);

  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'kg', v_t1, v_k, null, false);
  perform public.add_event_match_goal(v_match, 'la', v_t1, v_star, v_k, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_rank := public.get_season_ranking(v_r);
  v_k_row := pg_temp.rank_member(v_rank, v_k);
  v_star_row := pg_temp.rank_member(v_rank, v_star);
  select c.shown_overall into v_shown
  from private.racha_member_cards(v_r) c where c.profile_id = v_k;
  v_year := extract(year from private.racha_season_start(
    v_r, (now() at time zone 'America/Sao_Paulo')::date
  ))::integer;

  perform pg_temp.assert_that(
    (v_rank ->> 'season_year')::integer = v_year
    and (v_k_row ->> 'goals')::integer = 1
    and (v_k_row ->> 'assists')::integer = 1
    and (v_k_row ->> 'wins')::integer = 1
    and (v_k_row ->> 'overall')::integer = v_shown
    and v_k_row ->> 'display_name' = 'Juninho'
    and (v_star_row ->> 'goals')::integer = 1
    and (v_star_row ->> 'assists')::integer = 0
    and pg_temp.rank_member(v_rank, v_owner) is null,
    'caso 1: gol e assistência de goleiro somam; zero fica de fora');

  raise notice 'PASS: gol e assistência de goleiro somam nas listas';
end $$;

-- ============================================================
-- 2. Gol contra fora do Artilheiro
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_star uuid;
  v_match uuid;
  v_rank jsonb;
  v_goals integer;
begin
  v := pg_temp.scene('own', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  perform pg_temp.as_(v_owner);

  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'regular', v_t1, v_star, null, false);
  perform public.add_event_match_goal(v_match, 'own', v_t2, null, null, true);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_rank := public.get_season_ranking(v_r);
  select coalesce(sum((x ->> 'goals')::integer), 0) into v_goals
  from jsonb_array_elements(v_rank -> 'members') x;

  perform pg_temp.assert_that(
    (pg_temp.rank_member(v_rank, v_star) ->> 'goals')::integer = 1
    and v_goals = 1,
    'caso 2: gol contra não entra em goals');

  raise notice 'PASS: gol contra fora do Artilheiro';
end $$;

-- ============================================================
-- 3. Vitória dos dois papéis soma em wins
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_player uuid;
  v_mate uuid;
  v_match uuid;
  v_rank jsonb;
begin
  v := pg_temp.scene('both-wins', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_mate := (v #>> '{line,0,1}')::uuid;
  perform pg_temp.as_(v_owner);

  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'm', v_t1, v_mate, null, false);
  perform public.finish_event_match(v_match);

  update public.event_sort_team_player
  set left_at = now()
  where event_id = v_e and profile_id = v_player and left_at is null;
  insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id)
  values (v_e, 80, v_player);
  perform pg_temp.put_gk(v_e, v_t1, v_player, 100::smallint);

  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'm2', v_t1, v_mate, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_rank := public.get_season_ranking(v_r);
  perform pg_temp.assert_that(
    (pg_temp.rank_member(v_rank, v_player) ->> 'wins')::integer = 2,
    'caso 3: Vitória de linha e de goleiro somam');

  raise notice 'PASS: Vitória dos dois papéis soma em wins';
end $$;

-- ============================================================
-- 4. Membro inativo aparece com is_active = false
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_player uuid;
  v_match uuid;
  v_rank jsonb;
  v_row jsonb;
begin
  v := pg_temp.scene('inactive', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  perform pg_temp.as_(v_owner);

  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'g', v_t1, v_player, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  update public.member set is_active = false
  where racha_id = v_r and profile_id = v_player;

  v_rank := public.get_season_ranking(v_r);
  v_row := pg_temp.rank_member(v_rank, v_player);
  perform pg_temp.assert_that(
    v_row is not null
    and (v_row ->> 'is_active')::boolean = false
    and (v_row ->> 'goals')::integer = 1,
    'caso 4: inativo entra com is_active false');

  raise notice 'PASS: Membro inativo aparece com is_active = false';
end $$;

-- ============================================================
-- 5. Avulso nunca aparece
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_left uuid;
  v_guest uuid;
  v_match uuid;
  v_rank jsonb;
begin
  v := pg_temp.scene('guest', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_left := (v #>> '{line,0,4}')::uuid;
  update public.event_sort_team_player
  set left_at = now()
  where team_id = v_t1 and profile_id = v_left and left_at is null;
  perform pg_temp.as_(v_owner);
  perform public.include_event_sort_guest(
    v_e, 'Caio', 'OUTFIELD', 'ANY', null, 3::smallint, false
  );
  select g.id into v_guest
  from public.event_guest g
  where g.event_id = v_e and g.display_name = 'Caio';
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'c', v_t1, v_guest, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_rank := public.get_season_ranking(v_r);
  perform pg_temp.assert_that(
    not exists (
      select 1 from jsonb_array_elements(v_rank -> 'members') x
      where x ->> 'profile_id' = v_guest::text
    ),
    'caso 5: Avulso não aparece no ranking');

  raise notice 'PASS: Avulso nunca aparece';
end $$;

-- ============================================================
-- 6. Evento active fora das duas leituras
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_star uuid;
  v_match uuid;
  v_rank jsonb;
  v_events jsonb;
begin
  v := pg_temp.scene('open', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'g', v_t1, v_star, null, false);
  perform public.finish_event_match(v_match);

  v_rank := public.get_season_ranking(v_r);
  v_events := public.get_season_events(v_r);
  perform pg_temp.assert_that(
    pg_temp.rank_member(v_rank, v_star) is null
    and v_events = '[]'::jsonb,
    'caso 6: Evento active fora do ranking e dos eventos');

  perform public.finish_event(v_e);
  v_rank := public.get_season_ranking(v_r);
  v_events := public.get_season_events(v_r);
  perform pg_temp.assert_that(
    (pg_temp.rank_member(v_rank, v_star) ->> 'goals')::integer = 1
    and jsonb_array_length(v_events) = 1
    and (v_events #>> '{0,event_id}')::uuid = v_e,
    'caso 6: ao encerrar, entra nas duas leituras');

  raise notice 'PASS: Evento active fora das duas leituras';
end $$;

-- ============================================================
-- 7. Evento de antes do aniversário fora da Temporada atual
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_star uuid;
  v_match uuid;
  v_rank jsonb;
  v_events jsonb;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_born date := make_date(
    2020, extract(month from v_today)::integer, extract(day from v_today)::integer
  );
begin
  v := pg_temp.scene('anniv', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'g', v_t1, v_star, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  update public.racha
  set created_at = (v_born + time '15:00') at time zone 'America/Sao_Paulo'
  where id = v_r;
  update public.event set starts_on = v_today - 1 where id = v_e;
  update public.event_match
  set started_at = ((v_today - 1) + time '15:00') at time zone 'America/Sao_Paulo'
  where id = v_match;

  v_rank := public.get_season_ranking(v_r);
  v_events := public.get_season_events(v_r);
  perform pg_temp.assert_that(
    private.racha_season_start(v_r, v_today) = v_today
    and private.racha_season_start(v_r, v_today - 1) < v_today
    and pg_temp.rank_member(v_rank, v_star) is null
    and v_events = '[]'::jsonb,
    'caso 7: Evento da Temporada anterior fica de fora');

  raise notice 'PASS: Evento de antes do aniversário fora da Temporada';
end $$;

-- ============================================================
-- 8. get_season_events em ordem, Evento sem Partida com match_count 0
-- ============================================================
do $$
declare
  v jsonb;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_star uuid;
  v_old uuid;
  v_empty uuid;
  v_new uuid;
  v_match uuid;
  v_second jsonb;
  v_third jsonb;
  v_events jsonb;
begin
  v := pg_temp.scene('order', array[3, 3], 3);
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_old := (v ->> 'event')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  update public.event set place = 'Quadra Antiga' where id = v_old;
  perform pg_temp.as_(v_owner);

  v_match := (public.start_event_match(v_old) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'old', v_t1, v_star, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_old);
  -- starts_on >= hoje em Brasília: o Racha nasceu agora, a Temporada
  -- atual começa hoje; datas anteriores cairiam no ano passado.
  update public.event
  set starts_on = current_date, ended_at = now() - interval '2 hours'
  where id = v_old;

  v_second := pg_temp.event_on(v_r, v_owner, 'empty', v -> 'line', v -> 'gk');
  v_empty := (v_second ->> 'event')::uuid;
  update public.event set place = 'Quadra Vazia' where id = v_empty;
  perform public.finish_event(v_empty);
  update public.event
  set starts_on = current_date + 1, ended_at = now() - interval '1 hour'
  where id = v_empty;

  v_third := pg_temp.event_on(v_r, v_owner, 'new', v -> 'line', v -> 'gk');
  v_new := (v_third ->> 'event')::uuid;
  v_t1 := (v_third #>> '{teams,0}')::uuid;
  update public.event
  set place = 'Quadra Nova', starts_on = current_date + 2
  where id = v_new;
  v_match := (public.start_event_match(v_new) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'new', v_t1, v_star, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_new);

  v_events := public.get_season_events(v_r);
  perform pg_temp.assert_that(
    jsonb_array_length(v_events) = 3
    and (v_events #>> '{0,event_id}')::uuid = v_new
    and v_events #>> '{0,place}' = 'Quadra Nova'
    and (v_events #>> '{0,match_count}')::integer = 1
    and (v_events #>> '{1,event_id}')::uuid = v_empty
    and v_events #>> '{1,place}' = 'Quadra Vazia'
    and (v_events #>> '{1,match_count}')::integer = 0
    and v_events #> '{1,scorers}' = '[]'::jsonb
    and (v_events #>> '{1,top_goals}')::integer = 0
    and (v_events #>> '{2,event_id}')::uuid = v_old
    and v_events #>> '{2,place}' = 'Quadra Antiga',
    'caso 8: eventos em ordem e vazio com match_count 0');

  raise notice 'PASS: get_season_events em ordem, Evento sem Partida';
end $$;

-- ============================================================
-- 9. Membro inativo e quem não é Membro recusados nas duas
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_player uuid;
  v_stranger uuid;
  v_t1 uuid;
  v_match uuid;
begin
  v := pg_temp.scene('acl', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_stranger := pg_temp.person('Estranho', 'OUTFIELD');

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'acl', v_t1, v_player, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  update public.member set is_active = false
  where racha_id = v_r and profile_id = v_player;

  perform pg_temp.as_(v_player);
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.get_season_ranking(%L)', v_r)) = 'not_allowed'
    and pg_temp.err(format('select public.get_season_events(%L)', v_r)) = 'not_allowed',
    'caso 9: Membro inativo recusado nas duas');

  perform pg_temp.as_(v_stranger);
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.get_season_ranking(%L)', v_r)) = 'not_allowed'
    and pg_temp.err(format('select public.get_season_events(%L)', v_r)) = 'not_allowed',
    'caso 9: quem não é Membro recusado nas duas');

  raise notice 'PASS: inativo e estranho not_allowed nas duas leituras';
end $$;

-- ============================================================
-- 10. get_racha_last_resenha não inclui place; chaves de sempre
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_star uuid;
  v_match uuid;
  v_last jsonb;
  v_keys text[];
begin
  v := pg_temp.scene('last-keys', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'g', v_t1, v_star, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_last := public.get_racha_last_resenha(v_r);
  select array_agg(k order by k) into v_keys
  from jsonb_object_keys(v_last) k;

  perform pg_temp.assert_that(
    v_keys = array['event_id', 'match_count', 'scorers', 'starts_on', 'top_goals']
    and not (v_last ? 'place')
    and (v_last ->> 'event_id')::uuid = v_e
    and (v_last ->> 'match_count')::integer = 1
    and (v_last ->> 'top_goals')::integer = 1,
    'caso 10: last_resenha sem place e com as chaves de sempre');

  raise notice 'PASS: get_racha_last_resenha sem place';
end $$;

rollback;
