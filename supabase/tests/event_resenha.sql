-- Resenha, etapa 1: duas leituras SQL.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/event_resenha.sql
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

-- Segundo Evento no mesmo Racha, com os mesmos Membros já no Time.
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

create function pg_temp.person_stats(p jsonb, p_id uuid) returns jsonb
language sql as $$
  select x
  from jsonb_array_elements(coalesce(p -> 'people', '[]'::jsonb)) x
  where x #>> '{person,person_id}' = p_id::text
$$;

create function pg_temp.team_wins(p jsonb, p_number integer) returns integer
language sql as $$
  select (x ->> 'wins')::integer
  from jsonb_array_elements(coalesce(p -> 'teams', '[]'::jsonb)) x
  where (x ->> 'team_number')::integer = p_number
$$;

-- ============================================================
-- 1. Dia com 5 Partidas e um artilheiro Membro com 3 gols
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_diego uuid;
  v_other uuid;
  v_match uuid;
  v_i integer;
  v_out jsonb;
  v_diego_row jsonb;
  v_racha_name text;
begin
  v := pg_temp.scene('five', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_diego := (v #>> '{line,0,0}')::uuid;
  v_other := (v #>> '{line,0,1}')::uuid;
  update public.profile set display_name = 'Diego' where id = v_diego;
  select name into v_racha_name from public.racha where id = v_r;

  perform pg_temp.as_(v_owner);
  for v_i in 1..5 loop
    v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
    if v_i <= 3 then
      perform public.add_event_match_goal(v_match, 'g-' || v_i, v_t1, v_diego, null, false);
    else
      perform public.add_event_match_goal(v_match, 'g-' || v_i, v_t1, v_other, null, false);
    end if;
    perform public.finish_event_match(v_match);
  end loop;
  perform public.finish_event(v_e);

  v_out := public.get_event_resenha(v_e);
  v_diego_row := pg_temp.person_stats(v_out, v_diego);

  perform pg_temp.assert_that(
    v_out ->> 'starts_on' = current_date::text
    and v_out ->> 'place' = 'Quadra Reforco'
    and v_out ->> 'racha_name' = v_racha_name
    and (v_out ->> 'match_count')::integer = 5
    and (v_diego_row ->> 'goals')::integer = 3
    and (v_diego_row ->> 'wins')::integer = 5
    and v_diego_row #>> '{person,kind}' = 'member'
    and (pg_temp.person_stats(v_out, v_other) ->> 'goals')::integer = 2
    and pg_temp.team_wins(v_out, 1) = 5
    and pg_temp.team_wins(v_out, 2) = 0
    and jsonb_array_length(v_out -> 'teams') = 2
    and v_out #>> '{scorer_card,display_name}' = 'Diego'
    and v_out #>> '{scorer_card,plays_as}' = 'OUTFIELD'
    and v_out #>> '{scorer_card,primary_position}' = 'ANY'
    and (v_out #>> '{scorer_card,is_super_star}')::boolean = false
    and v_out -> 'scorer_card' ? 'avatar_path',
    'caso 1: 5 Partidas, people/teams e scorer_card do Diego');

  raise notice 'PASS: 5 Partidas com artilheiro Membro';
end $$;

-- ============================================================
-- 2. Gol contra não soma gol nem assistência
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_t1 uuid;
  v_scorer uuid;
  v_assist uuid;
  v_match uuid;
  v_out jsonb;
begin
  v := pg_temp.scene('own', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_scorer := (v #>> '{line,0,0}')::uuid;
  v_assist := (v #>> '{line,0,1}')::uuid;

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'regular', v_t1, v_scorer, v_assist, false);
  -- p_team_id é quem tocou; o ponto vai ao adversário e ninguém é creditado
  perform public.add_event_match_goal(v_match, 'own', v_t1, null, null, true);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_out := public.get_event_resenha(v_e);
  perform pg_temp.assert_that(
    (pg_temp.person_stats(v_out, v_scorer) ->> 'goals')::integer = 1
    and (pg_temp.person_stats(v_out, v_assist) ->> 'assists')::integer = 1
    and (pg_temp.person_stats(v_out, v_scorer) ->> 'assists')::integer = 0
    and (select count(*) from jsonb_array_elements(v_out -> 'people') x
         where (x ->> 'goals')::integer > 1) = 0,
    'caso 2: gol contra não credita gol nem assistência');

  raise notice 'PASS: gol contra não soma';
end $$;

-- ============================================================
-- 3. Empate de 3 no artilheiro com um Avulso: scorer_card nulo
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_diego uuid;
  v_rafa uuid;
  v_left uuid;
  v_guest uuid;
  v_match uuid;
  v_out jsonb;
  v_last jsonb;
begin
  v := pg_temp.scene('tie3', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_diego := (v #>> '{line,0,0}')::uuid;
  v_rafa := (v #>> '{line,0,1}')::uuid;
  v_left := (v #>> '{line,0,4}')::uuid;
  update public.profile set display_name = 'Diego' where id = v_diego;
  update public.profile set display_name = 'Rafa' where id = v_rafa;

  -- vaga no Time 1 para o Avulso entrar no elenco da primeira Partida
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
  perform public.add_event_match_goal(v_match, 'd', v_t1, v_diego, null, false);
  perform public.add_event_match_goal(v_match, 'r', v_t1, v_rafa, null, false);
  perform public.add_event_match_goal(v_match, 'c', v_t1, v_guest, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_out := public.get_event_resenha(v_e);
  v_last := public.get_racha_last_resenha(v_r);

  perform pg_temp.assert_that(
    (pg_temp.person_stats(v_out, v_diego) ->> 'goals')::integer = 1
    and (pg_temp.person_stats(v_out, v_rafa) ->> 'goals')::integer = 1
    and (pg_temp.person_stats(v_out, v_guest) ->> 'goals')::integer = 1
    and pg_temp.person_stats(v_out, v_guest) #>> '{person,kind}' = 'guest'
    and v_out -> 'scorer_card' = 'null'::jsonb
    and v_last -> 'scorers' = '["Caio", "Diego", "Rafa"]'::jsonb
    and (v_last ->> 'top_goals')::integer = 1,
    'caso 3: três artilheiros com Avulso; scorer_card nulo');

  raise notice 'PASS: empate de 3 com Avulso';
end $$;

-- ============================================================
-- 4. Vitória nos pênaltis soma para a pessoa e para o Time
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_t1 uuid;
  v_player uuid;
  v_match uuid;
  v_out jsonb;
begin
  v := pg_temp.scene('pen', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;

  update public.event set tie_rule = 'PENALTIES' where id = v_e;

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.finish_event_match(v_match, v_t1);
  perform pg_temp.assert_that(
    (select m.winner_team_id = v_t1 and m.decided_by_penalties
     from public.event_match m where m.id = v_match),
    'caso 4: Partida decidida nos pênaltis');
  perform public.finish_event(v_e);

  v_out := public.get_event_resenha(v_e);
  perform pg_temp.assert_that(
    (pg_temp.person_stats(v_out, v_player) ->> 'wins')::integer = 1
    and pg_temp.team_wins(v_out, 1) = 1
    and pg_temp.team_wins(v_out, 2) = 0,
    'caso 4: pênaltis somam Vitória da pessoa e do Time');

  raise notice 'PASS: vitória nos pênaltis';
end $$;

-- ============================================================
-- 5. Expulso no Time vencedor não soma; amarelo no apito soma
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_t1 uuid;
  v_yellow uuid;
  v_red uuid;
  v_scorer uuid;
  v_match uuid;
  v_out jsonb;
begin
  v := pg_temp.scene('cards-win', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_yellow := (v #>> '{line,0,0}')::uuid;
  v_red := (v #>> '{line,0,1}')::uuid;
  v_scorer := (v #>> '{line,0,2}')::uuid;

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_card(v_match, v_yellow, null, 'yellow');
  perform public.add_event_match_card(v_match, v_red, null, 'red');
  -- now() é estável: recua o left_at do vermelho para o apito ficar depois
  update public.event_match_lineup l
  set entered_at = now() - interval '2 seconds',
      left_at = now() - interval '1 second'
  where l.match_id = v_match and l.profile_id = v_red and l.left_by_red;

  perform public.add_event_match_goal(v_match, 'win', v_t1, v_scorer, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_out := public.get_event_resenha(v_e);
  perform pg_temp.assert_that(
    (pg_temp.person_stats(v_out, v_yellow) ->> 'wins')::integer = 1
    and (pg_temp.person_stats(v_out, v_red) ->> 'wins')::integer = 0
    and pg_temp.person_stats(v_out, v_red) is not null
    and pg_temp.team_wins(v_out, 1) = 1,
    'caso 5: expulso sem Vitória; amarelo no apito soma');

  raise notice 'PASS: expulso sem Vitória, amarelo soma';
end $$;

-- ============================================================
-- 6. Partida descartada não conta para nada
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_t1 uuid;
  v_scorer uuid;
  v_match uuid;
  v_out jsonb;
begin
  v := pg_temp.scene('discard', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_scorer := (v #>> '{line,0,0}')::uuid;

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'gone', v_t1, v_scorer, null, false);
  perform public.add_event_match_card(v_match, v_scorer, null, 'yellow');
  perform public.discard_event_match(v_match);
  perform public.finish_event(v_e);

  v_out := public.get_event_resenha(v_e);
  perform pg_temp.assert_that(
    (v_out ->> 'match_count')::integer = 0
    and v_out -> 'people' = '[]'::jsonb
    and pg_temp.team_wins(v_out, 1) = 0
    and pg_temp.team_wins(v_out, 2) = 0
    and v_out -> 'cards' = '[]'::jsonb
    and v_out -> 'scorer_card' = 'null'::jsonb
    and exists (
      select 1 from public.event_match_goal g
      where g.match_id = v_match and g.scorer_profile_id = v_scorer
    ),
    'caso 6: descartada some da Resenha (gol gravado não conta)');

  raise notice 'PASS: partida descartada não conta';
end $$;

-- ============================================================
-- 7. Só empates: todos os Times com 0 Vitórias
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_match uuid;
  v_out jsonb;
begin
  v := pg_temp.scene('draws', array[5, 5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.finish_event_match(v_match);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_out := public.get_event_resenha(v_e);
  perform pg_temp.assert_that(
    (v_out ->> 'match_count')::integer = 2
    and jsonb_array_length(v_out -> 'teams') = 3
    and pg_temp.team_wins(v_out, 1) = 0
    and pg_temp.team_wins(v_out, 2) = 0
    and pg_temp.team_wins(v_out, 3) = 0
    and v_out -> 'people' = '[]'::jsonb,
    'caso 7: só empates, Times com 0 Vitórias');

  raise notice 'PASS: só empates';
end $$;

-- ============================================================
-- 8. Evento sem Partida: match_count 0 e listas vazias
-- ============================================================
do $$
declare
  v_owner uuid;
  v_racha uuid;
  v_event uuid;
  v_code text;
  v_out jsonb;
begin
  v_owner := pg_temp.person('Dono Vazio', 'OUTFIELD');
  v_code := 'VAZYXK';
  insert into public.racha (name, invite_code, place, spot_limit, outfield_per_team)
  values ('Racha Vazio', v_code, 'Quadra Vazia', 20, 5)
  returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);
  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    v_racha, current_date, time '19:00', 'Quadra Vazia', 'active', v_owner, 20,
    24, 5, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10
  ) returning id into v_event;

  perform pg_temp.as_(v_owner);
  perform public.finish_event(v_event);
  v_out := public.get_event_resenha(v_event);

  perform pg_temp.assert_that(
    (v_out ->> 'match_count')::integer = 0
    and v_out -> 'people' = '[]'::jsonb
    and v_out -> 'teams' = '[]'::jsonb
    and v_out -> 'cards' = '[]'::jsonb
    and v_out -> 'scorer_card' = 'null'::jsonb,
    'caso 8: Evento sem Partida e sem Times, listas vazias');

  raise notice 'PASS: evento sem partida';
end $$;

-- ============================================================
-- 9. Evento aberto: not_allowed
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_last jsonb;
begin
  v := pg_temp.scene('open', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;

  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.get_event_resenha(%L)', v_e)) = 'not_allowed',
    'caso 9: Evento active recusa get_event_resenha');

  v_last := public.get_racha_last_resenha(v_r);
  perform pg_temp.assert_that(
    v_last is null,
    'caso 9: sem Evento finished, last_resenha é null');

  raise notice 'PASS: evento aberto not_allowed';
end $$;

-- ============================================================
-- 10. Membro inativo e quem não é Membro: not_allowed nas duas
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
  v := pg_temp.scene('acl', array[5, 5]);
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
    pg_temp.err(format('select public.get_event_resenha(%L)', v_e)) = 'not_allowed'
    and pg_temp.err(format('select public.get_racha_last_resenha(%L)', v_r)) = 'not_allowed',
    'caso 10: Membro inativo recusado nas duas');

  perform pg_temp.as_(v_stranger);
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.get_event_resenha(%L)', v_e)) = 'not_allowed'
    and pg_temp.err(format('select public.get_racha_last_resenha(%L)', v_r)) = 'not_allowed',
    'caso 10: quem não é Membro recusado nas duas');

  raise notice 'PASS: inativo e estranho not_allowed';
end $$;

-- ============================================================
-- 11. last_resenha pega o último encerrado e ignora o aberto
-- ============================================================
do $$
declare
  v jsonb;
  v_r uuid;
  v_owner uuid;
  v_t1 uuid;
  v_old uuid;
  v_new uuid;
  v_open uuid;
  v_diego uuid;
  v_caio uuid;
  v_match uuid;
  v_b jsonb;
  v_last jsonb;
begin
  v := pg_temp.scene('last-a', array[5, 5]);
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_old := (v ->> 'event')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_diego := (v #>> '{line,0,0}')::uuid;
  v_caio := (v #>> '{line,0,1}')::uuid;
  update public.profile set display_name = 'Diego' where id = v_diego;
  update public.profile set display_name = 'Caio' where id = v_caio;

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_old) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'old-1', v_t1, v_diego, null, false);
  perform public.add_event_match_goal(v_match, 'old-2', v_t1, v_diego, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_old);
  update public.event set ended_at = now() - interval '2 hours' where id = v_old;

  v_b := pg_temp.event_on(v_r, v_owner, 'last-b', v -> 'line', v -> 'gk');
  v_new := (v_b ->> 'event')::uuid;
  v_t1 := (v_b #>> '{teams,0}')::uuid;

  v_match := (public.start_event_match(v_new) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'new-1', v_t1, v_caio, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_new);
  update public.event set ended_at = now() - interval '1 hour' where id = v_new;

  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    v_r, current_date + 7, time '19:00', 'Quadra Reforco', 'active', v_owner, 50,
    24, 5, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10
  ) returning id into v_open;

  v_last := public.get_racha_last_resenha(v_r);
  perform pg_temp.assert_that(
    (v_last ->> 'event_id')::uuid = v_new
    and (v_last ->> 'match_count')::integer = 1
    and v_last -> 'scorers' = '["Caio"]'::jsonb
    and (v_last ->> 'top_goals')::integer = 1
    and v_last ->> 'starts_on' = (current_date + 1)::text
    and pg_temp.err(format('select public.get_event_resenha(%L)', v_open)) = 'not_allowed',
    'caso 11: último finished; Evento aberto ignorado');

  raise notice 'PASS: last_resenha pega o último encerrado';
end $$;

-- ============================================================
-- 12. Cartões em ordem; vermelho por segundo amarelo como red
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_t1 uuid;
  v_a uuid;
  v_b uuid;
  v_scorer uuid;
  v_match uuid;
  v_out jsonb;
  v_cards jsonb;
begin
  v := pg_temp.scene('card-order', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_a := (v #>> '{line,0,0}')::uuid;
  v_b := (v #>> '{line,0,1}')::uuid;
  v_scorer := (v #>> '{line,0,2}')::uuid;
  update public.profile set display_name = 'Samuel' where id = v_a;
  update public.profile set display_name = 'Rodrigo' where id = v_b;

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  perform public.add_event_match_card(v_match, v_a, null, 'yellow');
  perform public.add_event_match_card(v_match, v_b, null, 'yellow');
  perform public.add_event_match_card(v_match, v_a, null, 'yellow');

  -- now() é estável: força a ordem de created_at que a leitura deve devolver
  update public.event_match_card c
  set created_at = now() - interval '3 seconds'
  where c.match_id = v_match and c.profile_id = v_a and c.color = 'yellow';
  update public.event_match_card c
  set created_at = now() - interval '2 seconds'
  where c.match_id = v_match and c.profile_id = v_b and c.color = 'yellow';
  update public.event_match_card c
  set created_at = now() - interval '1 second'
  where c.match_id = v_match and c.profile_id = v_a and c.color = 'red';

  perform public.add_event_match_goal(v_match, 'ord', v_t1, v_scorer, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_e);

  v_out := public.get_event_resenha(v_e);
  v_cards := v_out -> 'cards';
  perform pg_temp.assert_that(
    jsonb_array_length(v_cards) = 3
    and v_cards #>> '{0,color}' = 'yellow'
    and v_cards #>> '{0,person,display_name}' = 'Samuel'
    and (v_cards #>> '{0,match_number}')::integer = 1
    and v_cards #>> '{1,color}' = 'yellow'
    and v_cards #>> '{1,person,display_name}' = 'Rodrigo'
    and v_cards #>> '{2,color}' = 'red'
    and v_cards #>> '{2,person,display_name}' = 'Samuel'
    and (select c.red_reason::text from public.event_match_card c
         where c.match_id = v_match and c.color = 'red') = 'second_yellow',
    'caso 12: cartões em created_at; segundo amarelo como red');

  raise notice 'PASS: cartões em ordem com segundo amarelo';
end $$;

rollback;
