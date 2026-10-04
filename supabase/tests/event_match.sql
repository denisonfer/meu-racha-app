-- Partida e placar, etapas 2 e 3: tabelas, motor SQL e RPCs.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/event_match.sql
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

-- Troca uuids (chaves e valores string) pelos rótulos T1/G1 do caso.
create function pg_temp.relabel(p jsonb, m jsonb) returns jsonb
language sql as $$
  select case jsonb_typeof(p)
    when 'object' then (
      select coalesce(jsonb_object_agg(coalesce(m ->> k, k), pg_temp.relabel(v, m)), '{}'::jsonb)
      from jsonb_each(p) e(k, v)
    )
    when 'array' then (
      select coalesce(jsonb_agg(pg_temp.relabel(x, m) order by ord), '[]'::jsonb)
      from jsonb_array_elements(p) with ordinality as a(x, ord)
    )
    when 'string' then coalesce(to_jsonb(m ->> (p #>> '{}')), p)
    else p
  end
$$;

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

-- Monta Evento + Sorteio + Times + goleiros + Partida + Gols a partir de um caso.
-- Gol contra sem autor só para o placar: o gatilho aceita e o motor conta as linhas.
create function pg_temp.mount(p_input jsonb) returns jsonb
language plpgsql as $$
declare
  v_owner uuid;
  v_racha uuid;
  v_event uuid;
  v_match uuid;
  v_code text;
  v_tag text := substr(md5(p_input::text || clock_timestamp()::text), 1, 8);
  v_team jsonb;
  v_label text;
  v_tid uuid;
  v_pid uuid;
  v_need integer;
  v_i integer;
  v_n integer := 0;
  v_g_label text;
  v_g_id uuid;
  v_home uuid;
  v_away uuid;
  v_challenger uuid;
  v_q integer := 0;
  v_to_label jsonb := '{}'::jsonb;
  v_to_id jsonb := '{}'::jsonb;
  v_mode public.game_mode := (p_input #>> '{engine,gameMode}')::public.game_mode;
  v_tie public.tie_rule := (p_input #>> '{engine,tieRule}')::public.tie_rule;
  v_ret public.tie_return_order := (p_input #>> '{engine,tieReturnOrder}')::public.tie_return_order;
  v_max smallint := coalesce((p_input #>> '{engine,maxConsecutiveWins}')::smallint, 2);
  v_limit smallint := 3;
begin
  v_owner := pg_temp.person('Dono Partida', 'OUTFIELD');
  v_code := translate(upper(substr(md5(v_tag), 1, 6)), '01', 'ZY');

  insert into public.racha (name, invite_code, place, spot_limit, outfield_per_team)
  values ('Prova Partida', v_code, 'Quadra Partida', 20, v_limit)
  returning id into v_racha;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);

  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    v_racha, current_date, time '19:00', 'Quadra Partida', 'active', v_owner, 20,
    24, v_limit, v_mode, v_max, v_tie, v_ret, false, 10
  ) returning id into v_event;

  insert into public.event_sort (
    event_id, status, signature, version, leftover_ids, mode, goalkeepers_per_team,
    balance_score, balance_label, balance_diff, super_diff, capped_by_super,
    confirmed_at, confirmed_by
  ) values (
    v_event, 'confirmed', 'match-engine', 1, '{}', 'normal', true,
    80, 'Equilibrado', 0, 0, false, now(), v_owner
  );

  for v_team in select value from jsonb_array_elements(p_input -> 'teams')
  loop
    v_n := v_n + 1;
    v_label := v_team ->> 'id';
    insert into public.event_sort_team (event_id, team_number, queue_order, win_streak)
    values (
      v_event,
      (v_team ->> 'teamNumber')::smallint,
      (v_team ->> 'queueOrder')::smallint,
      coalesce((v_team ->> 'winStreak')::smallint, 0)
    ) returning id into v_tid;
    v_to_label := v_to_label || jsonb_build_object(v_tid::text, v_label);
    v_to_id := v_to_id || jsonb_build_object(v_label, v_tid);

    -- nome sem dígito (check do Perfil). Time incompleto: um a menos que o limite.
    v_need := case when coalesce((v_team ->> 'complete')::boolean, true) then v_limit else v_limit - 1 end;
    for v_i in 1..v_need loop
      v_pid := pg_temp.person('Linha ' || chr(64 + v_n) || chr(96 + v_i), 'OUTFIELD');
      insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
      values (v_racha, v_pid, 'PLAYER', 'OUTFIELD', 'ANY', 3);
      insert into public.event_sort_team_player (
        event_id, team_id, profile_id, stars_snapshot, is_super_star_snapshot,
        primary_position_snapshot
      ) values (v_event, v_tid, v_pid, 3, false, 'ANY');
    end loop;
  end loop;

  for v_label, v_g_label in
    select e.key, e.value #>> '{}'
    from jsonb_each(p_input #> '{goalkeepers,byTeam}') e
    where e.value <> 'null'::jsonb
  loop
    if not (v_to_id ? v_g_label) then
      -- G1 → GA: o Perfil não aceita dígito no nome
      v_g_id := pg_temp.person('Goleiro ' || translate(v_g_label, '0123456789', 'ABCDEFGHIJ'), 'GOALKEEPER');
      insert into public.member (racha_id, profile_id, role, plays_as)
      values (v_racha, v_g_id, 'PLAYER', 'GOALKEEPER');
      v_to_label := v_to_label || jsonb_build_object(v_g_id::text, v_g_label);
      v_to_id := v_to_id || jsonb_build_object(v_g_label, v_g_id);
    else
      v_g_id := (v_to_id ->> v_g_label)::uuid;
    end if;
    insert into public.event_sort_goalkeeper (event_id, team_id, profile_id)
    values (v_event, (v_to_id ->> v_label)::uuid, v_g_id);
  end loop;

  for v_g_label in
    select e.x from jsonb_array_elements_text(coalesce(p_input #> '{goalkeepers,queue}', '[]'::jsonb))
      with ordinality as e(x, o)
    order by e.o
  loop
    if not (v_to_id ? v_g_label) then
      v_g_id := pg_temp.person('Goleiro ' || translate(v_g_label, '0123456789', 'ABCDEFGHIJ'), 'GOALKEEPER');
      insert into public.member (racha_id, profile_id, role, plays_as)
      values (v_racha, v_g_id, 'PLAYER', 'GOALKEEPER');
      v_to_label := v_to_label || jsonb_build_object(v_g_id::text, v_g_label);
      v_to_id := v_to_id || jsonb_build_object(v_g_label, v_g_id);
    else
      v_g_id := (v_to_id ->> v_g_label)::uuid;
    end if;
    v_q := v_q + 1;
    insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id)
    values (v_event, v_q, v_g_id);
  end loop;

  v_home := (v_to_id ->> (p_input ->> 'homeId'))::uuid;
  v_away := (v_to_id ->> (p_input ->> 'awayId'))::uuid;
  if p_input ->> 'challengerId' is not null then
    v_challenger := (v_to_id ->> (p_input ->> 'challengerId'))::uuid;
  end if;

  insert into public.event_match (
    event_id, number, home_team_id, away_team_id, challenger_team_id, is_rematch,
    queue_before, started_by
  ) values (
    v_event, 1, v_home, v_away, v_challenger,
    coalesce((p_input ->> 'isRematch')::boolean, false),
    p_input, v_owner
  ) returning id into v_match;

  for v_i in 1..coalesce((p_input #>> '{score,home}')::integer, 0) loop
    insert into public.event_match_goal (event_id, match_id, request_key, team_id, is_own_goal)
    values (v_event, v_match, 'h-' || v_i, v_home, true);
  end loop;
  for v_i in 1..coalesce((p_input #>> '{score,away}')::integer, 0) loop
    insert into public.event_match_goal (event_id, match_id, request_key, team_id, is_own_goal)
    values (v_event, v_match, 'a-' || v_i, v_away, true);
  end loop;

  return jsonb_build_object('match_id', v_match, 'to_label', v_to_label, 'to_id', v_to_id);
end $$;

-- ============================================================
-- 1. Esquema: RLS, revoke, forma, FKs, gatilho, sem RPCs da etapa 3
-- ============================================================
do $$
declare
  v_fx jsonb;
  v_match uuid;
  v_event uuid;
  v_home uuid;
  v_away uuid;
  v_t3 uuid;
  v_owner uuid;
  v_p uuid;
  v_g uuid;
  v_msg text;
begin
  perform pg_temp.assert_that(
    (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'event_match')
    and (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'event_match_lineup')
    and (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'event_match_goal'),
    'RLS ligada nas três tabelas');
  perform pg_temp.assert_that(
    (select count(*) from pg_policies where schemaname = 'public'
      and tablename in ('event_match', 'event_match_lineup', 'event_match_goal')) = 0,
    'sem política nas tabelas da Partida');
  perform pg_temp.assert_that(
    not has_table_privilege('anon', 'public.event_match', 'select')
    and not has_table_privilege('authenticated', 'public.event_match', 'select')
    and not has_table_privilege('anon', 'public.event_match_lineup', 'select')
    and not has_table_privilege('authenticated', 'public.event_match_lineup', 'select')
    and not has_table_privilege('anon', 'public.event_match_goal', 'select')
    and not has_table_privilege('authenticated', 'public.event_match_goal', 'select'),
    'anon/authenticated sem select nas tabelas');
  perform pg_temp.assert_that(
    (select p.prosecdef and p.proconfig @> array['search_path=""']
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'event_match_next_state'
       and pg_get_function_identity_arguments(p.oid) = 'p_match_id uuid, p_penalty_winner uuid, p_seed double precision'),
    'next_state: security definer, search_path vazio, assinatura p_seed');
  perform pg_temp.assert_that(
    not has_function_privilege('authenticated',
      'private.event_match_next_state(uuid, uuid, double precision)', 'execute')
    and not has_function_privilege('anon',
      'private.event_match_next_state(uuid, uuid, double precision)', 'execute'),
    'next_state não é chamável pelo cliente');
  perform pg_temp.assert_that(exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'start_event_match'
  ) and exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_event_match'
  ), 'RPCs públicas da etapa 3 existem');
  perform pg_temp.assert_that(
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'event_match_next_state') = 1,
    'uma assinatura de next_state');
  perform pg_temp.assert_that(
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'event_sort_team'
        and column_name = 'win_streak' and data_type = 'smallint'
    ),
    'event_sort_team.win_streak smallint');

  v_fx := pg_temp.mount($j${
    "teams":[
      {"id":"T1","queueOrder":1,"winStreak":0,"teamNumber":1,"complete":true},
      {"id":"T2","queueOrder":2,"winStreak":0,"teamNumber":2,"complete":true},
      {"id":"T3","queueOrder":3,"winStreak":0,"teamNumber":3,"complete":true}
    ],
    "homeId":"T1","awayId":"T2","challengerId":null,"isRematch":false,
    "score":{"home":0,"away":0},"penaltyWinnerId":null,
    "goalkeepers":{"byTeam":{"T1":"G1","T2":"G2","T3":"G3"},"queue":[]},
    "engine":{"gameMode":"WINNER_STAYS","maxConsecutiveWins":null,"tieRule":"BOTH_OUT","tieReturnOrder":"TEAM_ORDER"}
  }$j$::jsonb);
  v_match := (v_fx ->> 'match_id')::uuid;
  v_home := (v_fx #>> '{to_id,T1}')::uuid;
  v_away := (v_fx #>> '{to_id,T2}')::uuid;
  v_t3 := (v_fx #>> '{to_id,T3}')::uuid;
  select m.event_id, m.started_by into v_event, v_owner from public.event_match m where m.id = v_match;

  perform pg_temp.assert_that(
    (select t.win_streak from public.event_sort_team t where t.id = v_t3) = 0,
    'win_streak default 0');

  v_msg := pg_temp.err(format(
    $s$insert into public.event_match (
      event_id, number, home_team_id, away_team_id, queue_before, started_by)
    values (%L, 2, %L, %L, '{}', %L)$s$,
    v_event, v_home, v_away, v_owner));
  perform pg_temp.assert_that(v_msg <> 'ok', 'recusa segunda Partida aberta no Evento');

  v_msg := pg_temp.err(format(
    $s$insert into public.event_match (
      event_id, number, home_team_id, away_team_id, status, queue_before, started_by)
    values (%L, 3, %L, %L, 'finished', '{}', %L)$s$,
    v_event, v_home, v_away, v_owner));
  perform pg_temp.assert_that(v_msg <> 'ok', 'finished exige ended_at');

  v_msg := pg_temp.err(format(
    $s$update public.event_match set decided_by_penalties = true where id = %L$s$, v_match));
  perform pg_temp.assert_that(v_msg <> 'ok', 'pênaltis exigem vencedor');

  v_p := pg_temp.person('Autor Prova', 'OUTFIELD');
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  select e.racha_id, v_p, 'PLAYER', 'OUTFIELD', 'ANY', 3
  from public.event e where e.id = v_event;

  v_msg := pg_temp.err(format(
    $s$insert into public.event_match_lineup (event_id, match_id, team_id) values (%L, %L, %L)$s$,
    v_event, v_match, v_home));
  perform pg_temp.assert_that(v_msg <> 'ok', 'elenco exige profile xor guest');

  insert into public.event_match_lineup (event_id, match_id, team_id, profile_id, role)
  values (v_event, v_match, v_home, v_p, 'OUTFIELD');
  v_msg := pg_temp.err(format(
    $s$insert into public.event_match_lineup (event_id, match_id, team_id, profile_id, role)
    values (%L, %L, %L, %L, 'OUTFIELD')$s$, v_event, v_match, v_away, v_p));
  perform pg_temp.assert_that(v_msg <> 'ok', 'uma pessoa ativa por Partida');

  v_g := pg_temp.person('Goleiro Prova', 'GOALKEEPER');
  insert into public.member (racha_id, profile_id, role, plays_as)
  select e.racha_id, v_g, 'PLAYER', 'GOALKEEPER' from public.event e where e.id = v_event;
  insert into public.event_match_lineup (event_id, match_id, team_id, profile_id, role)
  values (v_event, v_match, v_home, v_g, 'GOALKEEPER');
  v_msg := pg_temp.err(format(
    $s$insert into public.event_match_lineup (event_id, match_id, team_id, profile_id, role)
    values (%L, %L, %L, %L, 'GOALKEEPER')$s$,
    v_event, v_match, v_home, pg_temp.person('Goleiro Extra', 'GOALKEEPER')));
  perform pg_temp.assert_that(v_msg <> 'ok', 'no máximo um goleiro ativo por Time');

  insert into public.event_match_goal (event_id, match_id, request_key, team_id, scorer_profile_id)
  values (v_event, v_match, 'k-1', v_home, v_p);
  v_msg := pg_temp.err(format(
    $s$insert into public.event_match_goal (event_id, match_id, request_key, team_id, is_own_goal)
    values (%L, %L, 'k-1', %L, true)$s$, v_event, v_match, v_away));
  perform pg_temp.assert_that(v_msg <> 'ok', 'request_key único por Partida');

  v_msg := pg_temp.err(format(
    $s$insert into public.event_match_goal (event_id, match_id, request_key, team_id, scorer_profile_id, is_own_goal)
    values (%L, %L, 'og-bad', %L, %L, true)$s$, v_event, v_match, v_away, v_p));
  perform pg_temp.assert_that(v_msg <> 'ok', 'gol contra sem autor');

  v_msg := pg_temp.err(format(
    $s$insert into public.event_match_goal (event_id, match_id, request_key, team_id, scorer_profile_id, assist_profile_id)
    values (%L, %L, 'as-same', %L, %L, %L)$s$, v_event, v_match, v_home, v_p, v_p));
  perform pg_temp.assert_that(v_msg <> 'ok', 'assistência diferente do autor');

  v_msg := pg_temp.err(format(
    $s$insert into public.event_match_goal (event_id, match_id, request_key, team_id, scorer_profile_id)
    values (%L, %L, 'wrong-side', %L, %L)$s$, v_event, v_match, v_away, v_p));
  perform pg_temp.assert_that(v_msg <> 'ok' and v_msg like '%invalid_scorer%', 'autor de outro Time');

  raise notice 'PASS: esquema RLS, forma, único aberto, elenco e gatilho de Gol';
end $$;

-- ============================================================
-- 2. Motor JSON: entradas inválidas da etapa 1
-- ============================================================
do $$
declare
  v_base jsonb := $j${
    "teams":[
      {"id":"T1","queueOrder":1,"winStreak":0,"teamNumber":1,"complete":true},
      {"id":"T2","queueOrder":2,"winStreak":0,"teamNumber":2,"complete":true},
      {"id":"T3","queueOrder":3,"winStreak":0,"teamNumber":3,"complete":true}
    ],
    "homeId":"T1","awayId":"T2","challengerId":null,"isRematch":false,
    "score":{"home":1,"away":0},"penaltyWinnerId":null,
    "goalkeepers":{"byTeam":{"T1":"G1","T2":"G2","T3":"G3"},"queue":[]},
    "engine":{"gameMode":"WINNER_STAYS","maxConsecutiveWins":null,"tieRule":"BOTH_OUT","tieReturnOrder":"TEAM_ORDER"}
  }$j$::jsonb;
  v_bad jsonb;
begin
  perform pg_temp.assert_that(pg_temp.err($s$select private.event_match_engine(
    '{"teams":[{"id":"T1","queueOrder":1,"winStreak":0,"teamNumber":1}],"homeId":"T1","awayId":"T1","score":{"home":0,"away":0},"engine":{"gameMode":"WINNER_STAYS","tieRule":"BOTH_OUT","tieReturnOrder":"TEAM_ORDER"},"goalkeepers":{"byTeam":{},"queue":[]}}'::jsonb, null)$s$)
    <> 'ok', 'menos de 2 Times');

  v_bad := jsonb_set(v_base, '{homeId}', '"T3"');
  perform pg_temp.assert_that(pg_temp.err(format('select private.event_match_engine(%L::jsonb, null)', v_bad)) <> 'ok',
    'home/away fora da posição 1 x 2');

  v_bad := jsonb_set(v_base, '{teams,2,queueOrder}', '4');
  perform pg_temp.assert_that(pg_temp.err(format('select private.event_match_engine(%L::jsonb, null)', v_bad)) <> 'ok',
    'queueOrder com buraco');

  v_bad := jsonb_set(v_base, '{challengerId}', '"T3"');
  perform pg_temp.assert_that(pg_temp.err(format('select private.event_match_engine(%L::jsonb, null)', v_bad)) <> 'ok',
    'desafiante fora da Partida');

  v_bad := jsonb_set(jsonb_set(v_base, '{score}', '{"home":1,"away":1}'), '{engine,tieRule}', '"PENALTIES"');
  perform pg_temp.assert_that(pg_temp.err(format('select private.event_match_engine(%L::jsonb, null)', v_bad)) <> 'ok',
    'empate com PENALTIES sem vencedor');

  v_bad := jsonb_set(jsonb_set(v_base, '{engine,tieRule}', '"PENALTIES"'), '{penaltyWinnerId}', '"T1"');
  perform pg_temp.assert_that(pg_temp.err(format('select private.event_match_engine(%L::jsonb, null)', v_bad)) <> 'ok',
    'vencedor nos pênaltis sem empate');

  v_bad := jsonb_set(v_base, '{engine,gameMode}', '"MAX_WINS"');
  v_bad := jsonb_set(v_bad, '{engine,maxConsecutiveWins}', 'null');
  perform pg_temp.assert_that(pg_temp.err(format('select private.event_match_engine(%L::jsonb, null)', v_bad)) <> 'ok',
    'MAX_WINS sem N');

  v_bad := jsonb_set(v_base, '{isRematch}', 'true');
  perform pg_temp.assert_that(pg_temp.err(format('select private.event_match_engine(%L::jsonb, null)', v_bad)) <> 'ok',
    'revanche sem BOTH_STAY');

  v_bad := jsonb_set(v_base, '{score,home}', '-1');
  perform pg_temp.assert_that(pg_temp.err(format('select private.event_match_engine(%L::jsonb, null)', v_bad)) <> 'ok',
    'placar negativo');

  v_bad := jsonb_set(v_base, '{goalkeepers,queue}', '["G1"]');
  perform pg_temp.assert_that(pg_temp.err(format('select private.event_match_engine(%L::jsonb, null)', v_bad)) <> 'ok',
    'goleiro em dois lugares');

  perform pg_temp.assert_that(pg_temp.err($s$select private.event_match_next_state(
    '00000000-0000-0000-0000-000000000001'::uuid, null, null)$s$) <> 'ok',
    'next_state recusa Partida inexistente');

  raise notice 'PASS: motor recusa entradas inválidas';
end $$;

-- ============================================================
-- 3. Casos da etapa 1 contra private.event_match_next_state
-- ============================================================
create temp table cases (
  name text,
  input jsonb,
  rng_values jsonb,
  expected jsonb
);

insert into cases (name, input, rng_values, expected)
select e->>'name', e->'input', e->'rngValues', e->'expected'
from jsonb_array_elements($cases$
[
  {
    "name": "matriz WINNER_STAYS / BOTH_OUT / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T2",
        "T1"
      ],
      "winStreaks": {
        "T3": 2,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / BOTH_OUT / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / BOTH_OUT / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "MAX_WINS_OUT",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3",
        "T1"
      ],
      "enteringTeamIds": [
        "T2",
        "T3"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / BOTH_OUT / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz ROTATION / BOTH_OUT / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz ROTATION / BOTH_OUT / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz ROTATION / BOTH_OUT / tie",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / BOTH_STAY / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T2",
        "T1"
      ],
      "winStreaks": {
        "T3": 2,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / BOTH_STAY / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / BOTH_STAY / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "MAX_WINS_OUT",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3",
        "T1"
      ],
      "enteringTeamIds": [
        "T2",
        "T3"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / BOTH_STAY / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz ROTATION / BOTH_STAY / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz ROTATION / BOTH_STAY / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz ROTATION / BOTH_STAY / tie",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / PENALTIES / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T2",
        "T1"
      ],
      "winStreaks": {
        "T3": 2,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / PENALTIES / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / PENALTIES / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "MAX_WINS_OUT",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3",
        "T1"
      ],
      "enteringTeamIds": [
        "T2",
        "T3"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / PENALTIES / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz ROTATION / PENALTIES / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz ROTATION / PENALTIES / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz ROTATION / PENALTIES / tie",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / CHALLENGER_WINS / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T2",
        "T1"
      ],
      "winStreaks": {
        "T3": 2,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / CHALLENGER_WINS / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / CHALLENGER_WINS / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "MAX_WINS_OUT",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3",
        "T1"
      ],
      "enteringTeamIds": [
        "T2",
        "T3"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / CHALLENGER_WINS / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz ROTATION / CHALLENGER_WINS / homeWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz ROTATION / CHALLENGER_WINS / awayWin",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 3
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz ROTATION / CHALLENGER_WINS / tie",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / BOTH_OUT / tie",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "BOTH_OUT",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / BOTH_STAY / tie",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T1",
        "challengerId": "T1",
        "isRematch": true,
        "incompleteTeamIds": []
      },
      "consequence": "REMATCH",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [],
      "enteringTeamIds": []
    }
  },
  {
    "name": "matriz WINNER_STAYS / CHALLENGER_WINS / tie",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "CHALLENGER_STAYS",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / PENALTIES / tieHomePen",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 2
      },
      "penaltyWinnerId": "T3",
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T2",
        "T1"
      ],
      "winStreaks": {
        "T3": 2,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": true,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz WINNER_STAYS / PENALTIES / tieAwayPen",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 2
      },
      "penaltyWinnerId": "T1",
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": true,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / BOTH_OUT / tie",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "BOTH_OUT",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T3"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / BOTH_STAY / tie",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T1",
        "challengerId": "T1",
        "isRematch": true,
        "incompleteTeamIds": []
      },
      "consequence": "REMATCH",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [],
      "enteringTeamIds": []
    }
  },
  {
    "name": "matriz MAX_WINS / CHALLENGER_WINS / tie",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "CHALLENGER_STAYS",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / PENALTIES / tieHomePen",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 2
      },
      "penaltyWinnerId": "T3",
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "MAX_WINS_OUT",
      "fallback": null,
      "winnerId": "T3",
      "decidedByPenalties": true,
      "leavingTeamIds": [
        "T3",
        "T1"
      ],
      "enteringTeamIds": [
        "T2",
        "T3"
      ]
    }
  },
  {
    "name": "matriz MAX_WINS / PENALTIES / tieAwayPen",
    "input": {
      "teams": [
        {
          "id": "T3",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T3",
      "awayId": "T1",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 2
      },
      "penaltyWinnerId": "T1",
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T3": 0,
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T3": "G1",
          "T1": "G2",
          "T2": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": true,
      "leavingTeamIds": [
        "T3"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "2 Times, Rei: mandante vence, o perdedor volta para o fim e é o desafiante",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 1,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": "T2",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2"
      ],
      "enteringTeamIds": [
        "T2"
      ]
    }
  },
  {
    "name": "2 Times, Rei: visitante vence e passa para a posição 1",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 1
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": "T1",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T1"
      ]
    }
  },
  {
    "name": "2 Times, Rotação TEAM_ORDER: os dois saem e voltam pela ordem dos Times",
    "input": {
      "teams": [
        {
          "id": "T2",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        }
      ],
      "homeId": "T2",
      "awayId": "T1",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 3,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T2": "G1",
          "T1": "G2"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T2": 0,
        "T1": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T2": "G1",
          "T1": "G2"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T1",
        "T2"
      ]
    }
  },
  {
    "name": "2 Times, Rotação RANDOM com sorteio baixo: mantém mandante na frente",
    "input": {
      "teams": [
        {
          "id": "T2",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        }
      ],
      "homeId": "T2",
      "awayId": "T1",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 3,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T2": "G1",
          "T1": "G2"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "RANDOM"
      }
    },
    "rngValues": [
      0.2
    ],
    "expected": {
      "queue": [
        "T2",
        "T1"
      ],
      "winStreaks": {
        "T2": 0,
        "T1": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T2": "G1",
          "T1": "G2"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2",
        "T1"
      ],
      "enteringTeamIds": [
        "T2",
        "T1"
      ]
    }
  },
  {
    "name": "2 Times, Rotação RANDOM com sorteio alto: inverte",
    "input": {
      "teams": [
        {
          "id": "T2",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        }
      ],
      "homeId": "T2",
      "awayId": "T1",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 3,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T2": "G1",
          "T1": "G2"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "RANDOM"
      }
    },
    "rngValues": [
      0.8
    ],
    "expected": {
      "queue": [
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T2": 0,
        "T1": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T2": "G1",
          "T1": "G2"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T1",
        "T2"
      ]
    }
  },
  {
    "name": "2 Times, Máximo de Vitórias N=2: bate o máximo e a mesma dupla volta zerada",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 4,
        "away": 2
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "MAX_WINS_OUT",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T1",
        "T2"
      ]
    }
  },
  {
    "name": "3 Times, Rei: T1 vence T2, T3 sobe",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T3",
        "T2"
      ],
      "winStreaks": {
        "T1": 1,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "3 Times, Rei: T2 vence T1 e vai para a posição 1",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 1,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "3 Times, Rei, sai ambos sorteado (sorteio baixo): T1 e T2 saem nessa ordem, T3 abre",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "RANDOM"
      }
    },
    "rngValues": [
      0.1
    ],
    "expected": {
      "queue": [
        "T3",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "BOTH_OUT",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T3",
        "T1"
      ]
    }
  },
  {
    "name": "3 Times, Rei, sai ambos sorteado (sorteio alto): T2 volta na frente de T1",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "RANDOM"
      }
    },
    "rngValues": [
      0.9
    ],
    "expected": {
      "queue": [
        "T3",
        "T2",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T2",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "BOTH_OUT",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2",
        "T1"
      ],
      "enteringTeamIds": [
        "T3",
        "T2"
      ]
    }
  },
  {
    "name": "3 Times, Rotação TEAM_ORDER: T1 × T2 encerra e o próximo é T3 × T1",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T3",
        "T1"
      ]
    }
  },
  {
    "name": "3 Times, Rotação RANDOM: o perdedor pode voltar na frente do vencedor",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "RANDOM"
      }
    },
    "rngValues": [
      0.9
    ],
    "expected": {
      "queue": [
        "T3",
        "T2",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T2",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2",
        "T1"
      ],
      "enteringTeamIds": [
        "T3",
        "T2"
      ]
    }
  },
  {
    "name": "5 Times, Rei: o vencedor T2 vai para a frente e o perdedor T1 para o fim",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T4",
          "queueOrder": 4,
          "winStreak": 0,
          "teamNumber": 4,
          "complete": true
        },
        {
          "id": "T5",
          "queueOrder": 5,
          "winStreak": 0,
          "teamNumber": 5,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 2
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3",
          "T4": "G4",
          "T5": "G5"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T4",
        "T5",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 1,
        "T3": 0,
        "T4": 0,
        "T5": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3",
          "T4": "G4",
          "T5": "G5"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "5 Times, Rotação: os dois próximos da fila entram (T3 × T4)",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T4",
          "queueOrder": 4,
          "winStreak": 0,
          "teamNumber": 4,
          "complete": true
        },
        {
          "id": "T5",
          "queueOrder": 5,
          "winStreak": 0,
          "teamNumber": 5,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3",
          "T4": "G4",
          "T5": "G5"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T4",
        "T5",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0,
        "T4": 0,
        "T5": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3",
          "T4": "G4",
          "T5": "G5"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T4",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T3",
        "T4"
      ]
    }
  },
  {
    "name": "5 Times, Máximo de Vitórias N=3: a 3ª vitória do T1 manda T1 e T2 para o fim, T1 na frente",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 2,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T4",
          "queueOrder": 4,
          "winStreak": 0,
          "teamNumber": 4,
          "complete": true
        },
        {
          "id": "T5",
          "queueOrder": 5,
          "winStreak": 0,
          "teamNumber": 5,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3",
          "T4": "G4",
          "T5": "G5"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 3,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T4",
        "T5",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0,
        "T4": 0,
        "T5": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3",
          "T4": "G4",
          "T5": "G5"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T4",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "MAX_WINS_OUT",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T3",
        "T4"
      ]
    }
  },
  {
    "name": "5 Times, Máximo de Vitórias N=3: com 1 vitória antes, a 2ª ainda não estoura",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T4",
          "queueOrder": 4,
          "winStreak": 0,
          "teamNumber": 4,
          "complete": true
        },
        {
          "id": "T5",
          "queueOrder": 5,
          "winStreak": 0,
          "teamNumber": 5,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3",
          "T4": "G4",
          "T5": "G5"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 3,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T3",
        "T4",
        "T5",
        "T2"
      ],
      "winStreaks": {
        "T1": 2,
        "T2": 0,
        "T3": 0,
        "T4": 0,
        "T5": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3",
          "T4": "G4",
          "T5": "G5"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "5 Times, fica ambos: a mesma dupla joga de novo e a fila não anda",
    "input": {
      "teams": [
        {
          "id": "T4",
          "queueOrder": 1,
          "winStreak": 2,
          "teamNumber": 4,
          "complete": true
        },
        {
          "id": "T5",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 5,
          "complete": true
        },
        {
          "id": "T1",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 4,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 5,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T4",
      "awayId": "T5",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T4": "G1",
          "T5": "G2",
          "T1": "G3",
          "T2": "G4",
          "T3": "G5"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T4",
        "T5",
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T4": 0,
        "T5": 0,
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T4": "G1",
          "T5": "G2",
          "T1": "G3",
          "T2": "G4",
          "T3": "G5"
        },
        "queue": []
      },
      "next": {
        "homeId": "T4",
        "awayId": "T5",
        "challengerId": null,
        "isRematch": true,
        "incompleteTeamIds": []
      },
      "consequence": "REMATCH",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [],
      "enteringTeamIds": []
    }
  },
  {
    "name": "empate zera a sequência: fica ambos — T1 fica em campo e mesmo assim zera",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 2,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 3,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T2",
        "T3"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T2",
        "challengerId": null,
        "isRematch": true,
        "incompleteTeamIds": []
      },
      "consequence": "REMATCH",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [],
      "enteringTeamIds": []
    }
  },
  {
    "name": "empate zera a sequência: revanche que empata de novo — os dois zerados ao sair",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 2,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": true,
      "score": {
        "home": 0,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "BOTH_OUT",
      "fallback": "REMATCH_TIED_AGAIN",
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T3",
        "T1"
      ]
    }
  },
  {
    "name": "empate zera a sequência: desafiante leva — desafiante fica zerado, quem estava também",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 2,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": "T2",
      "isRematch": false,
      "score": {
        "home": 2,
        "away": 2
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 3,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "CHALLENGER_STAYS",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "empate zera a sequência: desafiante na posição 1 fica e zera (não leva a sequência)",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 2,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 3,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T3",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "CHALLENGER_STAYS",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "revanche que empata de novo vira sai ambos",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": true,
      "score": {
        "home": 2,
        "away": 2
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "BOTH_OUT",
      "fallback": "REMATCH_TIED_AGAIN",
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T3",
        "T1"
      ]
    }
  },
  {
    "name": "revanche com vencedor segue como vitória normal",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": true,
      "score": {
        "home": 0,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_STAY",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 1,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "desafiante leva sem desafiante (1ª Partida): vale sai ambos",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T1",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "BOTH_OUT",
      "fallback": "NO_CHALLENGER",
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T3",
        "T1"
      ]
    }
  },
  {
    "name": "desafiante leva com o desafiante na posição 2: o Time que estava sai",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 2,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": "T2",
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "CHALLENGER_STAYS",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "desafiante leva com 2 Times: o desafiante fica e o antigo vira o desafiante",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": "T2",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T1",
        "challengerId": "T1",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "CHALLENGER_STAYS",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T1"
      ]
    }
  },
  {
    "name": "desafiante leva com o desafiante na posição 1 (entrada montada à mão): ele fica e o outro sai",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": "T1",
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "CHALLENGER_WINS",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T3",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "CHALLENGER_STAYS",
      "fallback": null,
      "winnerId": null,
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "pênaltis: o vencedor informado é vitória normal e soma à sequência",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 1
      },
      "penaltyWinnerId": "T2",
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "PENALTIES",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 1,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": true,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "Time incompleto na vez joga normalmente e vem com aviso",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": false
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T3",
        "T2"
      ],
      "winStreaks": {
        "T1": 1,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": [
          "T3"
        ]
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "goleiros: 4 para 3 Times — cada um com o seu, o 4º espera",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": [
          "G4"
        ]
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T3",
        "T2"
      ],
      "winStreaks": {
        "T1": 1,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": [
          "G4"
        ]
      },
      "next": {
        "homeId": "T1",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "goleiros: 3 para 3 Times — o goleiro acompanha o Time que sai",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 1,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": "G3"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "goleiros: 2 para 3 Times — quem sai volta na hora (G2 sai com T2 e entra com T3)",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": null
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T3",
        "T2"
      ],
      "winStreaks": {
        "T1": 1,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": null,
          "T3": "G2"
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "goleiros: 2 para 3 Times — T1 perde, G1 vai e volta com T3",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": null
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 1,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": null,
          "T2": "G2",
          "T3": "G1"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "goleiros: 1 para 3 Times — T1 (com G1) vence: G1 fica e não há goleiro para T3",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": null,
          "T3": null
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T3",
        "T2"
      ],
      "winStreaks": {
        "T1": 1,
        "T2": 0,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": null,
          "T3": null
        },
        "queue": []
      },
      "next": {
        "homeId": "T1",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "goleiros: 1 para 3 Times — T1 (com G1) perde: G1 fica e defende T3, que chega pelo lado dele",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 0,
        "away": 1
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": null,
          "T3": null
        },
        "queue": []
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T2",
        "T3",
        "T1"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 1,
        "T3": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": null,
          "T2": null,
          "T3": "G1"
        },
        "queue": []
      },
      "next": {
        "homeId": "T2",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T2",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "goleiros: 3 para 4 Times (rodízio) — G2 vai ao fim e entra o primeiro da fila (G3)",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T4",
          "queueOrder": 4,
          "winStreak": 0,
          "teamNumber": 4,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": null,
          "T4": null
        },
        "queue": [
          "G3"
        ]
      },
      "engine": {
        "gameMode": "WINNER_STAYS",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T1",
        "T3",
        "T4",
        "T2"
      ],
      "winStreaks": {
        "T1": 1,
        "T2": 0,
        "T3": 0,
        "T4": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": null,
          "T3": "G3",
          "T4": null
        },
        "queue": [
          "G2"
        ]
      },
      "next": {
        "homeId": "T1",
        "awayId": "T3",
        "challengerId": "T3",
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "WINNER_STAYS",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T2"
      ],
      "enteringTeamIds": [
        "T3"
      ]
    }
  },
  {
    "name": "goleiros: 2 para 5 Times, Rotação — os dois goleiros saem e voltam com T3 e T4 na ordem da fila do gol",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 0,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T4",
          "queueOrder": 4,
          "winStreak": 0,
          "teamNumber": 4,
          "complete": true
        },
        {
          "id": "T5",
          "queueOrder": 5,
          "winStreak": 0,
          "teamNumber": 5,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": null,
          "T4": null,
          "T5": null
        },
        "queue": []
      },
      "engine": {
        "gameMode": "ROTATION",
        "maxConsecutiveWins": null,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T4",
        "T5",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0,
        "T4": 0,
        "T5": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": null,
          "T2": null,
          "T3": "G1",
          "T4": "G2",
          "T5": null
        },
        "queue": []
      },
      "next": {
        "homeId": "T3",
        "awayId": "T4",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "ROTATION",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T3",
        "T4"
      ]
    }
  },
  {
    "name": "goleiros: 3 para 4 Times, Máximo de Vitórias — vencedor e perdedor saem, na ordem da fila do gol",
    "input": {
      "teams": [
        {
          "id": "T1",
          "queueOrder": 1,
          "winStreak": 1,
          "teamNumber": 1,
          "complete": true
        },
        {
          "id": "T2",
          "queueOrder": 2,
          "winStreak": 0,
          "teamNumber": 2,
          "complete": true
        },
        {
          "id": "T3",
          "queueOrder": 3,
          "winStreak": 0,
          "teamNumber": 3,
          "complete": true
        },
        {
          "id": "T4",
          "queueOrder": 4,
          "winStreak": 0,
          "teamNumber": 4,
          "complete": true
        }
      ],
      "homeId": "T1",
      "awayId": "T2",
      "challengerId": null,
      "isRematch": false,
      "score": {
        "home": 1,
        "away": 0
      },
      "penaltyWinnerId": null,
      "goalkeepers": {
        "byTeam": {
          "T1": "G1",
          "T2": "G2",
          "T3": null,
          "T4": null
        },
        "queue": [
          "G3"
        ]
      },
      "engine": {
        "gameMode": "MAX_WINS",
        "maxConsecutiveWins": 2,
        "tieRule": "BOTH_OUT",
        "tieReturnOrder": "TEAM_ORDER"
      }
    },
    "rngValues": [],
    "expected": {
      "queue": [
        "T3",
        "T4",
        "T1",
        "T2"
      ],
      "winStreaks": {
        "T1": 0,
        "T2": 0,
        "T3": 0,
        "T4": 0
      },
      "goalkeepers": {
        "byTeam": {
          "T1": null,
          "T2": null,
          "T3": "G3",
          "T4": "G1"
        },
        "queue": [
          "G2"
        ]
      },
      "next": {
        "homeId": "T3",
        "awayId": "T4",
        "challengerId": null,
        "isRematch": false,
        "incompleteTeamIds": []
      },
      "consequence": "MAX_WINS_OUT",
      "fallback": null,
      "winnerId": "T1",
      "decidedByPenalties": false,
      "leavingTeamIds": [
        "T1",
        "T2"
      ],
      "enteringTeamIds": [
        "T3",
        "T4"
      ]
    }
  }
]

