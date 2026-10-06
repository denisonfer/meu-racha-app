-- Amarelo configurável: modo, minutos, checks, cópia no Evento e gol sofrido.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/yellow_card_mode.sql
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

create function pg_temp.outfield_n(p_team uuid) returns integer
language sql as $$
  select count(*)::integer
  from public.event_sort_team_player p
  where p.team_id = p_team and p.left_at is null
$$;

create function pg_temp.events_of(p jsonb, p_kind text) returns jsonb
language sql as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p -> 'events', '[]'::jsonb)) x
  where x ->> 'kind' = p_kind
$$;

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

create function pg_temp.card_of(p jsonb, p_color text) returns jsonb
language sql as $$
  select x
  from jsonb_array_elements(coalesce(p #> '{match,cards}', '[]'::jsonb)) x
  where x ->> 'color' = p_color
  limit 1
$$;


-- ============================================================
-- 1. Racha novo: timed, 2; create_racha aceita e grava modo e minutos
-- ============================================================
do $$
declare
  v_u uuid := pg_temp.person('Dono Cria', 'OUTFIELD');
  v_id uuid;
  v_r public.racha;
begin
  perform pg_temp.as_(v_u);
  select c.id into v_id from public.create_racha(
    'Prova Amarelo A', 5::smallint, 'WINNER_STAYS', 2::smallint, 'BOTH_OUT',
    'TEAM_ORDER', false, 'Quadra', 10::smallint, null
  ) c;
  select * into v_r from public.racha r where r.id = v_id;
  perform pg_temp.assert_that(
    v_r.yellow_card_mode = 'timed' and v_r.yellow_out_min = 2,
    'caso 1: Racha novo nasce timed, 2');
  perform pg_temp.assert_that(
    has_column_privilege('authenticated', 'public.racha', 'yellow_card_mode', 'update')
    and has_column_privilege('authenticated', 'public.racha', 'yellow_out_min', 'update'),
    'grant update nas duas colunas');

  -- outro Dono cria já em mark, 7 min (sem Duração)
  v_u := pg_temp.person('Dono Cria B', 'OUTFIELD');
  perform pg_temp.as_(v_u);
  select c.id into v_id from public.create_racha(
    'Prova Amarelo B', 5::smallint, 'WINNER_STAYS', 2::smallint, 'BOTH_OUT',
    'TEAM_ORDER', false, 'Quadra', null, null, 'mark', 7::smallint
  ) c;
  select * into v_r from public.racha r where r.id = v_id;
  perform pg_temp.assert_that(
    v_r.yellow_card_mode = 'mark' and v_r.yellow_out_min = 7,
    'create_racha grava modo e minutos');
  raise notice 'PASS: caso 1';
end $$;

-- ============================================================
-- 3, 4 e 5. Minutos guardados; check menor que a Duração; sem Duração
-- ============================================================
do $$
declare
  v_id uuid;
  v_msg text;
begin
  insert into public.racha (name, invite_code, place, match_duration_min, yellow_out_min)
  values ('Prova Amarelo C', 'ZZYQAA', 'Quadra', 10, 7)
  returning id into v_id;

  update public.racha set yellow_card_mode = 'mark' where id = v_id;
  update public.racha set yellow_card_mode = 'timed' where id = v_id;
  perform pg_temp.assert_that(
    (select yellow_out_min from public.racha where id = v_id) = 7,
    'caso 3: religar Minutos fora devolve o 7');

  v_msg := pg_temp.err(format('update public.racha set yellow_out_min = 10 where id = %L', v_id));
  perform pg_temp.assert_that(position('racha_yellow_shorter_than_match' in v_msg) > 0,
    'caso 4: 10 e 10 recusado');
  v_msg := pg_temp.err(format('update public.racha set yellow_out_min = 12 where id = %L', v_id));
  perform pg_temp.assert_that(position('racha_yellow_shorter_than_match' in v_msg) > 0,
    'caso 4: 12 e 10 recusado');
  v_msg := pg_temp.err(format('update public.racha set match_duration_min = 7 where id = %L', v_id));
  perform pg_temp.assert_that(position('racha_yellow_shorter_than_match' in v_msg) > 0,
    'caso 4: Duração igual ao amarelo recusada');
  v_msg := pg_temp.err(format('update public.racha set yellow_out_min = 9 where id = %L', v_id));
  perform pg_temp.assert_that(v_msg = 'ok', 'caso 4: 9 e 10 grava');

  update public.racha set yellow_card_mode = 'mark', yellow_out_min = 30 where id = v_id;
  perform pg_temp.assert_that(
    pg_temp.err(format('update public.racha set match_duration_min = 5 where id = %L', v_id)) = 'ok',
    'em mark a trava não vale');
  v_msg := pg_temp.err(format('update public.racha set yellow_card_mode = ''timed'' where id = %L', v_id));
  perform pg_temp.assert_that(position('racha_yellow_shorter_than_match' in v_msg) > 0,
    'voltar a timed com minutos >= Duração recusa');

  update public.racha set match_duration_min = null, yellow_card_mode = 'timed' where id = v_id;
  perform pg_temp.assert_that(
    pg_temp.err(format('update public.racha set yellow_out_min = 10 where id = %L', v_id)) = 'ok',
    'caso 5: sem Duração, 10 min grava');

  perform pg_temp.assert_that(
    position('yellow_out_min' in pg_temp.err(format('update public.racha set yellow_out_min = 0 where id = %L', v_id))) > 0
    and position('yellow_out_min' in pg_temp.err(format('update public.racha set yellow_out_min = 91 where id = %L', v_id))) > 0,
    'faixa 1 a 90');

  -- o mesmo check vale no Evento
  v_msg := pg_temp.err(format($f$
    insert into public.event (
      racha_id, starts_on, starts_at, place, reminder_lead_hours, outfield_per_team,
      game_mode, max_consecutive_wins, tie_rule, tie_return_order, consider_position,
      match_duration_min, yellow_out_min
    ) values (%L, current_date + 3, time '19:00', 'Quadra', 24, 5,
      'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10, 10)$f$, v_id));
  perform pg_temp.assert_that(position('event_yellow_shorter_than_match' in v_msg) > 0,
    'check composto no Evento: ' || v_msg);
  raise notice 'PASS: casos 3, 4 e 5';
end $$;

-- ============================================================
-- 6. Evento active: o Racha não muda o motor do amarelo
-- ============================================================
do $$
declare
  v jsonb;
  v_racha uuid;
begin
  v := pg_temp.scene('guard', array[5, 5]);
  v_racha := (v ->> 'racha')::uuid;
  perform pg_temp.assert_that(
    pg_temp.err(format('update public.racha set yellow_card_mode = ''mark'' where id = %L', v_racha)) = 'event_active',
    'caso 6: modo trava com Evento active');
  perform pg_temp.assert_that(
    pg_temp.err(format('update public.racha set yellow_out_min = 5 where id = %L', v_racha)) = 'event_active',
    'caso 6: minutos travam com Evento active');
  perform pg_temp.assert_that(
    (select e.yellow_card_mode from public.event e where e.id = (v ->> 'event')::uuid) = 'timed',
    'caso 6: Evento segue timed');
  raise notice 'PASS: caso 6';
end $$;

-- ============================================================
-- 2. Advertência: gol no goleiro de amarelo grava o goleiro; segundo amarelo vira vermelho
-- 7. Retrato e gol com 5 min falam 5
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_gk uuid;
  v_player uuid;
  v_t2 uuid;
  v_scorer uuid;
  v_match uuid;
  v_j jsonb;
  v_sec integer;
begin
  v := pg_temp.scene('mark', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  update public.event set yellow_card_mode = 'mark' where id = v_e;
  v_gk := (v #>> '{gk,0}')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_scorer := (v #>> '{line,1,0}')::uuid;
  perform pg_temp.as_((v ->> 'owner')::uuid);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform pg_temp.assert_that(
    v_j ->> 'yellow_card_mode' = 'mark' and (v_j ->> 'yellow_out_min')::int = 2,
    'retrato expõe modo e minutos do Evento');

  perform public.add_event_match_card(v_match, v_gk, null, 'yellow');
  perform public.add_event_match_goal(v_match, 'm1', v_t2, v_scorer, null, false);
  perform pg_temp.assert_that(exists (
    select 1 from public.event_match_goal g
    where g.match_id = v_match and g.request_key = 'm1' and g.conceded_profile_id = v_gk
  ), 'caso 2: em mark o gol sofrido grava o goleiro de amarelo');

  perform public.add_event_match_card(v_match, v_player, null, 'yellow');
  v_j := public.add_event_match_card(v_match, v_player, null, 'yellow');
  perform pg_temp.assert_that(
    (pg_temp.card_of(v_j, 'red') ->> 'red_reason') = 'second_yellow',
    'caso 2: segundo amarelo vira vermelho em mark');
  raise notice 'PASS: caso 2';
end $$;

do $$
declare
  v jsonb;
  v_e uuid;
  v_gk uuid;
  v_t2 uuid;
  v_scorer uuid;
  v_match uuid;
  v_j jsonb;
  v_card_sec integer;
  v_now integer;
begin
  v := pg_temp.scene('five', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  update public.event set yellow_out_min = 5 where id = v_e;
  v_gk := (v #>> '{gk,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_scorer := (v #>> '{line,1,0}')::uuid;
  perform pg_temp.as_((v ->> 'owner')::uuid);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform pg_temp.assert_that(
    v_j ->> 'yellow_card_mode' = 'timed' and (v_j ->> 'yellow_out_min')::int = 5,
    'caso 7: retrato fala 5, não 2');

  perform public.add_event_match_card(v_match, v_gk, null, 'yellow');
  v_card_sec := (
    select c.match_second from public.event_match_card c
    where c.match_id = v_match and c.profile_id = v_gk and c.color = 'yellow'
  );
  -- 3 min depois: passou dos 2 do padrão, mas não dos 5 do Evento
  v_now := private.event_match_second(v_match);
  update public.event_match m
  set started_at = m.started_at - make_interval(secs => (v_card_sec + 180 - v_now))
  where m.id = v_match;
  perform public.add_event_match_goal(v_match, 'f1', v_t2, v_scorer, null, false);
  perform pg_temp.assert_that(exists (
    select 1 from public.event_match_goal g
    where g.match_id = v_match and g.request_key = 'f1' and g.conceded_profile_id is null
  ), 'caso 7: aos 3 min o amarelo de 5 min ainda corre');

  v_now := private.event_match_second(v_match);
  update public.event_match m
  set started_at = m.started_at - make_interval(secs => (v_card_sec + 301 - v_now))
  where m.id = v_match;
  perform public.add_event_match_goal(v_match, 'f2', v_t2, v_scorer, null, false);
  perform pg_temp.assert_that(exists (
    select 1 from public.event_match_goal g
    where g.match_id = v_match and g.request_key = 'f2' and g.conceded_profile_id = v_gk
  ), 'depois dos 5 min o gol volta a gravar o goleiro');
  raise notice 'PASS: caso 7';
end $$;

-- ============================================================
-- 8. Recorrente em Advertência: o próximo Evento nasce em Advertência
-- 1. create_event copia modo e minutos do Racha
-- ============================================================
do $$
declare
  v_owner uuid := pg_temp.person('Dono Recorrente', 'OUTFIELD');
  v_racha uuid;
  v_ev uuid;
  v_next uuid;
  v_e public.event;
begin
  insert into public.racha (
    name, invite_code, place, weekday, kickoff_time, yellow_card_mode, yellow_out_min
  ) values ('Prova Amarelo R', 'ZZYQRR', 'Quadra', 1, time '19:00', 'mark', 7)
  returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);

  perform pg_temp.as_(v_owner);
  v_ev := public.create_event(
    v_racha, current_date + 10, time '19:00', 'Quadra', false, null, null, null);
  select * into v_e from public.event e where e.id = v_ev;
  perform pg_temp.assert_that(
    v_e.yellow_card_mode = 'mark' and v_e.yellow_out_min = 7,
    'caso 2: create_event copia modo e minutos');

  -- mudar o Racha depois não mexe no Evento já criado
  update public.racha set yellow_card_mode = 'timed', yellow_out_min = 3 where id = v_racha;
  perform pg_temp.assert_that(
    (select e.yellow_card_mode from public.event e where e.id = v_ev) = 'mark',
    'Evento criado não acompanha o Racha');

  delete from public.event where id = v_ev;
  update public.racha set yellow_card_mode = 'mark', yellow_out_min = 6 where id = v_racha;
  v_next := private.create_next_recurring_event(
    v_racha, null, current_date, time '19:00', now());
  select * into v_e from public.event e where e.id = v_next;
  perform pg_temp.assert_that(
    v_e.yellow_card_mode = 'mark' and v_e.yellow_out_min = 6,
    'caso 8: recorrente nasce em Advertência com os minutos');
  raise notice 'PASS: caso 8';
end $$;

rollback;
