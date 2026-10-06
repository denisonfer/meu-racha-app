-- Cartões, etapa 1: esquema, RPCs e leitura.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/event_match_card.sql
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
-- 1. Esquema, RLS e grants
-- ============================================================
do $$
declare
  v_colors text[];
  v_reasons text[];
begin
  select array_agg(e.enumlabel order by e.enumsortorder) into v_colors
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'event_match_card_color';
  select array_agg(e.enumlabel order by e.enumsortorder) into v_reasons
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'event_match_card_red_reason';
  perform pg_temp.assert_that(
    v_colors = array['yellow', 'red']::text[]
    and v_reasons = array['direct', 'second_yellow']::text[],
    'enums de cor e motivo do vermelho');

  perform pg_temp.assert_that(exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'event_match_lineup'
      and column_name = 'left_by_red' and is_nullable = 'NO'
      and column_default = 'false'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'event_match_card'
      and column_name = 'person_id' and is_generated = 'ALWAYS'
  ), 'left_by_red no elenco; person_id gerado no cartão');

  perform pg_temp.assert_that(exists (
    select 1 from pg_constraint
    where conname = 'event_match_card_red_reason_shape'
  ), 'amarelo sem motivo; vermelho com motivo');

  perform pg_temp.assert_that(
    (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'event_match_card')
    and (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'event_match_card') = 0
    and not has_table_privilege('anon', 'public.event_match_card', 'select')
    and not has_table_privilege('authenticated', 'public.event_match_card', 'select'),
    'cartão: RLS ligada, sem política, revoke');

  perform pg_temp.assert_that(
    (select p.prosecdef and p.proconfig @> array['search_path=""']
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'add_event_match_card')
    and has_function_privilege('authenticated',
      'public.add_event_match_card(uuid, uuid, uuid, public.event_match_card_color)', 'execute')
    and not has_function_privilege('anon',
      'public.add_event_match_card(uuid, uuid, uuid, public.event_match_card_color)', 'execute')
    and has_function_privilege('authenticated',
      'public.delete_event_match_card(uuid)', 'execute')
    and not has_function_privilege('anon',
      'public.delete_event_match_card(uuid)', 'execute')
    and not has_function_privilege('authenticated',
      'private.event_match_second(uuid)', 'execute')
    and not has_function_privilege('anon',
      'private.event_match_second(uuid)', 'execute'),
    'RPCs públicas autenticadas; relógio privado');

  raise notice 'PASS: esquema, RLS, grants';
end $$;

-- ============================================================
-- 2. Relógio, amarelo, segundo amarelo, apagar o vermelho
-- now() não anda dentro desta transação: o avanço é started_at/paused_at.
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_player uuid;
  v_t1 uuid;
  v_match uuid;
  v_j jsonb;
  v_sec integer;
  v_frozen integer;
  v_yellow uuid;
  v_red uuid;
begin
  v := pg_temp.scene('clock', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;

  update public.event_match m
  set started_at = now() - interval '40 seconds'
  where m.id = v_match;

  v_j := public.add_event_match_card(v_match, v_player, null, 'yellow');
  v_sec := (pg_temp.card_of(v_j, 'yellow') ->> 'match_second')::integer;
  perform pg_temp.assert_that(
    v_sec = 40
    and v_sec = private.event_match_second(v_match)
    and (pg_temp.card_of(v_j, 'yellow') ->> 'red_reason') is null
    and (pg_temp.card_of(v_j, 'yellow') ->> 'is_goalkeeper')::boolean is not true
    and (pg_temp.card_of(v_j, 'yellow') ->> 'team_id') = v_t1::text
    and exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_player and l.left_at is null
    ),
    'caso 1–2: amarelo no segundo do relógio e elenco aberto');

  update public.event_match m
  set started_at = m.started_at - interval '2 seconds'
  where m.id = v_match;
  perform pg_temp.assert_that(
    private.event_match_second(v_match) = 42,
    'caso 1: relógio correndo avança com o início');

  perform public.pause_event_match(v_match);
  v_frozen := private.event_match_second(v_match);
  update public.event_match m
  set started_at = m.started_at - interval '1 second',
      paused_at = m.paused_at - interval '1 second'
  where m.id = v_match;
  perform pg_temp.assert_that(
    v_frozen = 42 and private.event_match_second(v_match) = v_frozen,
    'caso 1: pausa segura o segundo de jogo');

  v_j := public.add_event_match_card(v_match, v_player, null, 'yellow');
  v_yellow := (pg_temp.card_of(v_j, 'yellow') ->> 'id')::uuid;
  v_red := (pg_temp.card_of(v_j, 'red') ->> 'id')::uuid;
  perform pg_temp.assert_that(
    (select count(*) from public.event_match_card c
     where c.match_id = v_match and c.color = 'yellow') = 1
    and v_yellow is not null
    and (pg_temp.card_of(v_j, 'red') ->> 'red_reason') = 'second_yellow'
    and (pg_temp.card_of(v_j, 'red') ->> 'is_goalkeeper')::boolean is not true
    and exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_player
        and l.left_at is not null and l.left_by_red
    )
    and jsonb_array_length(pg_temp.events_of(v_j, 'leave')) = 0
    and jsonb_array_length(v_j -> 'pending_reinforcements') = 0,
    'caso 3: segundo amarelo vira vermelho, o primeiro fica, elenco fecha');

  v_j := public.delete_event_match_card(v_red);
  perform pg_temp.assert_that(
    not exists (select 1 from public.event_match_card c where c.id = v_red)
    and exists (
      select 1 from public.event_match_card c
      where c.id = v_yellow and c.color = 'yellow' and c.red_reason is null
    )
    and exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_player
        and l.left_at is null and not l.left_by_red
    )
    and (pg_temp.card_of(v_j, 'yellow') ->> 'id') = v_yellow::text
    and pg_temp.card_of(v_j, 'red') is null,
    'caso 4: apagar o vermelho reabre o elenco e o amarelo continua');

  raise notice 'PASS: relógio, amarelo, segundo amarelo, apagar';