$cases$::jsonb) e;

do $$
declare
  v_c record;
  v_fx jsonb;
  v_pen uuid;
  v_seed double precision;
  v_got jsonb;
  v_n integer := 0;
begin
  for v_c in select * from cases order by name
  loop
    v_fx := pg_temp.mount(v_c.input);
    if v_c.input ->> 'penaltyWinnerId' is not null then
      v_pen := (v_fx -> 'to_id' ->> (v_c.input ->> 'penaltyWinnerId'))::uuid;
    else
      v_pen := null;
    end if;
    if jsonb_array_length(coalesce(v_c.rng_values, '[]'::jsonb)) > 0 then
      v_seed := (v_c.rng_values ->> 0)::double precision;
    else
      v_seed := null;
    end if;
    v_got := pg_temp.relabel(
      private.event_match_next_state((v_fx ->> 'match_id')::uuid, v_pen, v_seed),
      v_fx -> 'to_label'
    );
    if v_got is distinct from v_c.expected then
      raise exception 'FAIL caso %
got %
exp %', v_c.name, v_got, v_c.expected;
    end if;
    v_n := v_n + 1;
  end loop;
  perform pg_temp.assert_that(v_n = 76, '76 casos da etapa 1');
  raise notice 'PASS: % casos da etapa 1 contra event_match_next_state', v_n;
