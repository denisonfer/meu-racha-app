-- Overall e Card: Temporada, créditos e as duas fórmulas, só na leitura.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/overall_and_card.sql
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

create function pg_temp.card(p jsonb, p_id uuid) returns jsonb
language sql as $$
  select x
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) x
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
-- 1. Sem Partida: 40, zeros, papel do Onde joga
-- ============================================================
do $$
declare
  v jsonb;
  v_r uuid;
  v_owner uuid;
  v_gk uuid;
  v_cards jsonb;
  v_owner_card jsonb;
  v_gk_card jsonb;
  v_year integer;
begin
  v := pg_temp.scene('none', array[3, 3], 3);
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_gk := (v ->> 'extra_gk')::uuid;
  perform pg_temp.as_(v_owner);

  v_cards := public.get_racha_cards(v_r);
  v_owner_card := pg_temp.card(v_cards, v_owner);
  v_gk_card := pg_temp.card(v_cards, v_gk);
  v_year := extract(year from private.racha_season_start(
    v_r, (now() at time zone 'America/Sao_Paulo')::date
  ))::integer;

  perform pg_temp.assert_that(
    (v_owner_card ->> 'overall')::integer = 40
    and v_owner_card ->> 'shown_role' = 'LINE'
    and (v_owner_card #>> '{line,matches}')::integer = 0
    and (v_owner_card #>> '{line,goals}')::integer = 0
    and (v_owner_card #>> '{line,assists}')::integer = 0
    and (v_owner_card #>> '{line,wins}')::integer = 0
    and (v_owner_card #>> '{keeper,matches}')::integer = 0
    and (v_owner_card #>> '{keeper,wins}')::integer = 0
    and (v_owner_card #>> '{keeper,clean_sheets}')::integer = 0
    and (v_owner_card #>> '{keeper,goals}')::integer = 0
    and (v_owner_card ->> 'season_year')::integer = v_year
    and v_owner_card ? 'line' and v_owner_card ? 'keeper'
    and v_owner_card ->> 'plays_as' = 'OUTFIELD'
    and v_owner_card ->> 'primary_position' = 'ANY'
    and (v_gk_card ->> 'overall')::integer = 40
    and v_gk_card ->> 'shown_role' = 'GOALKEEPER'
    and v_gk_card ->> 'plays_as' = 'GOALKEEPER'
    and v_gk_card ? 'primary_position'
    and v_gk_card ->> 'primary_position' is null
    and (v_gk_card #>> '{line,matches}')::integer = 0
    and (v_gk_card #>> '{keeper,matches}')::integer = 0,
    'caso 1: sem Partida, 40 e o papel do Onde joga');

  raise notice 'PASS: sem Partida, 40 e papel do Onde joga';
end $$;

-- ============================================================
-- 2. Duas Partidas e 3 gols: carta 40, números reais
-- Sem o mínimo de 3 a fórmula daria 43 (P=20, gr=20/42, score≈0,1238).
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
  v_i integer;
  v_cards jsonb;
  v_card jsonb;
  v_resenha jsonb;
begin
  v := pg_temp.scene('two', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  perform pg_temp.as_(v_owner);

  for v_i in 1..2 loop
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    perform public.add_event_match_goal(v_match, 'a', v_t1, v_star, null, false);
    if v_i = 1 then
      perform public.add_event_match_goal(v_match, 'b', v_t1, v_star, null, false);
    end if;
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_e);

  v_cards := public.get_racha_cards(v_r);
  v_card := pg_temp.card(v_cards, v_star);
  v_resenha := public.get_event_resenha(v_e);

  perform pg_temp.assert_that(
    (v_card ->> 'overall')::integer = 40
    and v_card ->> 'shown_role' = 'LINE'
    and (v_card #>> '{line,matches}')::integer = 2
    and (v_card #>> '{line,goals}')::integer = 3
    and (v_card #>> '{line,wins}')::integer = 2
    and (v_resenha #>> '{scorer_card,overall}')::integer = 40
    and (v_resenha #>> '{scorer_card,line,matches}')::integer = 2
    and (v_resenha #>> '{scorer_card,line,goals}')::integer = 3
    and v_resenha #>> '{scorer_card,shown_role}' = 'LINE'
    and v_resenha #>> '{scorer_card,plays_as}' = 'OUTFIELD'
    and v_resenha #>> '{scorer_card,primary_position}' = 'ANY'
    and v_resenha -> 'scorer_card' ? 'keeper'
    and v_resenha -> 'scorer_card' ? 'season_year',
    'caso 2: 2 Partidas mostram 40 com os 3 gols');

  raise notice 'PASS: 2 Partidas com 3 gols mostram 40';
end $$;

-- ============================================================
-- 3. Três Partidas: Overall calculado, não o piso
-- 3 Partidas, P=18, 3 gols do astro, 0 assistência, 3 vitórias.
-- gr=18/43, score=5,1/43≈0,11860 → 42,439 → 42
-- Goleiro do Time 1 com 0 sofridos e média>0 → 47
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
  v_i integer;
  v_cards jsonb;
  v_star_card jsonb;
  v_k_card jsonb;
  v_resenha jsonb;
begin
  v := pg_temp.scene('three', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  v_k := (v #>> '{gk,0}')::uuid;
  perform pg_temp.as_(v_owner);

  for v_i in 1..3 loop
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    perform public.add_event_match_goal(v_match, 'g', v_t1, v_star, null, false);
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_e);

  v_cards := public.get_racha_cards(v_r);
  v_star_card := pg_temp.card(v_cards, v_star);
  v_k_card := pg_temp.card(v_cards, v_k);
  v_resenha := public.get_event_resenha(v_e);

  perform pg_temp.assert_that(
    (v_star_card ->> 'overall')::integer = 42
    and (v_star_card #>> '{line,matches}')::integer = 3
    and (v_star_card #>> '{line,goals}')::integer = 3
    and (v_k_card ->> 'shown_role') = 'GOALKEEPER'
    and (v_k_card ->> 'overall')::integer = 47
    and (v_k_card #>> '{keeper,matches}')::integer = 3
    and (v_k_card #>> '{keeper,clean_sheets}')::integer = 3
    and (v_resenha #>> '{scorer_card,overall}')::integer = 42
    and v_resenha #>> '{scorer_card,shown_role}' = 'LINE',
    'caso 3: 3 Partidas mostram o Overall calculado');

  raise notice 'PASS: 3 Partidas mostram o Overall calculado';
end $$;

-- ============================================================
-- 4. Conjunto fixo, conferido à mão (médias do próprio conjunto)
-- 10 Partidas, 6 linhas por Partida (P=60), 16 gols, 0 assistência.
-- Médias: gols 16/60, assistências 0, sofridos 16/20 = 0,8.
-- L: 10 Partidas, 10 gols, 10 vitórias, div=50.
--   gr=10/50/(16/60)=0,75  vr=0,2
--   score=0,45*0,75/2 + 0,35*0,2 = 0,23875
--   (0,23875-0,10)/0,45 = 0,308333… → 40+59*isso = 58,1916… → 58
-- S: 3 Partidas, 6 gols, 3 vitórias, div=43.
--   gr=6/43/(16/60)=45/86
--   score=0,225*(45/86)+0,35*(3/43) ≈ 0,142151
--   (0,142151-0,10)/0,45 ≈ 0,09367 → 40+59*isso ≈ 45,526 → 46
-- K: 5 Partidas, 0 sofridos, média>0, div=45.
--   r=64/45  (1,6-64/45)/0,9 = 16/81
--   40+59*(16/81) = 51,6543… → 52
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_l uuid;
  v_s uuid;
  v_p3 uuid;
  v_x uuid;
  v_k uuid;
  v_xgk uuid;
  v_match uuid;
  v_i integer;
  v_second jsonb;
  v_cards jsonb;
  v_l_card jsonb;
  v_s_card jsonb;
  v_k_card jsonb;
begin
  v := pg_temp.scene('hand', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_l := (v #>> '{line,0,0}')::uuid;
  v_s := (v #>> '{line,0,1}')::uuid;
  v_p3 := (v #>> '{line,0,2}')::uuid;
  v_x := (v #>> '{extras,0}')::uuid;
  v_k := (v #>> '{gk,0}')::uuid;
  v_xgk := (v ->> 'extra_gk')::uuid;
  perform pg_temp.as_(v_owner);

  for v_i in 1..5 loop
    if v_i = 4 then
      update public.event_sort_team_player
      set left_at = now()
      where event_id = v_e and profile_id = v_s and left_at is null;
      insert into public.event_sort_team_player (
        event_id, team_id, profile_id, stars_snapshot,
        is_super_star_snapshot, primary_position_snapshot
      ) values (v_e, v_t1, v_x, 3, false, 'ANY');
    end if;
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    perform public.add_event_match_goal(v_match, 'l', v_t1, v_l, null, false);
    if v_i <= 3 then
      perform public.add_event_match_goal(v_match, 's1', v_t1, v_s, null, false);
      perform public.add_event_match_goal(v_match, 's2', v_t1, v_s, null, false);
    end if;
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_e);

  v_second := pg_temp.event_on(
    v_r, v_owner, 'hand2',
    jsonb_build_array(
      jsonb_build_array(v_l, v_x, v_p3),
      v -> 'line' -> 1
    ),
    jsonb_build_array(v_xgk, (v #>> '{gk,1}')::uuid)
  );
  v_e := (v_second ->> 'event')::uuid;
  v_t1 := (v_second #>> '{teams,0}')::uuid;
  for v_i in 1..5 loop
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    perform public.add_event_match_goal(v_match, 'l', v_t1, v_l, null, false);
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_e);

  v_cards := public.get_racha_cards(v_r);
  v_l_card := pg_temp.card(v_cards, v_l);
  v_s_card := pg_temp.card(v_cards, v_s);
  v_k_card := pg_temp.card(v_cards, v_k);

  perform pg_temp.assert_that(
    (v_l_card ->> 'overall')::integer = 58
    and v_l_card ->> 'shown_role' = 'LINE'
    and (v_l_card #>> '{line,matches}')::integer = 10
    and (v_l_card #>> '{line,goals}')::integer = 10
    and (v_l_card #>> '{line,assists}')::integer = 0
    and (v_l_card #>> '{line,wins}')::integer = 10
    and (v_s_card ->> 'overall')::integer = 46
    and (v_s_card #>> '{line,matches}')::integer = 3
    and (v_s_card #>> '{line,goals}')::integer = 6
    and (v_s_card #>> '{line,wins}')::integer = 3
    and (v_k_card ->> 'overall')::integer = 52
    and v_k_card ->> 'shown_role' = 'GOALKEEPER'
    and (v_k_card #>> '{keeper,matches}')::integer = 5
    and (v_k_card #>> '{keeper,wins}')::integer = 5
    and (v_k_card #>> '{keeper,clean_sheets}')::integer = 5
    and (v_k_card #>> '{keeper,goals}')::integer = 0,
    'caso 4: Overall à mão 58, 46 e 52');

  raise notice 'PASS: conjunto fixo 58 / 46 / 52';
end $$;

-- ============================================================
-- 5. Gol contra: ninguém na linha; entra na média do goleiro
-- 3 Partidas, 1 gol contra, K não sofreu. Se a média ignorasse
-- o gol contra, avg=0 e o Overall de K seria 40, não 47.
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t2 uuid;
  v_k uuid;
  v_k2 uuid;
  v_match uuid;
  v_i integer;
  v_cards jsonb;
  v_goals integer;
  v_k_conc integer;
  v_k2_conc integer;
begin
  v := pg_temp.scene('own', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_k := (v #>> '{gk,0}')::uuid;
  v_k2 := (v #>> '{gk,1}')::uuid;
  perform pg_temp.as_(v_owner);

  for v_i in 1..3 loop
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    if v_i = 1 then
      perform public.add_event_match_goal(v_match, 'own', v_t2, null, null, true);
    end if;
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_e);

  v_cards := public.get_racha_cards(v_r);
  select coalesce(sum((x #>> '{line,goals}')::integer), 0) into v_goals
  from jsonb_array_elements(v_cards) x;
  select c.keeper_conceded into v_k_conc
  from private.racha_member_cards(v_r) c where c.profile_id = v_k;
  select c.keeper_conceded into v_k2_conc
  from private.racha_member_cards(v_r) c where c.profile_id = v_k2;

  perform pg_temp.assert_that(
    v_goals = 0
    and v_k_conc = 0
    and v_k2_conc = 1
    and (pg_temp.card(v_cards, v_k) ->> 'overall')::integer = 47
    and (pg_temp.card(v_cards, v_k) #>> '{keeper,matches}')::integer = 3,
    'caso 5: gol contra fora da linha e dentro da média do goleiro');

  raise notice 'PASS: gol contra não credita linha e entra na média';
end $$;

-- ============================================================
-- 6. Expulso conta a Partida e não a Vitória; goleiro expulso
-- não leva Vitória nem jogo sem sofrer, e só os gols gravados nele
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_red uuid;
  v_yellow uuid;
  v_clean uuid;
  v_opp uuid;
  v_k uuid;
  v_match uuid;
  v_cards jsonb;
  v_conc integer;
begin
  v := pg_temp.scene('red', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_red := (v #>> '{line,0,0}')::uuid;
  v_yellow := (v #>> '{line,0,1}')::uuid;
  v_clean := (v #>> '{line,0,2}')::uuid;
  v_opp := (v #>> '{line,1,0}')::uuid;
  v_k := (v #>> '{gk,0}')::uuid;
  perform pg_temp.as_(v_owner);

  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'c1', v_t2, v_opp, null, false);
  perform public.add_event_match_card(v_match, v_k, null, 'red');
  perform public.add_event_match_goal(v_match, 'c2', v_t2, v_opp, null, false);
  perform public.add_event_match_card(v_match, v_red, null, 'red');
  perform public.add_event_match_card(v_match, v_yellow, null, 'yellow');
  perform public.add_event_match_goal(v_match, 'w1', v_t1, v_clean, null, false);
  perform public.add_event_match_goal(v_match, 'w2', v_t1, v_clean, null, false);
  perform public.add_event_match_goal(v_match, 'w3', v_t1, v_clean, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_cards := public.get_racha_cards(v_r);
  select c.keeper_conceded into v_conc
  from private.racha_member_cards(v_r) c where c.profile_id = v_k;

  perform pg_temp.assert_that(
    (pg_temp.card(v_cards, v_red) #>> '{line,matches}')::integer = 1
    and (pg_temp.card(v_cards, v_red) #>> '{line,wins}')::integer = 0
    and (pg_temp.card(v_cards, v_yellow) #>> '{line,wins}')::integer = 1
    and (pg_temp.card(v_cards, v_clean) #>> '{line,wins}')::integer = 1
    and (pg_temp.card(v_cards, v_k) #>> '{keeper,matches}')::integer = 1
    and (pg_temp.card(v_cards, v_k) #>> '{keeper,wins}')::integer = 0
    and (pg_temp.card(v_cards, v_k) #>> '{keeper,clean_sheets}')::integer = 0
    and v_conc = 1,
    'caso 6: expulso joga e não vence; goleiro expulso sem crédito');

  raise notice 'PASS: expulso conta Partida e não Vitória';
end $$;

-- Empate não é Vitória (regra do crédito, junto do caso 6).
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_a uuid;
  v_b uuid;
  v_match uuid;
  v_cards jsonb;
begin
  v := pg_temp.scene('draw', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_a := (v #>> '{line,0,0}')::uuid;
  v_b := (v #>> '{line,1,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'a', v_t1, v_a, null, false);
  perform public.add_event_match_goal(v_match, 'b', v_t2, v_b, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);
  v_cards := public.get_racha_cards((v ->> 'racha')::uuid);
  perform pg_temp.assert_that(
    (pg_temp.card(v_cards, v_a) #>> '{line,matches}')::integer = 1
    and (pg_temp.card(v_cards, v_a) #>> '{line,wins}')::integer = 0
    and (pg_temp.card(v_cards, v_b) #>> '{line,wins}')::integer = 0,
    'empate não soma Vitória');
  raise notice 'PASS: empate não soma Vitória';
end $$;

-- ============================================================
-- 7. Goleiro de amarelo no apito: Vitória e jogo sem sofrer
-- (0 a 0 decidido nos pênaltis — o Time não sofreu gol)
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_t1 uuid;
  v_k uuid;
  v_match uuid;
  v_card jsonb;
begin
  v := pg_temp.scene('yellowk', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_k := (v #>> '{gk,0}')::uuid;
  update public.event set tie_rule = 'PENALTIES' where id = v_e;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_card(v_match, v_k, null, 'yellow');
  perform public.finish_event_match(v_match, v_t1);
  perform public.finish_event(v_e);
  v_card := pg_temp.card(public.get_racha_cards((v ->> 'racha')::uuid), v_k);
  perform pg_temp.assert_that(
    (v_card #>> '{keeper,matches}')::integer = 1
    and (v_card #>> '{keeper,wins}')::integer = 1
    and (v_card #>> '{keeper,clean_sheets}')::integer = 1
    and (v_card ->> 'overall')::integer = 40,
    'caso 7: amarelo no apito leva Vitória e jogo sem sofrer');
  raise notice 'PASS: goleiro de amarelo leva Vitória e jogo sem sofrer';
end $$;

-- ============================================================
-- 8. Dois papéis: mostra o de mais Partidas; empate fica na linha
-- 8a: 1 na linha e 4 no gol, 0 sofridos → linha 40, gol 50, mostra GOALKEEPER
-- 8b: 3 e 3. Linha fica em 40 (só Vitória). Gol com 0 sofridos daria 47,
--     mas o empate mostra a linha, então o overall mostrado é 40.
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
  v_k uuid;
  v_match uuid;
  v_i integer;
  v_card jsonb;
  v_line integer;
  v_keep integer;
begin
  v := pg_temp.scene('roles', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_mate := (v #>> '{line,0,1}')::uuid;
  v_k := (v #>> '{gk,0}')::uuid;
  perform pg_temp.as_(v_owner);

  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'm', v_t1, v_mate, null, false);
  perform public.finish_event_match(v_match);

  update public.event_sort_team_player
  set left_at = now()
  where event_id = v_e and profile_id = v_player and left_at is null;
  insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id)
  values (v_e, 80, v_player);

  for v_i in 1..4 loop
    perform pg_temp.put_gk(v_e, v_t1, v_player, (100 + v_i)::smallint);
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    perform public.add_event_match_goal(v_match, 'm', v_t1, v_mate, null, false);
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_e);

  v_card := pg_temp.card(public.get_racha_cards(v_r), v_player);
  select c.line_overall, c.keeper_overall into v_line, v_keep
  from private.racha_member_cards(v_r) c where c.profile_id = v_player;

  perform pg_temp.assert_that(
    (v_card #>> '{line,matches}')::integer = 1
    and (v_card #>> '{keeper,matches}')::integer = 4
    and v_line = 40
    and v_keep = 50
    and v_card ->> 'shown_role' = 'GOALKEEPER'
    and (v_card ->> 'overall')::integer = 50,
    'caso 8: mais Partidas no gol mostra o Overall de goleiro');

  raise notice 'PASS: mais Partidas no gol mostra GOALKEEPER';
end $$;

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
  v_i integer;
  v_card jsonb;
  v_line integer;
  v_keep integer;
begin
  v := pg_temp.scene('tie-role', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_mate := (v #>> '{line,0,1}')::uuid;
  perform pg_temp.as_(v_owner);

  for v_i in 1..3 loop
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    perform public.add_event_match_goal(v_match, 'm', v_t1, v_mate, null, false);
    perform public.finish_event_match(v_match);
  end loop;

  update public.event_sort_team_player
  set left_at = now()
  where event_id = v_e and profile_id = v_player and left_at is null;
  insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id)
  values (v_e, 80, v_player);

  for v_i in 1..3 loop
    perform pg_temp.put_gk(v_e, v_t1, v_player, (100 + v_i)::smallint);
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    perform public.add_event_match_goal(v_match, 'm', v_t1, v_mate, null, false);
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_e);

  v_card := pg_temp.card(public.get_racha_cards(v_r), v_player);
  select c.line_overall, c.keeper_overall into v_line, v_keep
  from private.racha_member_cards(v_r) c where c.profile_id = v_player;

  perform pg_temp.assert_that(
    (v_card #>> '{line,matches}')::integer = 3
    and (v_card #>> '{keeper,matches}')::integer = 3
    and v_line = 40
    and v_keep = 47
    and v_card ->> 'shown_role' = 'LINE'
    and (v_card ->> 'overall')::integer = 40,
    'caso 8: empate de Partidas mostra a linha, não o Overall maior');

  raise notice 'PASS: empate de Partidas mostra a linha';
end $$;

-- ============================================================
-- 9. Gol de goleiro aparece; sem gol, o banco devolve 0
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_t1 uuid;
  v_k uuid;
  v_k2 uuid;
  v_match uuid;
  v_cards jsonb;
begin
  v := pg_temp.scene('kgoal', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_k := (v #>> '{gk,0}')::uuid;
  v_k2 := (v #>> '{gk,1}')::uuid;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'kg', v_t1, v_k, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);
  v_cards := public.get_racha_cards((v ->> 'racha')::uuid);
  perform pg_temp.assert_that(
    (pg_temp.card(v_cards, v_k) #>> '{keeper,goals}')::integer = 1
    and (pg_temp.card(v_cards, v_k) #>> '{line,goals}')::integer = 0
    and (pg_temp.card(v_cards, v_k2) #>> '{keeper,goals}')::integer = 0,
    'caso 9: gol de goleiro volta no keeper.goals');
  raise notice 'PASS: gol de goleiro e zero quando não marcou';
end $$;

-- ============================================================
-- 10. Evento ainda active não entra; entra ao encerrar
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
  v_before jsonb;
  v_after jsonb;
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
  v_before := pg_temp.card(public.get_racha_cards(v_r), v_star);
  perform public.finish_event(v_e);
  v_after := pg_temp.card(public.get_racha_cards(v_r), v_star);
  perform pg_temp.assert_that(
    (v_before #>> '{line,matches}')::integer = 0
    and (v_before #>> '{line,goals}')::integer = 0
    and (v_after #>> '{line,matches}')::integer = 1
    and (v_after #>> '{line,goals}')::integer = 1,
    'caso 10: Partida de Evento active fica de fora até o encerramento');
  raise notice 'PASS: Evento active não entra até encerrar';
end $$;

-- ============================================================
-- 11. Partida descartada nunca entra
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_t1 uuid;
  v_star uuid;
  v_match uuid;
  v_card jsonb;
begin
  v := pg_temp.scene('disc', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'gone', v_t1, v_star, null, false);
  perform public.add_event_match_goal(v_match, 'gone2', v_t1, v_star, null, false);
  perform public.discard_event_match(v_match);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'keep', v_t1, v_star, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);
  v_card := pg_temp.card(public.get_racha_cards((v ->> 'racha')::uuid), v_star);
  perform pg_temp.assert_that(
    (v_card #>> '{line,matches}')::integer = 1
    and (v_card #>> '{line,goals}')::integer = 1
    and (v_card #>> '{line,wins}')::integer = 1,
    'caso 11: Partida descartada não entra');
  raise notice 'PASS: Partida descartada nunca entra';
end $$;

-- ============================================================
-- 12. Um dia antes do aniversário conta na Temporada anterior
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
  v_card jsonb;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  -- 2020 é bissexto: o mês-dia de hoje cabe, inclusive 29/02.
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

  -- Aniversário = hoje em Brasília; a Partida começou ontem, na Temporada anterior.
  update public.racha
  set created_at = (v_born + time '15:00') at time zone 'America/Sao_Paulo'
  where id = v_r;
  update public.event_match
  set started_at = ((v_today - 1) + time '15:00') at time zone 'America/Sao_Paulo'
  where id = v_match;

  v_card := pg_temp.card(public.get_racha_cards(v_r), v_star);
  perform pg_temp.assert_that(
    private.racha_season_start(v_r, v_today) = v_today
    and private.racha_season_start(v_r, v_today - 1) < v_today
    and (v_card #>> '{line,matches}')::integer = 0
    and (v_card #>> '{line,goals}')::integer = 0
    and (v_card ->> 'overall')::integer = 40,
    'caso 12: véspera do aniversário fica na Temporada anterior');
  raise notice 'PASS: Partida na véspera do aniversário fica de fora';
end $$;

-- ============================================================
-- 13. Racha de 29/02 vira em 28/02 no ano comum
-- ============================================================
do $$
declare
  v jsonb;
  v_r uuid;
begin
  v := pg_temp.scene('leap', array[3, 3], 3);
  v_r := (v ->> 'racha')::uuid;
  update public.racha
  set created_at = timestamptz '2024-02-29 12:00:00-03'
  where id = v_r;

  perform pg_temp.assert_that(
    private.racha_season_start(v_r, date '2025-06-01') = date '2025-02-28'
    and private.racha_season_start(v_r, date '2025-02-28') = date '2025-02-28'
    and private.racha_season_start(v_r, date '2025-02-27') = date '2024-02-29'
    and private.racha_season_start(v_r, date '2024-02-29') = date '2024-02-29'
    and private.racha_season_start(v_r, date '2028-03-01') = date '2028-02-29',
    'caso 13: 29/02 vira 28/02 no ano comum e volta no bissexto');
  raise notice 'PASS: 29/02 vira 28/02 no ano comum';
end $$;

-- ============================================================
-- 14. Perfil: mais Partidas; empate, Racha mais recente;
-- sem Partida, o último em que entrou
-- ============================================================
do $$
declare
  v_a jsonb;
  v_b jsonb;
  v_p uuid;
  v_ra uuid;
  v_rb uuid;
  v_ea uuid;
  v_eb uuid;
  v_owner_b uuid;
  v_t1 uuid;
  v_replaced uuid;
  v_i integer;
  v_match uuid;
  v_name_b text;
  v_out jsonb;
begin
  v_a := pg_temp.scene('prof-a', array[3, 3], 3);
  v_b := pg_temp.scene('prof-b', array[3, 3], 3);
  v_p := (v_a #>> '{line,0,0}')::uuid;
  v_ra := (v_a ->> 'racha')::uuid;
  v_rb := (v_b ->> 'racha')::uuid;
  v_ea := (v_a ->> 'event')::uuid;
  v_eb := (v_b ->> 'event')::uuid;
  v_owner_b := (v_b ->> 'owner')::uuid;
  v_t1 := (v_b #>> '{teams,0}')::uuid;
  v_replaced := (v_b #>> '{line,0,0}')::uuid;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_rb, v_p, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  update public.event_sort_team_player
  set left_at = now()
  where event_id = v_eb and profile_id = v_replaced and left_at is null;
  insert into public.event_sort_team_player (
    event_id, team_id, profile_id, stars_snapshot,
    is_super_star_snapshot, primary_position_snapshot
  ) values (v_eb, v_t1, v_p, 3, false, 'ANY');

  perform pg_temp.as_((v_a ->> 'owner')::uuid);
  v_match := (public.start_event_match(v_ea) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'a', (v_a #>> '{teams,0}')::uuid, v_p, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_ea);

  perform pg_temp.as_(v_owner_b);
  for v_i in 1..3 loop
    v_match := (public.start_event_match(v_eb) #>> '{match,id}')::uuid;
    perform public.add_event_match_goal(v_match, 'b', v_t1, v_p, null, false);
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_eb);

  select name into v_name_b from public.racha where id = v_rb;
  perform pg_temp.as_(v_p);
  v_out := public.get_my_profile_card();
  perform pg_temp.assert_that(
    v_out ->> 'racha_name' = v_name_b
    and (v_out #>> '{card,profile_id}') = v_p::text
    and (v_out #>> '{card,line,matches}')::integer = 3
    and v_out -> 'card' ? 'line'
    and v_out -> 'card' ? 'keeper',
    'caso 14: perfil mostra o Racha com mais Partidas');
  raise notice 'PASS: perfil escolhe o Racha com mais Partidas';
end $$;

do $$
declare
  v_a jsonb;
  v_b jsonb;
  v_p uuid;
  v_ra uuid;
  v_rb uuid;
  v_name_b text;
  v_out jsonb;
  v_i integer;
  v_match uuid;
begin
  v_a := pg_temp.scene('tie-a', array[3, 3], 3);
  v_b := pg_temp.scene('tie-b', array[3, 3], 3);
  v_p := (v_a #>> '{line,0,0}')::uuid;
  v_ra := (v_a ->> 'racha')::uuid;
  v_rb := (v_b ->> 'racha')::uuid;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_rb, v_p, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  update public.event_sort_team_player set left_at = now()
  where event_id = (v_b ->> 'event')::uuid
    and profile_id = (v_b #>> '{line,0,0}')::uuid and left_at is null;
  insert into public.event_sort_team_player (
    event_id, team_id, profile_id, stars_snapshot,
    is_super_star_snapshot, primary_position_snapshot
  ) values (
    (v_b ->> 'event')::uuid, (v_b #>> '{teams,0}')::uuid, v_p, 3, false, 'ANY'
  );

  -- Mesmas Partidas. Entrou por último em A; o Racha B foi criado depois.
  update public.racha set created_at = now() - interval '2 days' where id = v_ra;
  update public.racha set created_at = now() + interval '1 day' where id = v_rb;
  update public.member set joined_at = now()
  where racha_id = v_ra and profile_id = v_p;
  update public.member set joined_at = now() - interval '5 days'
  where racha_id = v_rb and profile_id = v_p;

  perform pg_temp.as_((v_a ->> 'owner')::uuid);
  for v_i in 1..2 loop
    v_match := (public.start_event_match((v_a ->> 'event')::uuid) #>> '{match,id}')::uuid;
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event((v_a ->> 'event')::uuid);

  perform pg_temp.as_((v_b ->> 'owner')::uuid);
  for v_i in 1..2 loop
    v_match := (public.start_event_match((v_b ->> 'event')::uuid) #>> '{match,id}')::uuid;
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event((v_b ->> 'event')::uuid);

  select name into v_name_b from public.racha where id = v_rb;
  perform pg_temp.as_(v_p);
  v_out := public.get_my_profile_card();
  perform pg_temp.assert_that(
    v_out ->> 'racha_name' = v_name_b
    and (v_out #>> '{card,line,matches}')::integer = 2,
    'caso 14: empate de Partidas fica com o Racha mais recente');
  raise notice 'PASS: empate de Partidas escolhe o Racha mais recente';
end $$;

do $$
declare
  v_new jsonb;
  v_old jsonb;
  v_p uuid;
  v_name_old text;
  v_out jsonb;
begin
  v_new := pg_temp.scene('join-new', array[3, 3], 3);
  v_old := pg_temp.scene('join-old', array[3, 3], 3);
  v_p := pg_temp.person('Sem Jogo', 'OUTFIELD');
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values
    ((v_new ->> 'racha')::uuid, v_p, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    ((v_old ->> 'racha')::uuid, v_p, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  -- C criado depois, mas a entrada foi no mais antigo.
  update public.racha set created_at = now() + interval '1 day'
  where id = (v_new ->> 'racha')::uuid;
  update public.racha set created_at = now() - interval '10 days'
  where id = (v_old ->> 'racha')::uuid;
  update public.member set joined_at = now() - interval '5 days'
  where racha_id = (v_new ->> 'racha')::uuid and profile_id = v_p;
  update public.member set joined_at = now()
  where racha_id = (v_old ->> 'racha')::uuid and profile_id = v_p;

  select name into v_name_old from public.racha where id = (v_old ->> 'racha')::uuid;
  perform pg_temp.as_(v_p);
  v_out := public.get_my_profile_card();
  perform pg_temp.assert_that(
    v_out ->> 'racha_name' = v_name_old
    and (v_out #>> '{card,overall}')::integer = 40
    and (v_out #>> '{card,line,matches}')::integer = 0
    and v_out #>> '{card,shown_role}' = 'LINE',
    'caso 14: sem Partida, o Racha em que entrou por último');
  raise notice 'PASS: sem Partida, perfil usa o último Racha em que entrou';
end $$;

do $$
declare
  v_solo uuid;
begin
  v_solo := pg_temp.person('Sem Racha', 'OUTFIELD');
  perform pg_temp.as_(v_solo);
  perform pg_temp.assert_that(
    public.get_my_profile_card() is null,
    'caso 14: sem nenhum Racha a carta é null');
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_that(
    pg_temp.err('select public.get_my_profile_card()') = 'not_authenticated',
    'perfil sem sessão é not_authenticated');
  raise notice 'PASS: sem Racha é null; sem sessão é not_authenticated';
end $$;

-- Membership inativo não ganha a carta do Perfil, mesmo com mais Partidas.
do $$
declare
  v_a jsonb;
  v_b jsonb;
  v_p uuid;
  v_ra uuid;
  v_rb uuid;
  v_ea uuid;
  v_eb uuid;
  v_owner_b uuid;
  v_t1 uuid;
  v_replaced uuid;
  v_i integer;
  v_match uuid;
  v_name_b text;
  v_out jsonb;
begin
  v_a := pg_temp.scene('inact-hot', array[3, 3], 3);
  v_b := pg_temp.scene('inact-cool', array[3, 3], 3);
  v_p := (v_a #>> '{line,0,0}')::uuid;
  v_ra := (v_a ->> 'racha')::uuid;
  v_rb := (v_b ->> 'racha')::uuid;
  v_ea := (v_a ->> 'event')::uuid;
  v_eb := (v_b ->> 'event')::uuid;
  v_owner_b := (v_b ->> 'owner')::uuid;
  v_t1 := (v_b #>> '{teams,0}')::uuid;
  v_replaced := (v_b #>> '{line,0,0}')::uuid;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_rb, v_p, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  update public.event_sort_team_player
  set left_at = now()
  where event_id = v_eb and profile_id = v_replaced and left_at is null;
  insert into public.event_sort_team_player (
    event_id, team_id, profile_id, stars_snapshot,
    is_super_star_snapshot, primary_position_snapshot
  ) values (v_eb, v_t1, v_p, 3, false, 'ANY');

  perform pg_temp.as_((v_a ->> 'owner')::uuid);
  for v_i in 1..3 loop
    v_match := (public.start_event_match(v_ea) #>> '{match,id}')::uuid;
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_ea);

  perform pg_temp.as_(v_owner_b);
  v_match := (public.start_event_match(v_eb) #>> '{match,id}')::uuid;
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_eb);

  update public.member set is_active = false
  where racha_id = v_ra and profile_id = v_p;

  select name into v_name_b from public.racha where id = v_rb;
  perform pg_temp.as_(v_p);
  v_out := public.get_my_profile_card();
  perform pg_temp.assert_that(
    v_out ->> 'racha_name' = v_name_b
    and (v_out #>> '{card,line,matches}')::integer = 1
    and v_out #>> '{card,plays_as}' = 'OUTFIELD'
    and v_out #>> '{card,primary_position}' = 'ANY',
    'caso 14: inativo com mais Partidas perde para o Racha ativo');
  raise notice 'PASS: perfil ignora membership inativo com mais Partidas';
end $$;

do $$
declare
  v_a jsonb;
  v_b jsonb;
  v_p uuid;
begin
  v_a := pg_temp.scene('only-off-a', array[3, 3], 3);
  v_b := pg_temp.scene('only-off-b', array[3, 3], 3);
  v_p := (v_a #>> '{line,0,0}')::uuid;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values ((v_b ->> 'racha')::uuid, v_p, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  update public.member set is_active = false where profile_id = v_p;

  perform pg_temp.as_(v_p);
  perform pg_temp.assert_that(
    public.get_my_profile_card() is null,
    'caso 14: só membership inativo devolve null');
  raise notice 'PASS: só membership inativo devolve null';
end $$;

-- ============================================================
-- 15. Membro inativo continua na lista, com o que fez
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_player uuid;
  v_stranger uuid;
  v_match uuid;
  v_card jsonb;
begin
  v := pg_temp.scene('inactive', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_stranger := pg_temp.person('Estranho', 'OUTFIELD');
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'g', v_t1, v_player, null, false);
  perform public.add_event_match_goal(v_match, 'g2', v_t1, v_player, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  update public.member set is_active = false
  where racha_id = v_r and profile_id = v_player;

  perform pg_temp.as_(v_player);
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.get_racha_cards(%L)', v_r)) = 'not_allowed',
    'caso 15: inativo não lê as cartas');

  perform pg_temp.as_(v_stranger);
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.get_racha_cards(%L)', v_r)) = 'not_allowed',
    'quem não é Membro não lê as cartas');

  perform pg_temp.as_(v_owner);
  v_card := pg_temp.card(public.get_racha_cards(v_r), v_player);
  perform pg_temp.assert_that(
    v_card is not null
    and (v_card #>> '{line,matches}')::integer = 1
    and (v_card #>> '{line,goals}')::integer = 2,
    'caso 15: inativo segue na lista com os números');
  raise notice 'PASS: inativo continua na carta; leitura exige Membro ativo';
end $$;

-- ============================================================
-- 16. Extremos: o limite segura 40 e 99
-- 10 Partidas, P=200, 10 gols, 5 assistências, todas do astro na metade.
-- gr=2, ar=4, vr=0,2, score=0,72
-- (0,72-0,10)/0,45 ≈ 1,378 → sem limite ~121; mostra 99
-- Goleiro do Time 2: 10 sofridos, média 0,5, r=1,68
-- (1,6-1,68)/0,9 < 0 → sem limite ~35; mostra 40
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_star uuid;
  v_mate uuid;
  v_bad uuid;
  v_match uuid;
  v_i integer;
  v_cards jsonb;
  v_star_card jsonb;
  v_bad_card jsonb;
  v_ok boolean;
begin
  v := pg_temp.scene('clamp', array[10, 10], 10, 0);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  v_mate := (v #>> '{line,0,1}')::uuid;
  v_bad := (v #>> '{gk,1}')::uuid;
  perform pg_temp.as_(v_owner);

  for v_i in 1..10 loop
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    if v_i <= 5 then
      perform public.add_event_match_goal(v_match, 'g', v_t1, v_star, null, false);
    else
      perform public.add_event_match_goal(v_match, 'g', v_t1, v_mate, v_star, false);
    end if;
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_e);

  v_cards := public.get_racha_cards(v_r);
  v_star_card := pg_temp.card(v_cards, v_star);
  v_bad_card := pg_temp.card(v_cards, v_bad);
  select bool_and((x ->> 'overall')::integer between 40 and 99) into v_ok
  from jsonb_array_elements(v_cards) x;

  perform pg_temp.assert_that(
    (v_star_card ->> 'overall')::integer = 99
    and (v_star_card #>> '{line,goals}')::integer = 5
    and (v_star_card #>> '{line,assists}')::integer = 5
    and (v_star_card #>> '{line,wins}')::integer = 10
    and (v_star_card #>> '{line,matches}')::integer = 10
    and (v_bad_card ->> 'overall')::integer = 40
    and (v_bad_card #>> '{keeper,matches}')::integer = 10
    and v_ok,
    'caso 16: Overall não sai de 40–99');
  raise notice 'PASS: extremos ficam em 99 e 40';
end $$;

-- Avulso joga e marca, e não aparece na lista.
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
  v_cards jsonb;
  v_members integer;
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

  v_cards := public.get_racha_cards(v_r);
  select count(*)::integer into v_members from public.member m where m.racha_id = v_r;
  perform pg_temp.assert_that(
    jsonb_array_length(v_cards) = v_members
    and not exists (
      select 1 from jsonb_array_elements(v_cards) x
      where x ->> 'profile_id' = v_guest::text
    ),
    'Avulso não aparece nas cartas');
  raise notice 'PASS: Avulso não aparece nas cartas';
end $$;

-- ============================================================
-- Volta ao jogo: duas linhas OUTFIELD da mesma pessoa na mesma
-- Partida são uma presença. O caso 3 (P=18) dá Overall 42;
-- count(*) faria P=19 e o astro iria a 43.
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
  v_i integer;
  v_rows integer;
  v_cards jsonb;
  v_star_card jsonb;
  v_k_card jsonb;
begin
  v := pg_temp.scene('reentry', array[3, 3], 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_star := (v #>> '{line,0,0}')::uuid;
  v_k := (v #>> '{gk,0}')::uuid;
  perform pg_temp.as_(v_owner);

  for v_i in 1..3 loop
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    perform public.add_event_match_goal(v_match, 'g', v_t1, v_star, null, false);
    perform public.finish_event_match(v_match);
  end loop;

  insert into public.event_match_lineup (
    event_id, match_id, team_id, profile_id, role, entered_at, left_at, entry_kind
  )
  select l.event_id, l.match_id, l.team_id, l.profile_id, 'OUTFIELD',
         l.entered_at, l.entered_at, 'return'
  from public.event_match_lineup l
  where l.match_id = v_match
    and l.profile_id = v_star
    and l.role = 'OUTFIELD';

  select count(*)::integer into v_rows
  from public.event_match_lineup l
  where l.match_id = v_match
    and l.profile_id = v_star
    and l.role = 'OUTFIELD';

  perform public.finish_event(v_e);

  v_cards := public.get_racha_cards(v_r);
  v_star_card := pg_temp.card(v_cards, v_star);
  v_k_card := pg_temp.card(v_cards, v_k);

  perform pg_temp.assert_that(
    v_rows = 2
    and (v_star_card ->> 'overall')::integer = 42
    and (v_star_card #>> '{line,matches}')::integer = 3
    and (v_star_card #>> '{line,goals}')::integer = 3
    and (v_k_card ->> 'overall')::integer = 47,
    'volta ao jogo: duas linhas OUTFIELD contam uma presença');

  raise notice 'PASS: volta ao jogo conta uma presença';
end $$;

rollback;