end $$;

-- ============================================================
-- 3. Vermelho direto, Time do Evento e contagem do Elenco
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_player uuid;
  v_other uuid;
  v_t1 uuid;
  v_match uuid;
  v_j jsonb;
  v_before integer;
begin
  v := pg_temp.scene('direct', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_other := (v #>> '{line,0,1}')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_before := pg_temp.outfield_n(v_t1);
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;

  v_j := public.add_event_match_card(v_match, v_other, null, 'yellow');
  v_j := public.add_event_match_card(v_match, v_player, null, 'red');
  perform pg_temp.assert_that(
    (pg_temp.card_of(v_j, 'red') ->> 'red_reason') = 'direct'
    and exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_player
        and l.left_by_red and l.left_at is not null
    )
    and jsonb_array_length(pg_temp.events_of(v_j, 'leave')) = 0
    and exists (
      select 1 from jsonb_array_elements(pg_temp.events_of(v_j, 'card')) x
      where x ->> 'color' = 'red' and x ->> 'red_reason' = 'direct'
        and (x ->> 'is_goalkeeper')::boolean is not true
    )
    and v_j -> 'pending_reinforcements' = '[]'::jsonb
    and exists (
      select 1 from public.event_sort_team_player p
      where p.team_id = v_t1 and p.profile_id = v_player and p.left_at is null
    )
    and exists (
      select 1 from public.event_attendance ea
      where ea.event_id = v_e and ea.profile_id = v_player and ea.status = 'confirmed'
    )
    and pg_temp.outfield_n(v_t1) = v_before
    and (v_j #>> '{match,home,outfield_count}')::integer = v_before
    and (v_j #>> '{match,home,is_complete}')::boolean
    and jsonb_array_length(v_j #> '{match,home,lineup}') = 4,
    'caso 5 e 13: vermelho direto não é Saída, Time e is_complete ficam');

  raise notice 'PASS: vermelho direto, elenco do Evento';
end $$;

-- ============================================================
-- 4. Goleiro de amarelo: gol sofrido nulo e, depois de 120 s, de volta
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_gk uuid;
  v_t2 uuid;
  v_scorer uuid;
  v_match uuid;
  v_j jsonb;
  v_card_sec integer;
  v_now integer;
begin
  v := pg_temp.scene('gk-yellow', array[5, 5]);
  v_owner := (v ->> 'owner')::uuid;
  v_gk := (v #>> '{gk,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_scorer := (v #>> '{line,1,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match((v ->> 'event')::uuid);
  v_match := (v_j #>> '{match,id}')::uuid;

  v_j := public.add_event_match_card(v_match, v_gk, null, 'yellow');
  perform pg_temp.assert_that(
    (pg_temp.card_of(v_j, 'yellow') ->> 'is_goalkeeper')::boolean,
    'amarelo do goleiro marca is_goalkeeper');

  perform public.add_event_match_goal(v_match, 'y-run', v_t2, v_scorer, null, false);
  perform pg_temp.assert_that(exists (
    select 1 from public.event_match_goal g
    where g.match_id = v_match and g.request_key = 'y-run'
      and g.conceded_profile_id is null and g.conceded_guest_id is null
  ), 'caso 6: amarelo correndo deixa o gol sem goleiro');

  v_card_sec := (
    select c.match_second from public.event_match_card c
    where c.match_id = v_match and c.profile_id = v_gk and c.color = 'yellow'
  );
  v_now := private.event_match_second(v_match);
  update public.event_match m
  set started_at = m.started_at - make_interval(secs => (v_card_sec + 121 - v_now))
  where m.id = v_match;
  perform pg_temp.assert_that(
    private.event_match_second(v_match) > v_card_sec + 120,
    'caso 6: relógio passou dos 120 s do amarelo');

  perform public.add_event_match_goal(v_match, 'y-done', v_t2, v_scorer, null, false);
  perform pg_temp.assert_that(exists (
    select 1 from public.event_match_goal g
    where g.match_id = v_match and g.request_key = 'y-done'
      and g.conceded_profile_id = v_gk
  ), 'caso 6: depois do amarelo o gol volta a gravar o goleiro');

  raise notice 'PASS: goleiro de amarelo';
end $$;

-- ============================================================
-- 5. Goleiro expulso: gols seguintes sem goleiro
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_gk uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_scorer uuid;
  v_match uuid;
  v_j jsonb;
begin
  v := pg_temp.scene('gk-red', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_gk := (v #>> '{gk,0}')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_scorer := (v #>> '{line,1,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;

  v_j := public.add_event_match_card(v_match, v_gk, null, 'red');
  perform public.add_event_match_goal(v_match, 'r1', v_t2, v_scorer, null, false);
  perform public.add_event_match_goal(v_match, 'r2', v_t2, v_scorer, null, false);
  perform pg_temp.assert_that(
    (pg_temp.card_of(v_j, 'red') ->> 'red_reason') = 'direct'
    and (pg_temp.card_of(v_j, 'red') ->> 'is_goalkeeper')::boolean
    and not exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_gk and l.left_at is null
    )
    and (select count(*) from public.event_match_goal g
         where g.match_id = v_match and g.conceded_profile_id is null
           and g.conceded_guest_id is null) = 2
    and exists (
      select 1 from public.event_sort_goalkeeper k
      where k.event_id = v_e and k.profile_id = v_gk and k.team_id = v_t1
    ),
    'caso 7: goleiro expulso, gols sem sofrido, segue no Time');

  raise notice 'PASS: goleiro expulso';
end $$;

-- ============================================================
-- 6. Apito: amarelo ativo, expulso já tinha saído
-- now() é estável: o left_at do vermelho é recuado 1 s, com entered_at,
-- para o apito ficar depois — em produção o relógio de parede faz isso.
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_yellow uuid;
  v_red uuid;
  v_match uuid;
  v_ended timestamptz;
begin
  v := pg_temp.scene('whistle', array[5, 5]);
  v_owner := (v ->> 'owner')::uuid;
  v_yellow := (v #>> '{line,0,0}')::uuid;
  v_red := (v #>> '{line,0,1}')::uuid;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match((v ->> 'event')::uuid) #>> '{match,id}')::uuid;
  perform public.add_event_match_card(v_match, v_yellow, null, 'yellow');
  perform public.add_event_match_card(v_match, v_red, null, 'red');

  update public.event_match_lineup l
  set entered_at = now() - interval '2 seconds',
      left_at = now() - interval '1 second'
  where l.match_id = v_match and l.profile_id = v_red and l.left_by_red;

  perform public.finish_event_match(v_match);
  select m.ended_at into v_ended from public.event_match m where m.id = v_match;
  perform pg_temp.assert_that(
    (select l.left_at = v_ended and not l.left_by_red
     from public.event_match_lineup l
     where l.match_id = v_match and l.profile_id = v_yellow)
    and (select l.left_at < v_ended and l.left_by_red
         from public.event_match_lineup l
         where l.match_id = v_match and l.profile_id = v_red),
    'caso 8: amarelo no apito; expulso saiu antes');

  raise notice 'PASS: encerrar com amarelo e expulso';
end $$;

-- ============================================================
-- 7. Descarte apaga cartão; encerrada recusa apagar
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_player uuid;
  v_match uuid;
  v_card uuid;
  v_msg text;
begin
  v := pg_temp.scene('discard', array[5, 5]);
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match((v ->> 'event')::uuid) #>> '{match,id}')::uuid;
  perform public.add_event_match_card(v_match, v_player, null, 'yellow');
  perform public.discard_event_match(v_match);
  perform pg_temp.assert_that(
    (select m.status::text from public.event_match m where m.id = v_match) = 'discarded'
    and not exists (select 1 from public.event_match_card c where c.match_id = v_match),
    'caso 9: descartar apaga os cartões');

  v := pg_temp.scene('locked', array[5, 5]);
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match((v ->> 'event')::uuid) #>> '{match,id}')::uuid;
  v_card := (
    select (public.add_event_match_card(v_match, v_player, null, 'red') #>> '{match,cards,0,id}')::uuid
  );
  perform public.finish_event_match(v_match);
  v_msg := pg_temp.err(format('select public.delete_event_match_card(%L)', v_card));
  perform pg_temp.assert_that(
    v_msg = 'match_locked'
    and exists (select 1 from public.event_match_card c where c.id = v_card),
    'caso 10: Partida encerrada recusa apagar');

  raise notice 'PASS: descarte e Partida encerrada';
end $$;

-- ============================================================
-- 8. Recusas e quem assiste vê o mesmo cartão
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_admin uuid;
  v_player uuid;
  v_match uuid;
  v_j jsonb;
  v_seen jsonb;
  v_msg text;
begin
  v := pg_temp.scene('refusals', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;

  perform pg_temp.as_(v_admin);
  v_msg := pg_temp.err(format(
    'select public.add_event_match_card(%L, %L, null, ''yellow'')', v_match, v_player));
  perform pg_temp.assert_that(v_msg = 'not_conductor', 'caso 11: não-condutor não registra');
  v_msg := pg_temp.err(format(
    'select public.delete_event_match_card(%L)', gen_random_uuid()));
  perform pg_temp.assert_that(v_msg = 'not_allowed', 'cartão inexistente');

  perform pg_temp.as_(v_owner);
  v_msg := pg_temp.err(format(
    'select public.add_event_match_card(%L, null, null, ''yellow'')', v_match));
  perform pg_temp.assert_that(v_msg = 'not_allowed', 'sem pessoa');
  v_msg := pg_temp.err(format(
    'select public.add_event_match_card(%L, %L, %L, ''yellow'')',
    v_match, v_player, (v #>> '{line,0,1}')::uuid));
  perform pg_temp.assert_that(v_msg = 'not_allowed', 'profile e guest juntos');
  v_msg := pg_temp.err(format(
    'select public.add_event_match_card(%L, %L, null, ''yellow'')',
    v_match, (v #>> '{extras,0}')::uuid));
  perform pg_temp.assert_that(v_msg = 'not_on_field', 'caso 11: fora de campo');

  v_j := public.add_event_match_card(v_match, v_player, null, 'red');
  v_msg := pg_temp.err(format(
    'select public.add_event_match_card(%L, %L, null, ''yellow'')', v_match, v_player));
  perform pg_temp.assert_that(v_msg = 'not_on_field', 'caso 11: já expulso');

  perform pg_temp.as_(v_admin);
  v_seen := public.get_event_match(v_e);
  perform pg_temp.assert_that(
    v_seen #> '{match,cards}' = v_j #> '{match,cards}'
    and pg_temp.events_of(v_seen, 'card') = pg_temp.events_of(v_j, 'card')
    and jsonb_array_length(pg_temp.events_of(v_seen, 'card')) = 1
    and (v_seen #>> '{viewer,can_conduct}')::boolean is not true,
    'caso 12: outro membro vê os mesmos cartões e o lance');

  raise notice 'PASS: recusas e leitura de quem assiste';
end $$;

-- ============================================================
-- 9. Apagar vermelho de goleiro depois de Trocar goleiro falha
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_gk uuid;
  v_t1 uuid;
  v_match uuid;
  v_card uuid;
  v_msg text;
begin
  v := pg_temp.scene('gk-swap', array[5, 5], 5, 0);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_gk := (v #>> '{gk,0}')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  v_card := (
    select (public.add_event_match_card(v_match, v_gk, null, 'red') #>> '{match,cards,0,id}')::uuid
  );
  insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id)
  values (v_e, 1, (v ->> 'extra_gk')::uuid);
  perform public.swap_event_match_goalkeeper(v_match, v_t1, (v ->> 'extra_gk')::uuid);
  v_msg := pg_temp.err(format('select public.delete_event_match_card(%L)', v_card));
  perform pg_temp.assert_that(
    position('event_match_lineup_one_goalkeeper' in v_msg) > 0
    and exists (select 1 from public.event_match_card c where c.id = v_card)
    and exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_gk
        and l.left_at is not null and l.left_by_red
    ),
    'reabrir goleiro com outro no gol falha e não apaga o cartão');

  raise notice 'PASS: goleiro reaberto contra a unique';
end $$;

rollback;