end $$;

-- Evento + Sorteio confirmado + Times, sem Partida. p_gks extras vão para a fila do gol.
create function pg_temp.live(
  p_tag text,
  p_mode public.game_mode default 'WINNER_STAYS',
  p_tie public.tie_rule default 'BOTH_OUT',
  p_gks integer default 3,
  p_teams integer default 3,
  p_limit smallint default 3
) returns jsonb
language plpgsql as $$
declare
  v_owner uuid;
  v_admin uuid;
  v_player uuid;
  v_inactive uuid;
  v_out uuid;
  v_racha uuid;
  v_event uuid;
  v_code text;
  v_tn integer;
  v_tid uuid;
  v_pid uuid;
  v_i integer;
  v_q integer := 0;
  v_teams uuid[] := '{}';
  v_line uuid[] := '{}';
  v_gk uuid[] := '{}';
  v_gid uuid;
begin
  v_owner := pg_temp.person('Dono Live ' || substr(p_tag, 1, 4), 'OUTFIELD');
  v_admin := pg_temp.person('Admin Live ' || substr(p_tag, 1, 4), 'OUTFIELD');
  v_inactive := pg_temp.person('Inat Live ' || substr(p_tag, 1, 4), 'OUTFIELD');
  v_out := pg_temp.person('Fora Live ' || substr(p_tag, 1, 4), 'OUTFIELD');
  v_code := translate(upper(substr(md5(p_tag || clock_timestamp()::text), 1, 6)), '01', 'ZY');

  insert into public.racha (name, invite_code, place, spot_limit, outfield_per_team)
  values ('Prova Live ' || p_tag, v_code, 'Quadra Live', 30, p_limit)
  returning id into v_racha;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values
    (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_admin, 'ADMIN', 'OUTFIELD', 'ANY', 3),
    (v_racha, v_inactive, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  update public.member set is_active = false
  where racha_id = v_racha and profile_id = v_inactive;

  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    v_racha, current_date, time '19:00', 'Quadra Live', 'active', v_owner, 30,
    24, p_limit, p_mode, 2, p_tie, 'TEAM_ORDER', false, 10
  ) returning id into v_event;

  insert into public.event_sort (
    event_id, status, signature, version, leftover_ids, mode, goalkeepers_per_team,
    balance_score, balance_label, balance_diff, super_diff, capped_by_super,
    confirmed_at, confirmed_by
  ) values (
    v_event, 'confirmed', 'match-rpc', 1, '{}', 'normal', true,
    80, 'Equilibrado', 0, 0, false, now(), v_owner
  );

  for v_tn in 1..p_teams loop
    insert into public.event_sort_team (event_id, team_number, queue_order, win_streak)
    values (v_event, v_tn, v_tn, 0)
    returning id into v_tid;
    v_teams := v_teams || v_tid;
    for v_i in 1..p_limit loop
      v_pid := pg_temp.person(
        'Linha ' || substr(p_tag, 1, 2) || chr(64 + v_tn) || chr(96 + v_i), 'OUTFIELD'
      );
      insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
      values (v_racha, v_pid, 'PLAYER', 'OUTFIELD', 'ANY', 3);
      insert into public.event_sort_team_player (
        event_id, team_id, profile_id, stars_snapshot, is_super_star_snapshot,
        primary_position_snapshot
      ) values (v_event, v_tid, v_pid, 3, false, 'ANY');
      v_line := v_line || v_pid;
    end loop;
  end loop;

  v_player := v_line[1];

  for v_i in 1..p_gks loop
    v_gid := pg_temp.person('Goleiro ' || substr(p_tag, 1, 2) || chr(64 + v_i), 'GOALKEEPER');
    insert into public.member (racha_id, profile_id, role, plays_as)
    values (v_racha, v_gid, 'PLAYER', 'GOALKEEPER');
    v_gk := v_gk || v_gid;
    if v_i <= p_teams then
      insert into public.event_sort_goalkeeper (event_id, team_id, profile_id)
      values (v_event, v_teams[v_i], v_gid);
    else
      v_q := v_q + 1;
      insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id)
      values (v_event, v_q, v_gid);
    end if;
  end loop;

  return jsonb_build_object(
    'owner', v_owner, 'admin', v_admin, 'player', v_player,
    'inactive', v_inactive, 'out', v_out,
    'racha', v_racha, 'event', v_event,
    'teams', to_jsonb(v_teams), 'line', to_jsonb(v_line), 'gk', to_jsonb(v_gk)
  );
end $$;

-- ============================================================
-- 4. Autorização, start, gol, pausa, encerrar, descarte, créditos
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_admin uuid;
  v_player uuid;
  v_inactive uuid;
  v_out uuid;
  v_home uuid;
  v_away uuid;
  v_t3 uuid;
  v_match uuid;
  v_mid2 uuid;
  v_goal uuid;
  v_goal2 uuid;
  v_scorer uuid;
  v_assist uuid;
  v_other uuid;
  v_gk_home uuid;
  v_gk_spare uuid;
  v_seq bigint;
  v_seq2 bigint;
  v_paused integer;
  v_j jsonb;
  v_msg text;
begin
  v := pg_temp.live('auth', 'WINNER_STAYS', 'BOTH_OUT', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;
  v_player := (v ->> 'player')::uuid;
  v_inactive := (v ->> 'inactive')::uuid;
  v_out := (v ->> 'out')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_away := (v #>> '{teams,1}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  v_scorer := (v #>> '{line,0}')::uuid;
  v_assist := (v #>> '{line,1}')::uuid;
  v_other := (v #>> '{line,3}')::uuid;
  v_gk_home := (v #>> '{gk,0}')::uuid;

  perform pg_temp.assert_that(
    (select p.prosecdef and p.proconfig @> array['search_path=""']
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'start_event_match'),
    'start: security definer e search_path vazio');
  perform pg_temp.assert_that(
    has_function_privilege('authenticated', 'public.get_event_match(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.get_event_match(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'private.event_match_touch(uuid)', 'execute')
    and not has_function_privilege('anon', 'private.event_match_notify(uuid)', 'execute'),
    'grant authenticated / revoke anon e helpers privados');

  perform pg_temp.as_(v_player);
  v_msg := pg_temp.err(format('select public.start_event_match(%L)', v_e));
  perform pg_temp.assert_that(v_msg = 'not_conductor', 'Jogador não inicia');

  perform pg_temp.as_(v_admin);
  v_msg := pg_temp.err(format('select public.start_event_match(%L)', v_e));
  perform pg_temp.assert_that(v_msg = 'not_conductor', 'Admin que não conduz não inicia');

  perform pg_temp.as_(v_inactive);
  v_msg := pg_temp.err(format('select public.get_event_match(%L)', v_e));
  perform pg_temp.assert_that(v_msg = 'not_allowed', 'Membro inativo não lê');

  perform pg_temp.as_(v_out);
  v_msg := pg_temp.err(format('select public.get_event_match(%L)', v_e));
  perform pg_temp.assert_that(v_msg = 'not_allowed', 'não Membro não lê');

  perform pg_temp.as_(v_player);
  v_j := public.get_event_match(v_e);
  perform pg_temp.assert_that(
    v_j ->> 'state' = 'ready'
    and (v_j #>> '{viewer,can_conduct}')::boolean is not true
    and v_j -> 'next_match' -> 'home' ->> 'team_id' = v_home::text
    and v_j -> 'next_match' -> 'away' ->> 'team_id' = v_away::text,
    'Jogador lê o próximo confronto sem conduzir');

  perform pg_temp.as_(v_owner);
  v_j := public.get_event_match(v_e);
  perform pg_temp.assert_that((v_j #>> '{viewer,can_conduct}')::boolean, 'Condutor can_conduct');

  -- um Time só na fila
  update public.event_sort_team set queue_order = null where id in (v_away, v_t3);
  v_msg := pg_temp.err(format('select public.start_event_match(%L)', v_e));
  perform pg_temp.assert_that(v_msg = 'not_enough_teams', 'menos de 2 Times');
  update public.event_sort_team t set queue_order = x.n
  from (values (v_home, 1), (v_away, 2), (v_t3, 3)) as x(id, n)
  where t.id = x.id;

  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform pg_temp.assert_that(
    v_j ->> 'state' = 'open'
    and v_j -> 'match' -> 'home' ->> 'team_id' = v_home::text
    and (select count(*) from public.event_match_lineup l
         where l.match_id = v_match and l.role = 'OUTFIELD' and l.left_at is null) = 6
    and (select count(*) from public.event_match_lineup l
         where l.match_id = v_match and l.role = 'GOALKEEPER' and l.left_at is null) = 2,
    'Iniciar monta elenco 1 x 2');

  v_msg := pg_temp.err(format('select public.start_event_match(%L)', v_e));
  perform pg_temp.assert_that(v_msg = 'match_open', 'segunda start com aberta');

  -- gol repetido
  v_seq := (select m.seq from public.event_match m where m.id = v_match);
  v_j := public.add_event_match_goal(v_match, 'k-dup', v_home, v_scorer, v_assist, false);
  v_goal := (select g.id from public.event_match_goal g where g.match_id = v_match and g.request_key = 'k-dup');
  v_seq2 := (select m.seq from public.event_match m where m.id = v_match);
  perform pg_temp.assert_that(v_seq2 > v_seq, 'primeiro gol sobe seq');
  v_j := public.add_event_match_goal(v_match, 'k-dup', v_home, v_scorer, null, false);
  perform pg_temp.assert_that(
    (select count(*) from public.event_match_goal g where g.match_id = v_match) = 1
    and (select m.seq from public.event_match m where m.id = v_match) = v_seq2,
    'request_key repetida não duplica nem sobe seq');

  -- gol contra credita o adversário
  v_j := public.add_event_match_goal(v_match, 'k-og', v_home, null, null, true);
  perform pg_temp.assert_that(
    (select g.team_id = v_away and g.scorer_id is null and g.is_own_goal
     from public.event_match_goal g where g.request_key = 'k-og'),
    'gol contra credita o adversário sem autor');

  v_msg := pg_temp.err(format(
    'select public.add_event_match_goal(%L, %L, %L, %L, null, false)',
    v_match, 'k-wrong', v_home, v_other));
  perform pg_temp.assert_that(v_msg = 'invalid_scorer', 'autor de outro Time');

  -- correção de autoria aberta
  perform public.update_event_match_goal(v_goal, v_assist, v_scorer);
  perform pg_temp.assert_that(
    (select g.scorer_id = v_assist and g.assist_id = v_scorer
     from public.event_match_goal g where g.id = v_goal),
    'troca autoria com Partida aberta');

  -- pausa dupla e retomada
  v_seq := (select m.seq from public.event_match m where m.id = v_match);
  perform public.pause_event_match(v_match);
  v_seq2 := (select m.seq from public.event_match m where m.id = v_match);
  perform pg_temp.assert_that(v_seq2 > v_seq, 'primeira pausa sobe seq');
  perform public.pause_event_match(v_match);
  perform pg_temp.assert_that(
    (select m.seq from public.event_match m where m.id = v_match) = v_seq2
    and (select m.paused_at is not null from public.event_match m where m.id = v_match),
    'segunda pausa não sobe seq');
  -- recua started_at para o check paused_at >= started_at continuar válido
  update public.event_match
  set started_at = now() - interval '30 seconds',
      paused_at = now() - interval '7 seconds'
  where id = v_match;
  perform public.resume_event_match(v_match);
  v_paused := (select m.paused_seconds from public.event_match m where m.id = v_match);
  perform pg_temp.assert_that(v_paused between 6 and 9, 'retomada soma segundos uma vez');
  perform public.pause_event_match(v_match);
  update public.event_match
  set paused_at = now() - interval '3 seconds'
  where id = v_match;
  perform public.resume_event_match(v_match);
  perform pg_temp.assert_that(
    (select m.paused_seconds from public.event_match m where m.id = v_match)
      between v_paused + 2 and v_paused + 5,
    'segunda retomada soma de novo em cima do acumulado');

  raise notice 'PASS: autorização, start, gol, pausa';
end $$;

do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_home uuid;
  v_away uuid;
  v_t3 uuid;
  v_match uuid;
  v_goal uuid;
  v_scorer uuid;
  v_assist uuid;
  v_other uuid;
  v_j jsonb;
  v_msg text;
  v_q1 uuid;
  v_q2 uuid;
  v_q3 uuid;
  v_s1 integer;
  v_s2 integer;
begin
  -- Rei da Quadra via finish
  v := pg_temp.live('rei', 'WINNER_STAYS', 'BOTH_OUT', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_away := (v #>> '{teams,1}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  v_scorer := (v #>> '{line,0}')::uuid;
  v_assist := (v #>> '{line,1}')::uuid;
  v_other := (v #>> '{line,3}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'rei-1', v_home, v_scorer, v_assist, false);
  v_j := public.preview_finish_event_match(v_match);
  perform pg_temp.assert_that(
    v_j ->> 'consequence' = 'WINNER_STAYS'
    and (v_j ->> 'winner_team_id')::uuid = v_home,
    'prévia Rei da Quadra');
  perform public.finish_event_match(v_match);
  select t.id into v_q1 from public.event_sort_team t where t.event_id = v_e and t.queue_order = 1;
  select t.id into v_q2 from public.event_sort_team t where t.event_id = v_e and t.queue_order = 2;
  select t.id into v_q3 from public.event_sort_team t where t.event_id = v_e and t.queue_order = 3;
  perform pg_temp.assert_that(
    v_q1 = v_home and v_q2 = v_t3 and v_q3 = v_away
    and (select t.win_streak from public.event_sort_team t where t.id = v_home) = 1
    and (select t.win_streak from public.event_sort_team t where t.id = v_away) = 0
    and (select m.next_is_rematch is not true from public.event_match m where m.id = v_match)
    and (select m.next_challenger_team_id from public.event_match m where m.id = v_match) = v_t3,
    'finish Rei da Quadra reordena fila e streak');

  v_goal := (select g.id from public.event_match_goal g where g.match_id = v_match and g.request_key = 'rei-1');
  perform public.update_event_match_goal(v_goal, v_assist, null);
  perform pg_temp.assert_that(
    (select g.scorer_id = v_assist and g.assist_id is null
     from public.event_match_goal g where g.id = v_goal),
    'troca autoria com Partida encerrada e Evento active');
  v_msg := pg_temp.err(format('select public.delete_event_match_goal(%L)', v_goal));
  perform pg_temp.assert_that(v_msg = 'match_locked', 'apagar após encerrar');

  -- BOTH_STAY: empate vira revanche; empate zera streak de quem ficou
  v := pg_temp.live('rev', 'WINNER_STAYS', 'BOTH_STAY', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_away := (v #>> '{teams,1}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  perform pg_temp.as_(v_owner);
  update public.event_sort_team set win_streak = 2 where id = v_home;
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  v_j := public.preview_finish_event_match(v_match);
  perform pg_temp.assert_that(v_j ->> 'consequence' = 'REMATCH', 'prévia BOTH_STAY');
  perform public.finish_event_match(v_match);
  perform pg_temp.assert_that(
    (select m.next_is_rematch from public.event_match m where m.id = v_match)
    and (select t.queue_order from public.event_sort_team t where t.id = v_home) = 1
    and (select t.queue_order from public.event_sort_team t where t.id = v_away) = 2
    and (select t.win_streak from public.event_sort_team t where t.id = v_home) = 0
    and (select t.win_streak from public.event_sort_team t where t.id = v_away) = 0,
    'BOTH_STAY grava revanche e zera streak dos dois');
  v_j := public.start_event_match(v_e);
  perform pg_temp.assert_that(
    (v_j #>> '{match,is_rematch}')::boolean
    and (v_j #>> '{match,home,team_id}')::uuid = v_home,
    'Iniciar seguinte herda a revanche');

  -- empate BOTH_OUT também zera
  v := pg_temp.live('emp', 'WINNER_STAYS', 'BOTH_OUT', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_away := (v #>> '{teams,1}')::uuid;
  perform pg_temp.as_(v_owner);
  update public.event_sort_team set win_streak = 3 where id in (v_home, v_away);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform public.finish_event_match(v_match);
  select t.win_streak into v_s1 from public.event_sort_team t where t.id = v_home;
  select t.win_streak into v_s2 from public.event_sort_team t where t.id = v_away;
  perform pg_temp.assert_that(v_s1 = 0 and v_s2 = 0, 'empate zera streak via finish');

  -- pênaltis sem vencedor
  v := pg_temp.live('pen', 'WINNER_STAYS', 'PENALTIES', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  v_msg := pg_temp.err(format('select public.preview_finish_event_match(%L)', v_match));
  perform pg_temp.assert_that(v_msg = 'penalty_winner_required', 'prévia pênaltis sem vencedor');
  v_msg := pg_temp.err(format('select public.finish_event_match(%L)', v_match));
  perform pg_temp.assert_that(v_msg = 'penalty_winner_required', 'finish pênaltis sem vencedor');
  perform public.finish_event_match(v_match, v_home);
  perform pg_temp.assert_that(
    (select m.winner_team_id = v_home and m.decided_by_penalties
     from public.event_match m where m.id = v_match),
    'finish com vencedor nos pênaltis');

  raise notice 'PASS: finish Rei da Quadra, revanche, empate zera streak, pênaltis';
end $$;

do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_home uuid;
  v_away uuid;
  v_t3 uuid;
  v_match uuid;
  v_scorer uuid;
  v_left uuid;
  v_gk_home uuid;
  v_gk_spare uuid;
  v_goal1 uuid;
  v_goal2 uuid;
  v_j jsonb;
  v_before jsonb;
  v_qo1 smallint;
  v_st1 smallint;
  v_ended timestamptz;
  v_mid_left timestamptz;
begin
  -- descarte restaura filas e streak
  v := pg_temp.live('disc', 'WINNER_STAYS', 'BOTH_OUT', 4, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_away := (v #>> '{teams,1}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  v_scorer := (v #>> '{line,0}')::uuid;
  v_gk_home := (v #>> '{gk,0}')::uuid;
  v_gk_spare := (v #>> '{gk,3}')::uuid;
  perform pg_temp.as_(v_owner);
  update public.event_sort_team set win_streak = 4 where id = v_home;
  v_before := private.event_match_queue_before_json(v_e);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'd-1', v_home, v_scorer, null, false);
  perform public.swap_event_match_goalkeeper(v_match, v_home, v_gk_spare);
  perform public.discard_event_match(v_match);
  perform pg_temp.assert_that(
    (select m.status from public.event_match m where m.id = v_match) = 'discarded'
    and (select t.win_streak from public.event_sort_team t where t.id = v_home) = 4
    and (select t.queue_order from public.event_sort_team t where t.id = v_home) = 1
    and (select t.queue_order from public.event_sort_team t where t.id = v_away) = 2
    and (select t.queue_order from public.event_sort_team t where t.id = v_t3) = 3
    and (select k.team_id from public.event_sort_goalkeeper k
         where k.event_id = v_e and k.person_id = v_gk_home) = v_home
    and (select k.team_id is null and k.queue_order = 1
         from public.event_sort_goalkeeper k
         where k.event_id = v_e and k.person_id = v_gk_spare)
    and not exists (
      select 1 from jsonb_array_elements(public.get_event_match(v_e) -> 'finished_matches') x
      where (x ->> 'id')::uuid = v_match
    ),
    'descarte restaura fila, streak e goleiros; discarded fora da lista');

  -- troca de goleiro: conceded_* diferente antes e depois
  v := pg_temp.live('swap', 'WINNER_STAYS', 'BOTH_OUT', 4, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_away := (v #>> '{teams,1}')::uuid;
  v_scorer := (v #>> '{line,3}')::uuid;
  v_gk_home := (v #>> '{gk,0}')::uuid;
  v_gk_spare := (v #>> '{gk,3}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'sw-1', v_away, v_scorer, null, false);
  v_goal1 := (select g.id from public.event_match_goal g where g.request_key = 'sw-1');
  perform pg_temp.assert_that(
    (select g.conceded_goalkeeper_id from public.event_match_goal g where g.id = v_goal1) = v_gk_home,
    'gol antes da troca concede no goleiro inicial');
  perform public.swap_event_match_goalkeeper(v_match, v_home, v_gk_spare);
  perform public.add_event_match_goal(v_match, 'sw-2', v_away, v_scorer, null, false);
  v_goal2 := (select g.id from public.event_match_goal g where g.request_key = 'sw-2');
  perform pg_temp.assert_that(
    (select g.conceded_goalkeeper_id from public.event_match_goal g where g.id = v_goal2) = v_gk_spare
    and (select g.conceded_goalkeeper_id from public.event_match_goal g where g.id = v_goal1) = v_gk_home,
    'gol depois da troca concede no goleiro novo');

  -- créditos derivados
  v := pg_temp.live('cred', 'WINNER_STAYS', 'BOTH_OUT', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_away := (v #>> '{teams,1}')::uuid;
  v_scorer := (v #>> '{line,0}')::uuid;
  v_left := (v #>> '{line,2}')::uuid;
  v_gk_home := (v #>> '{gk,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'cr-1', v_home, v_scorer, null, false);
  -- now() é o instante da transação do teste; recua para o left_at do meio
  -- ficar distinto do ended_at do apito
  update public.event_match m
  set started_at = now() - interval '2 minutes'
  where m.id = v_match;
  update public.event_match_lineup l
  set entered_at = now() - interval '2 minutes'
  where l.match_id = v_match;
  v_mid_left := now() - interval '1 minute';
  update public.event_match_lineup l
  set left_at = v_mid_left
  where l.match_id = v_match and l.person_id = v_left;
  perform public.finish_event_match(v_match);
  select m.ended_at into v_ended from public.event_match m where m.id = v_match;

  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.person_id = v_left and l.left_at = v_mid_left
    ),
    'Partida jogada: quem saiu no meio ainda tem linha');
  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.person_id = v_scorer
        and l.team_id = v_home and l.left_at = v_ended
    )
    and not exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.person_id = v_left and l.left_at = v_ended
    ),
    'Vitória só quem estava ativo no apito');
  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.person_id = v_gk_home
        and l.role = 'GOALKEEPER' and l.team_id = v_home and l.left_at = v_ended
    )
    and not exists (
      select 1 from public.event_match_goal g
      where g.match_id = v_match and g.team_id = v_away
    ),
    'jogo sem sofrer gol: goleiro ativo no apito no Time que não sofreu');

  -- correção de goleiro no Iniciar (fila) e recusa de campo
  v := pg_temp.live('corr', 'WINNER_STAYS', 'BOTH_OUT', 4, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_scorer := (v #>> '{line,0}')::uuid;
  v_gk_spare := (v #>> '{gk,3}')::uuid;
  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.start_event_match(%L, %L, null)', v_e, v_scorer))
      = 'invalid_goalkeeper',
    'Iniciar recusa jogador de linha no gol');
  v_j := public.start_event_match(v_e, v_gk_spare, null);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.role = 'GOALKEEPER'
        and l.team_id = v_home and l.person_id = v_gk_spare and l.left_at is null
    ),
    'Iniciar aceita goleiro da fila do gol');

  raise notice 'PASS: descarte, troca de goleiro, créditos, correção no Iniciar';
end $$;

-- ============================================================
-- 5. Integração: Saída, Inclusão, recálculo, finish_event e home
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_r uuid;
  v_owner uuid;
  v_home uuid;
  v_away uuid;
  v_t3 uuid;
  v_match uuid;
  v_scorer uuid;
  v_away_scorer uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_p3 uuid;
  v_gk_home uuid;
  v_gk_spare uuid;
  v_new uuid;
  v_dest uuid;
  v_none uuid;
  v_j jsonb;
begin
  -- Time em campo esvaziado fica na fila até o apito
  v := pg_temp.live('saiL', 'WINNER_STAYS', 'BOTH_OUT', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_away := (v #>> '{teams,1}')::uuid;
  v_p1 := (v #>> '{line,0}')::uuid;
  v_p2 := (v #>> '{line,1}')::uuid;
  v_p3 := (v #>> '{line,2}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;

  perform private.event_sort_close_player(v_e, v_p1, null);
  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.person_id = v_p1
        and l.role = 'OUTFIELD' and l.left_at is not null
    ),
    'Saída de linha fecha o elenco da Partida');
  perform private.event_sort_close_player(v_e, v_p2, null);
  perform private.event_sort_close_player(v_e, v_p3, null);
  perform pg_temp.assert_that(
    (select t.queue_order from public.event_sort_team t where t.id = v_home) = 1
    and not exists (
      select 1 from public.event_sort_team_player p
      where p.team_id = v_home and p.left_at is null
    ),
    'Time em campo vazio não some da fila no meio');

  perform public.finish_event_match(v_match);
  perform pg_temp.assert_that(
    (select t.queue_order from public.event_sort_team t where t.id = v_home) is null,
    'Time em campo vazio some depois do finish_event_match');

  -- Saída de goleiro: primeiro da fila entra; Gol seguinte grava conceded_*
  v := pg_temp.live('saiG', 'WINNER_STAYS', 'BOTH_OUT', 4, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_away := (v #>> '{teams,1}')::uuid;
  v_gk_home := (v #>> '{gk,0}')::uuid;
  v_gk_spare := (v #>> '{gk,3}')::uuid;
  v_away_scorer := (v #>> '{line,3}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform private.event_sort_close_player(v_e, v_gk_home, null);
  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.person_id = v_gk_home
        and l.role = 'GOALKEEPER' and l.left_at is not null
    )
    and exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.person_id = v_gk_spare
        and l.role = 'GOALKEEPER' and l.team_id = v_home and l.left_at is null
    )
    and exists (
      select 1 from public.event_sort_goalkeeper k
      where k.event_id = v_e and k.person_id = v_gk_spare and k.team_id = v_home
    ),
    'Saída de goleiro puxa o primeiro da fila do gol');
  perform public.add_event_match_goal(v_match, 'saiG-1', v_away, v_away_scorer, null, false);
  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_match_goal g
      where g.match_id = v_match and g.request_key = 'saiG-1'
        and g.conceded_goalkeeper_id = v_gk_spare
    ),
    'Gol seguinte grava o novo conceded_*');

  -- Inclusão com Partida aberta: pula 1 e 2 (T1 incompleto não recebe)
  v := pg_temp.live('inc', 'WINNER_STAYS', 'BOTH_OUT', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  v_p1 := (v #>> '{line,0}')::uuid;
  v_p3 := (v #>> '{line,6}')::uuid;
  perform pg_temp.as_(v_owner);
  perform public.start_event_match(v_e);
  perform private.event_sort_close_player(v_e, v_p1, null);
  perform private.event_sort_close_player(v_e, v_p3, null);
  v_new := pg_temp.person('Novo Inc Abc', 'OUTFIELD');
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values ((v ->> 'racha')::uuid, v_new, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  perform private.event_sort_place_player(v_e, v_new, null, 'OUTFIELD', 3::smallint, false, 'ANY', null);
  select p.team_id into v_dest
  from public.event_sort_team_player p
  where p.event_id = v_e and p.person_id = v_new and p.left_at is null;
  perform pg_temp.assert_that(
    v_dest = v_t3
    and (select t.queue_order from public.event_sort_team t where t.id = v_dest) = 3,
    'Inclusão com Partida aberta vai ao incompleto que não é 1 nem 2');

  -- Recálculo não mexe no goleiro ativo da Partida (2 GKs, 3 Times: sem pin cairiam na fila)
  v := pg_temp.live('reb', 'WINNER_STAYS', 'BOTH_OUT', 2, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_away := (v #>> '{teams,1}')::uuid;
  v_gk_home := (v #>> '{gk,0}')::uuid;
  v_gk_spare := (v #>> '{gk,1}')::uuid;
  perform pg_temp.as_(v_owner);
  -- live liga GKs ao Time; no rodízio o Iniciar só faz bind a partir da fila
  update public.event_sort_goalkeeper k
  set team_id = null, queue_order = 100 + r.n
  from (
    select x.id, row_number() over (order by x.id)::integer as n
    from public.event_sort_goalkeeper x where x.event_id = v_e
  ) r
  where k.id = r.id;
  update public.event_sort_goalkeeper k set queue_order = 1
  where k.event_id = v_e and k.person_id = v_gk_home;
  update public.event_sort_goalkeeper k set queue_order = 2
  where k.event_id = v_e and k.person_id = v_gk_spare;
  perform public.start_event_match(v_e);
  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_sort_goalkeeper k
      where k.event_id = v_e and k.person_id = v_gk_home and k.team_id = v_home
    ),
    'pre: goleiro home ligado ao Time');
  perform private.event_sort_rebalance_goalkeepers(v_e);
  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_sort_goalkeeper k
      where k.event_id = v_e and k.person_id = v_gk_home and k.team_id = v_home
    )
    and exists (
      select 1 from public.event_sort_goalkeeper k
      where k.event_id = v_e and k.team_id = v_away
    ),
    'recálculo não mexe no goleiro ativo da Partida');

  -- finish_event com Partida aberta
  v := pg_temp.live('finE', 'WINNER_STAYS', 'BOTH_OUT', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  perform pg_temp.as_(v_owner);
  perform public.start_event_match(v_e);
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.finish_event(%L)', v_e)) = 'match_open',
    'finish_event com Partida aberta → match_open');
  perform pg_temp.assert_that(
    (select e.status from public.event e where e.id = v_e) = 'active',
    'match_open não encerra o Evento');

  -- Home: none / open / between nas duas list_*
  v := pg_temp.live('home', 'WINNER_STAYS', 'BOTH_OUT', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_r := (v ->> 'racha')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_home := (v #>> '{teams,0}')::uuid;
  v_scorer := (v #>> '{line,0}')::uuid;
  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    (select o.match_state from public.list_open_events(v_r) o where o.id = v_e) = 'between'
    and (select o.match_state from public.list_my_racha_events() o where o.id = v_e) = 'between'
    and (select o.match_home_score from public.list_open_events(v_r) o where o.id = v_e) is null
    and (select o.next_home_team_number from public.list_open_events(v_r) o where o.id = v_e)
      = (select t.team_number from public.event_sort_team t where t.id = v_home),
    'home between antes da primeira Partida');

  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'home-1', v_home, v_scorer, null, false);
  perform pg_temp.assert_that(
    (select o.match_state from public.list_open_events(v_r) o where o.id = v_e) = 'open'
    and (select o.match_state from public.list_my_racha_events() o where o.id = v_e) = 'open'
    and (select o.match_home_score from public.list_open_events(v_r) o where o.id = v_e) = 1
    and (select o.match_away_score from public.list_my_racha_events() o where o.id = v_e) = 0,
    'home open com placar da aberta');

  perform public.finish_event_match(v_match);
  perform pg_temp.assert_that(
    (select o.match_state from public.list_open_events(v_r) o where o.id = v_e) = 'between'
    and (select o.match_state from public.list_my_racha_events() o where o.id = v_e) = 'between'
    and (select o.match_home_score from public.list_open_events(v_r) o where o.id = v_e) = 1
    and (select o.match_away_score from public.list_open_events(v_r) o where o.id = v_e) = 0,
    'home between depois do apito com placar da última');

  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    v_r, current_date + 1, time '21:00', 'Quadra Live', 'upcoming', v_owner, 30,
    24, 3, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10
  ) returning id into v_none;
  perform pg_temp.assert_that(
    (select o.match_state from public.list_open_events(v_r) o where o.id = v_none) = 'none'
    and (select o.next_home_team_number from public.list_open_events(v_r) o where o.id = v_none) is null,
    'home none sem Sorteio confirmado');

  -- racha só com Evento sem Sorteio: list_my_racha_events também none
  v_owner := pg_temp.person('Dono Sem Sort', 'OUTFIELD');
  insert into public.racha (name, invite_code, place, spot_limit, outfield_per_team)
  values ('Prova Sem Sort', 'ZZNNEX', 'Quadra None', 20, 3)
  returning id into v_r;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_r, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);
  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    v_r, current_date, time '19:00', 'Quadra None', 'upcoming', v_owner, 20,
    24, 3, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10
  ) returning id into v_e;
  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    (select o.match_state from public.list_open_events(v_r) o where o.id = v_e) = 'none'
    and (select o.match_state from public.list_my_racha_events() o where o.id = v_e) = 'none',
    'home none nas duas list_* sem Sorteio');

  raise notice 'PASS: Saída, Inclusão, recálculo, finish_event match_open e home none/open/between';
end $$;

-- ============================================================
-- 5. Políticas do canal privado e touch na Saída/Inclusão
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_admin uuid;
  v_player uuid;
  v_inactive uuid;
  v_out uuid;
  v_p1 uuid;
  v_match uuid;
  v_seq bigint;
  v_seq2 bigint;
  v_seq3 bigint;
  v_j jsonb;
  v_new uuid;
  v_seen int;
  v_probe uuid;
begin
  v := pg_temp.live('rtz', 'WINNER_STAYS', 'BOTH_OUT', 3, 3);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;
  v_player := (v ->> 'player')::uuid;
  v_inactive := (v ->> 'inactive')::uuid;
  v_out := (v ->> 'out')::uuid;
  v_p1 := (v #>> '{line,0}')::uuid;

  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    realtime_policy.event_match_can_watch(v_e),
    'Membro ativo (Dono) can_watch');
  perform pg_temp.as_(v_player);
  perform pg_temp.assert_that(
    realtime_policy.event_match_can_watch(v_e),
    'Membro ativo (Jogador) can_watch');
  perform pg_temp.as_(v_inactive);
  perform pg_temp.assert_that(
    not realtime_policy.event_match_can_watch(v_e),
    'Membro inativo não can_watch');
  perform pg_temp.as_(v_out);
  perform pg_temp.assert_that(
    not realtime_policy.event_match_can_watch(v_e),
    'não Membro não can_watch');

  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    realtime_policy.event_match_can_track(v_e),
    'Condutor can_track');
  perform pg_temp.as_(v_player);
  perform pg_temp.assert_that(
    not realtime_policy.event_match_can_track(v_e),
    'Jogador não can_track');
  perform pg_temp.as_(v_admin);
  perform pg_temp.assert_that(
    not realtime_policy.event_match_can_track(v_e),
    'Admin que não conduz não can_track');

  perform set_config('realtime.topic', 'event:' || v_e::text, true);
  perform pg_temp.assert_that(
    realtime_policy.event_match_realtime_event_id() is not distinct from v_e,
    'realtime.topic event:<id> parseia');
  perform set_config('realtime.topic', 'room-1', true);
  perform pg_temp.assert_that(
    realtime_policy.event_match_realtime_event_id() is null,
    'tópico sem event:<uuid> não parseia');

  perform pg_temp.assert_that(
    exists (
      select 1 from pg_policy p
      where p.polrelid = 'realtime.messages'::regclass
        and p.polname = 'event_match: membro assiste'
        and p.polcmd = 'r'
    )
    and exists (
      select 1 from pg_policy p
      where p.polrelid = 'realtime.messages'::regclass
        and p.polname = 'event_match: condutor publica presence'
        and p.polcmd = 'a'
    )
    and (select relrowsecurity from pg_class where oid = 'realtime.messages'::regclass),
    'policies de SELECT/INSERT existem e RLS já estava ligada');

  -- Probe na tabela: o GUC realtime.topic é o que a policy lê.
  insert into realtime.messages (topic, extension, payload, event, private)
  values ('event:' || v_e::text, 'broadcast', '{}'::jsonb, 'match_changed', true)
  returning id into v_probe;

  perform set_config('realtime.topic', 'event:' || v_e::text, true);
  perform set_config('request.jwt.claim.sub', v_player::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_player, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) into v_seen from realtime.messages where id = v_probe;
  execute 'reset role';
  perform pg_temp.assert_that(v_seen = 1, 'Jogador SELECT broadcast no tópico');

  perform set_config('request.jwt.claim.sub', v_out::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_out, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) into v_seen from realtime.messages where id = v_probe;
  execute 'reset role';
  perform pg_temp.assert_that(v_seen = 0, 'não Membro não vê broadcast');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  perform set_config('realtime.topic', 'event:' || v_e::text, true);
  execute 'set local role authenticated';
  insert into realtime.messages (topic, extension, payload, event, private)
  values ('event:' || v_e::text, 'presence', '{}'::jsonb, 'presence', true);
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', v_player::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_player, 'role', 'authenticated')::text,
    true
  );
  perform set_config('realtime.topic', 'event:' || v_e::text, true);
  execute 'set local role authenticated';
  begin
    insert into realtime.messages (topic, extension, payload, event, private)
    values ('event:' || v_e::text, 'presence', '{}'::jsonb, 'presence', true);
    execute 'reset role';
    raise exception 'FAIL: Jogador INSERT presence deveria ser recusado';
  exception
    when insufficient_privilege then
      execute 'reset role';
  end;

  -- Saída/Inclusão com Partida aberta sobem seq (touch)
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  select m.seq into v_seq from public.event_match m where m.id = v_match;
  perform private.event_sort_close_player(v_e, v_p1, null);
  select m.seq into v_seq2 from public.event_match m where m.id = v_match;
  perform pg_temp.assert_that(v_seq2 > v_seq, 'Saída com Partida aberta sobe seq');

  v_new := pg_temp.person('Novo Rtz Abc', 'OUTFIELD');
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values ((v ->> 'racha')::uuid, v_new, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  perform private.event_sort_place_player(v_e, v_new, null, 'OUTFIELD', 3::smallint, false, 'ANY', null);
  select m.seq into v_seq3 from public.event_match m where m.id = v_match;
  perform pg_temp.assert_that(v_seq3 > v_seq2, 'Inclusão com Partida aberta sobe seq');

  raise notice 'PASS: políticas realtime, can_watch/can_track e touch na Saída/Inclusão';
end $$;

rollback;
