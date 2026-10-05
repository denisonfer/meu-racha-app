-- Reforço e entrada em campo, etapa 1: esquema, RPCs e leitura.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/event_match_reinforcement.sql
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

-- ============================================================
-- 1. Esquema
-- ============================================================
do $$
declare
  v_labels text[];
begin
  select array_agg(e.enumlabel order by e.enumsortorder) into v_labels
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'event_match_lineup_entry_kind';
  perform pg_temp.assert_that(
    v_labels = array['start', 'reinforcement', 'inclusion', 'return', 'goalkeeper']::text[],
    'enum entry_kind na ordem combinada');

  perform pg_temp.assert_that(exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'event_match_lineup'
      and column_name = 'entry_kind'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'event_match_lineup'
      and column_name = 'left_by_self'
  ), 'elenco ganha entry_kind e left_by_self');

  perform pg_temp.assert_that(
    (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'event_match_reinforcement')
    and (select count(*) from pg_policies
         where schemaname = 'public' and tablename = 'event_match_reinforcement') = 0
    and not has_table_privilege('anon', 'public.event_match_reinforcement', 'select')
    and not has_table_privilege('authenticated', 'public.event_match_reinforcement', 'select'),
    'reforço: RLS ligada, sem política, revoke');

  perform pg_temp.assert_that(exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'event_match_reinforcement'
      and indexdef ilike '%left_profile_id%' and indexdef ilike '%unique%'
  ) and exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'event_match_reinforcement'
      and indexdef ilike '%left_guest_id%' and indexdef ilike '%unique%'
  ), 'único por Partida e pessoa que saiu (dois índices parciais)');

  perform pg_temp.assert_that(
    (select p.prosecdef and p.proconfig @> array['search_path=""']
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'reinforce_event_match')
    and has_function_privilege('authenticated',
      'public.reinforce_event_match(uuid, uuid, uuid, uuid)', 'execute')
    and not has_function_privilege('anon',
      'public.reinforce_event_match(uuid, uuid, uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated',
      'private.event_sort_arrival_destination(uuid)', 'execute'),
    'RPC pública autenticada; destino privado');

  raise notice 'PASS: esquema, RLS, grants';
end $$;

-- ============================================================
-- 2. Reforço de Time completo, doador unitário, sorteio, fila vazia
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_player uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_t3 uuid;
  v_t4 uuid;
  v_lucas uuid;
  v_match uuid;
  v_j jsonb;
  v_msg text;
  v_from uuid;
  v_entered uuid;
  v_reinf jsonb;
  v_leave jsonb;
  v_before jsonb;
begin
  v := pg_temp.scene('one', array[5, 5, 5, 3]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  v_t4 := (v #>> '{teams,3}')::uuid;
  v_lucas := (v #>> '{line,1,0}')::uuid;

  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform pg_temp.assert_that(
    (v_j #>> '{match,home,outfield_count}')::integer = 5
    and (v_j #>> '{match,home,capacity}')::integer = 5
    and jsonb_array_length(v_j #> '{match,home,lineup}') = 5
    and jsonb_array_length(v_j -> 'reinforcement_donors') = 2
    and v_j #>> '{reinforcement_donors,0,team_id}' = v_t3::text
    and (v_j #>> '{reinforcement_donors,0,queue_position}')::integer = 1
    and (v_j #>> '{reinforcement_donors,0,outfield_count}')::integer = 5
    and (v_j #>> '{reinforcement_donors,1,outfield_count}')::integer = 3
    and (select l.entry_kind::text from public.event_match_lineup l
         where l.match_id = v_match and l.role = 'OUTFIELD' limit 1) = 'start',
    'Iniciar: elenco start, doadores T3 e T4, contagem por lado');

  -- caso 1: Lucas sai de T2, Condutor escolhe T3
  v_j := public.reinforce_event_match(v_match, v_lucas, null, v_t3);
  v_reinf := pg_temp.events_of(v_j, 'reinforcement') -> 0;
  v_leave := pg_temp.events_of(v_j, 'leave') -> 0;
  v_entered := (v_reinf #>> '{entered,person_id}')::uuid;
  v_from := (v_reinf ->> 'from_team_id')::uuid;
  perform pg_temp.assert_that(
    pg_temp.outfield_n(v_t2) = 5
    and pg_temp.outfield_n(v_t3) = 4
    and (select t.queue_order from public.event_sort_team t where t.id = v_t3) = 3
    and v_from = v_t3
    and (v_reinf ->> 'to_team_id') = v_t2::text
    and (v_reinf ->> 'team_drawn')::boolean is not true
    and v_reinf #>> '{left,person_id}' = v_lucas::text
    and v_entered in (
      select p.profile_id from public.event_sort_team_player p
      where p.team_id = v_t3 or (p.team_id = v_t2 and p.profile_id = v_entered)
    )
    and exists (
      select 1 from public.event_sort_team_player p
      where p.team_id = v_t2 and p.profile_id = v_entered and p.left_at is null
    )
    and v_j #>> '{events,0,kind}' = 'reinforcement'
    and (v_leave ->> 'by_self')::boolean is not true
    and (v_leave ->> 'reinforced')::boolean
    and (v_leave ->> 'outfield_count')::integer = 4
    and (v_leave ->> 'capacity')::integer = 5
    and (select l.entry_kind::text from public.event_match_lineup l
         where l.match_id = v_match and l.profile_id = v_entered and l.left_at is null)
        = 'reinforcement',
    'caso 1: T2 volta a 5, T3 fica 4 na fila, lance de Reforço identificável');

  -- already_reinforced
  v_msg := pg_temp.err(format(
    'select public.reinforce_event_match(%L, %L, null, %L)', v_match, v_lucas, v_t3));
  perform pg_temp.assert_that(v_msg = 'already_reinforced', 'Reforço repetido');

  -- not_on_field: extra nunca esteve em campo
  v_msg := pg_temp.err(format(
    'select public.reinforce_event_match(%L, %L, null, %L)',
    v_match, (v #>> '{extras,0}')::uuid, v_t4));
  perform pg_temp.assert_that(v_msg = 'not_on_field', 'quem nunca esteve em campo');

  -- goleiro como quem saiu
  v_msg := pg_temp.err(format(
    'select public.reinforce_event_match(%L, %L, null, %L)',
    v_match, (v #>> '{gk,0}')::uuid, v_t4));
  perform pg_temp.assert_that(v_msg = 'not_on_field', 'goleiro não é pessoa que saiu');

  -- Time em campo como doador
  v_msg := pg_temp.err(format(
    'select public.reinforce_event_match(%L, %L, null, %L)',
    v_match, (v #>> '{line,0,1}')::uuid, v_t1));
  perform pg_temp.assert_that(v_msg = 'invalid_donor', 'Time em campo não cede');

  -- não Condutor
  perform pg_temp.as_(v_player);
  v_msg := pg_temp.err(format(
    'select public.reinforce_event_match(%L, %L, null, %L)',
    v_match, (v #>> '{line,0,1}')::uuid, v_t4));
  perform pg_temp.assert_that(v_msg = 'not_conductor', 'Jogador não chama Reforço');

  -- caso 2: doador com 1 jogador (cena nova)
  v := pg_temp.scene('two', array[5, 5, 5, 1]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_t4 := (v #>> '{teams,3}')::uuid;
  v_lucas := (v #>> '{line,1,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  v_j := public.reinforce_event_match(v_match, v_lucas, null, v_t4);
  perform pg_temp.assert_that(
    pg_temp.outfield_n(v_t2) = 5
    and pg_temp.outfield_n(v_t4) = 0
    and (select t.queue_order from public.event_sort_team t where t.id = v_t4) is null
    and (select t.queue_order from public.event_sort_team t
         where t.id = (v #>> '{teams,2}')::uuid) = 3
    and jsonb_array_length(v_j -> 'reinforcement_donors') = 1,
    'caso 2: doador com 1 sai da fila e a fila compacta');

  -- caso 3: sortear o Time
  v := pg_temp.scene('draw', array[5, 5, 5, 3]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  v_t4 := (v #>> '{teams,3}')::uuid;
  v_lucas := (v #>> '{line,1,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  v_j := public.reinforce_event_match(v_match, v_lucas, null, null);
  v_from := (pg_temp.events_of(v_j, 'reinforcement') -> 0 ->> 'from_team_id')::uuid;
  perform pg_temp.assert_that(
    v_from in (v_t3, v_t4)
    and v_from not in (v_t1, v_t2)
    and (pg_temp.events_of(v_j, 'reinforcement') -> 0 ->> 'team_drawn')::boolean
    and (pg_temp.events_of(v_j, 'reinforcement') -> 0 ->> 'to_team_id') = v_t2::text,
    'caso 3: sorteio escolhe T3 ou T4, nunca o adversário');

  -- caso 4: fila vazia
  v := pg_temp.scene('empty', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_lucas := (v #>> '{line,1,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  v_before := jsonb_build_object(
    't2', pg_temp.outfield_n((v #>> '{teams,1}')::uuid),
    'active', (select count(*) from public.event_match_lineup l
               where l.match_id = v_match and l.left_at is null)
  );
  v_msg := pg_temp.err(format(
    'select public.reinforce_event_match(%L, %L, null, null)', v_match, v_lucas));
  perform pg_temp.assert_that(
    v_msg = 'no_donor'
    and pg_temp.outfield_n((v #>> '{teams,1}')::uuid) = (v_before ->> 't2')::integer
    and (select count(*) from public.event_match_lineup l
         where l.match_id = v_match and l.left_at is null)
        = (v_before ->> 'active')::integer,
    'caso 4: sem doador recusa e não registra Saída');

  raise notice 'PASS: Reforço casos 1–4, erros de doador/pessoa/condutor';
end $$;

-- ============================================================
-- 3. left_by_self, pending, pausa, leave_racha
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_admin uuid;
  v_lucas uuid;
  v_other uuid;
  v_t2 uuid;
  v_t3 uuid;
  v_match uuid;
  v_j jsonb;
  v_racha uuid;
begin
  v := pg_temp.scene('self', array[5, 5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v ->> 'admin')::uuid;
  v_racha := (v ->> 'racha')::uuid;
  v_lucas := (v #>> '{line,1,0}')::uuid;
  v_other := (v #>> '{line,1,1}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;

  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;

  -- Condutor só marca saída: não entra em pending
  perform public.leave_event_sort(v_e, v_other);
  v_j := public.get_event_match(v_e);
  perform pg_temp.assert_that(
    jsonb_array_length(coalesce(v_j -> 'pending_reinforcements', '[]'::jsonb)) = 0
    and (select l.left_by_self from public.event_match_lineup l
         where l.match_id = v_match and l.profile_id = v_other and l.left_at is not null)
        is not true,
    'caso 6: saída pelo Condutor não gera aviso R4');

  -- própria Saída
  perform pg_temp.as_(v_lucas);
  perform public.leave_event_sort(v_e, v_lucas);
  perform pg_temp.as_(v_owner);
  v_j := public.get_event_match(v_e);
  perform pg_temp.assert_that(
    jsonb_array_length(v_j -> 'pending_reinforcements') = 1
    and v_j #>> '{pending_reinforcements,0,person,person_id}' = v_lucas::text
    and (v_j #>> '{pending_reinforcements,0,team_id}') = v_t2::text
    and (select l.left_by_self from public.event_match_lineup l
         where l.match_id = v_match and l.profile_id = v_lucas and l.left_at is not null),
    'caso 6: saída própria entra em pending');

  v_j := public.reinforce_event_match(v_match, v_lucas, null, v_t3);
  perform pg_temp.assert_that(
    jsonb_array_length(v_j -> 'pending_reinforcements') = 0
    and exists (
      select 1 from jsonb_array_elements(pg_temp.events_of(v_j, 'leave')) x
      where x #>> '{person,person_id}' = v_lucas::text
        and (x ->> 'by_self')::boolean
    ),
    'depois do Reforço o aviso some');

  -- pausada: sucesso, status continua open
  v := pg_temp.scene('pause', array[5, 5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_lucas := (v #>> '{line,1,0}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform public.pause_event_match(v_match);
  v_j := public.reinforce_event_match(v_match, v_lucas, null, v_t3);
  perform pg_temp.assert_that(
    v_j ->> 'state' = 'open'
    and v_j #>> '{match,status}' = 'open'
    and v_j #>> '{match,paused_at}' is not null
    and jsonb_array_length(pg_temp.events_of(v_j, 'reinforcement')) = 1,
    'Partida pausada: Reforço sucede e status continua open');

  -- caso 7: leave_racha em campo
  v := pg_temp.scene('quit', array[5, 5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_racha := (v ->> 'racha')::uuid;
  v_lucas := (v #>> '{line,1,0}')::uuid;
  perform pg_temp.as_(v_owner);
  perform public.start_event_match(v_e);
  perform pg_temp.as_(v_lucas);
  perform public.leave_racha(v_racha);
  perform pg_temp.as_(v_owner);
  v_j := public.get_event_match(v_e);
  perform pg_temp.assert_that(
    jsonb_array_length(v_j -> 'pending_reinforcements') = 1
    and v_j #>> '{pending_reinforcements,0,person,person_id}' = v_lucas::text,
    'caso 7: leave_racha em campo dispara pending');

  raise notice 'PASS: left_by_self, pending, pausa, leave_racha';
end $$;

-- ============================================================
-- 4. Destino previsto = aplicado (field, field_draw, queue, new_team)
--    Inclusão 4×4, Volta, Goleiro
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_player uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_t3 uuid;
  v_extra1 uuid;
  v_extra2 uuid;
  v_extra3 uuid;
  v_gk uuid;
  v_left uuid;
  v_dest jsonb;
  v_dest2 jsonb;
  v_team uuid;
  v_team2 uuid;
  v_pub jsonb;
  v_j jsonb;
  v_match uuid;
  v_msg text;
begin
  -- field_draw + field + new_team (4×4, capacidade 5, dois Times)
  v := pg_temp.scene('four', array[4, 4], 5);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_extra1 := (v #>> '{extras,0}')::uuid;
  v_extra2 := (v #>> '{extras,1}')::uuid;
  v_extra3 := (v #>> '{extras,2}')::uuid;
  v_gk := (v ->> 'extra_gk')::uuid;

  perform pg_temp.as_(v_owner);
  v_dest := private.event_sort_arrival_destination(v_e);
  perform pg_temp.assert_that(
    v_dest ->> 'kind' = 'new_team' or v_dest ->> 'kind' = 'queue',
    'sem Partida aberta e Times incompletos: fila (não field)');

  -- com os dois incompletos na fila e sem Partida: queue no de maior queue_order
  perform pg_temp.assert_that(
    v_dest ->> 'kind' = 'queue' and (v_dest ->> 'team_id') = v_t2::text,
    'sem Partida: incompleto mais atrás');

  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  v_dest := private.event_sort_arrival_destination(v_e);
  v_pub := private.event_sort_published_json(v_e);
  perform pg_temp.assert_that(
    v_dest ->> 'kind' = 'field_draw'
    and v_dest ->> 'team_id' is null
    and v_j -> 'next_arrival' ->> 'kind' = 'field_draw'
    and v_pub -> 'next_arrival' ->> 'kind' = 'field_draw',
    'caso 8/11: 4×4 prevê field_draw na Partida e nos Times');

  perform public.include_event_sort_member(v_e, v_extra1);
  select p.team_id into v_team from public.event_sort_team_player p
  where p.person_id = v_extra1 and p.left_at is null;
  perform pg_temp.assert_that(
    v_team in (v_t1, v_t2)
    and (select l.entry_kind::text from public.event_match_lineup l
         where l.match_id = v_match and l.profile_id = v_extra1) = 'inclusion'
    and exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_extra1
        and l.role = 'OUTFIELD' and l.left_at is null
    ),
    'primeiro atrasado entra num dos dois em campo');

  v_dest2 := private.event_sort_arrival_destination(v_e);
  perform pg_temp.assert_that(
    v_dest2 ->> 'kind' = 'field'
    and (v_dest2 ->> 'team_id') <> v_team::text
    and (v_dest2 ->> 'team_id') in (v_t1::text, v_t2::text),
    'depois do primeiro, destino é o outro Time em campo');

  perform public.include_event_sort_member(v_e, v_extra2);
  select p.team_id into v_team2 from public.event_sort_team_player p
  where p.person_id = v_extra2 and p.left_at is null;
  perform pg_temp.assert_that(v_team2 = (v_dest2 ->> 'team_id')::uuid,
    'segundo atrasado cai no destino previsto');

  v_dest := private.event_sort_arrival_destination(v_e);
  perform pg_temp.assert_that(
    v_dest ->> 'kind' = 'new_team' and (v_dest ->> 'team_number')::integer = 3
    and v_dest ->> 'team_id' is null,
    'terceiro vai para Time novo');

  perform public.include_event_sort_member(v_e, v_extra3);
  perform pg_temp.assert_that(
    (select t.team_number from public.event_sort_team_player p
     join public.event_sort_team t on t.id = p.team_id
     where p.person_id = v_extra3 and p.left_at is null) = 3
    and not exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_extra3
    ),
    'terceiro cria Time 3 fora de campo, sem elenco da Partida');

  v_j := public.get_event_match(v_e);
  perform pg_temp.assert_that(
    jsonb_array_length(pg_temp.events_of(v_j, 'inclusion')) = 2
    and not exists (
      select 1 from jsonb_array_elements(v_j -> 'events') x
      where x #>> '{person,person_id}' = v_extra3::text
    ),
    'caso 14: lances de Inclusão em campo; Time fora de campo não entra');

  -- Goleiro na Inclusão
  v_pub := public.include_event_sort_member(v_e, v_gk);
  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_sort_goalkeeper k
      where k.event_id = v_e and k.person_id = v_gk
    )
    and not exists (
      select 1 from public.event_sort_team_player p
      where p.event_id = v_e and p.person_id = v_gk
    )
    and not exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_gk and l.role = 'OUTFIELD'
    ),
    'caso 10: Goleiro vai para a fila do gol, nunca para a linha');

  -- não Condutor: include / return
  perform pg_temp.as_(v_player);
  v_msg := pg_temp.err(format(
    'select public.include_event_sort_member(%L, %L)', v_e, (v #>> '{extras,0}')::uuid));
  perform pg_temp.assert_that(v_msg in ('not_conductor', 'already_participating', 'not_member'),
    'Jogador não inclui (ou o extra já entrou)');
  -- extra1 já foi incluído; usa um membro qualquer fora. extra todos usados.
  -- return de alguém que não saiu:
  v_msg := pg_temp.err(format(
    'select public.return_event_sort_player(%L, %L)', v_e, v_player));
  perform pg_temp.assert_that(v_msg = 'not_conductor', 'caso 13: Jogador não faz Volta');

  -- queue: T3 incompleto, campo cheio
  v := pg_temp.scene('queue', array[5, 5, 3]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  v_extra1 := (v #>> '{extras,0}')::uuid;
  perform pg_temp.as_(v_owner);
  perform public.start_event_match(v_e);
  v_dest := private.event_sort_arrival_destination(v_e);
  perform pg_temp.assert_that(
    v_dest ->> 'kind' = 'queue' and (v_dest ->> 'team_id') = v_t3::text,
    'campo cheio: destino é o incompleto da fila');
  perform public.include_event_sort_member(v_e, v_extra1);
  perform pg_temp.assert_that(
    (select p.team_id from public.event_sort_team_player p
     where p.person_id = v_extra1 and p.left_at is null) = v_t3,
    'Inclusão aplica o queue previsto');

  -- new_team com 3 Times completos
  v := pg_temp.scene('newt', array[5, 5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_extra1 := (v #>> '{extras,0}')::uuid;
  perform pg_temp.as_(v_owner);
  perform public.start_event_match(v_e);
  v_dest := private.event_sort_arrival_destination(v_e);
  perform pg_temp.assert_that(
    v_dest ->> 'kind' = 'new_team' and (v_dest ->> 'team_number')::integer = 4,
    'todos completos: new_team 4');
  perform public.include_event_sort_member(v_e, v_extra1);
  perform pg_temp.assert_that(
    (select t.team_number from public.event_sort_team_player p
     join public.event_sort_team t on t.id = p.team_id
     where p.person_id = v_extra1 and p.left_at is null) = 4,
    'Inclusão cria o Time 4');

  -- queue: com dois incompletos esperando, vai para o mais atrás
  v := pg_temp.scene('last', array[5, 5, 3, 2]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t3 := (v #>> '{teams,3}')::uuid;
  v_extra1 := (v #>> '{extras,0}')::uuid;
  perform pg_temp.as_(v_owner);
  perform public.start_event_match(v_e);
  v_dest := private.event_sort_arrival_destination(v_e);
  perform pg_temp.assert_that(
    v_dest ->> 'kind' = 'queue' and (v_dest ->> 'team_id') = v_t3::text,
    'T3 3/5 e T4 2/5 esperando: destino é o T4, o mais atrás');
  perform public.include_event_sort_member(v_e, v_extra1);
  perform pg_temp.assert_that(
    (select p.team_id from public.event_sort_team_player p
     where p.person_id = v_extra1 and p.left_at is null) = v_t3,
    'Inclusão aplica o incompleto mais atrás');

  -- com Time esperando, o Time em campo desfalcado não recebe quem chega
  v := pg_temp.scene('field', array[5, 5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_left := (v #>> '{line,1,0}')::uuid;
  v_extra1 := (v #>> '{extras,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform public.leave_event_sort(v_e, v_left);
  v_dest := private.event_sort_arrival_destination(v_e);
  perform pg_temp.assert_that(
    v_dest ->> 'kind' = 'new_team' and (v_dest ->> 'team_number')::integer = 4,
    'T2 desfalcado com T3 esperando: destino é Time novo, não o campo');
  perform public.include_event_sort_member(v_e, v_extra1);
  perform pg_temp.assert_that(
    (select t.team_number from public.event_sort_team_player p
     join public.event_sort_team t on t.id = p.team_id
     where p.person_id = v_extra1 and p.left_at is null) = 4
    and not exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_extra1
    ),
    'Inclusão cria o Time 4, fora de campo');

  -- caso 10: sem Time esperando, Volta entra no Time em campo com menos, não no antigo
  v := pg_temp.scene('retn', array[5, 5]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_left := (v #>> '{line,0,0}')::uuid; -- T1
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform public.leave_event_sort(v_e, v_left);
  perform public.leave_event_sort(v_e, (v #>> '{line,1,0}')::uuid);
  perform public.leave_event_sort(v_e, (v #>> '{line,1,1}')::uuid);
  v_dest := private.event_sort_arrival_destination(v_e);
  perform pg_temp.assert_that(
    v_dest ->> 'kind' = 'field' and (v_dest ->> 'team_id') = v_t2::text,
    'Volta: campo desfalcado tem prioridade sobre o Time antigo');
  perform public.return_event_sort_player(v_e, v_left);
  perform pg_temp.assert_that(
    (select p.team_id from public.event_sort_team_player p
     where p.person_id = v_left and p.left_at is null) = v_t2
    and (select l.entry_kind::text from public.event_match_lineup l
         where l.match_id = v_match and l.profile_id = v_left and l.left_at is null)
        = 'return',
    'caso 9: Volta entra em T2, com entry_kind return');

  v_j := public.get_event_match(v_e);
  perform pg_temp.assert_that(
    jsonb_array_length(pg_temp.events_of(v_j, 'return')) = 1
    and pg_temp.events_of(v_j, 'return') -> 0 #>> '{person,person_id}' = v_left::text,
    'Volta em campo aparece em events');

  raise notice 'PASS: destino previsto=aplicado, Inclusão 4×4, Volta, Goleiro';
end $$;

-- ============================================================
-- 5. Descarte depois de Reforço + Time criado + Time esvaziado
--    Quem assiste lê os mesmos events
-- ============================================================
do $$
declare
  v jsonb;
  v_e uuid;
  v_owner uuid;
  v_player uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_t3 uuid;
  v_t4 uuid;
  v_t5 uuid;
  v_lucas uuid;
  v_extra uuid;
  v_match uuid;
  v_j jsonb;
  v_score_home integer;
  v_q4 smallint;
  v_reinf_id uuid;
begin
  v := pg_temp.scene('disc', array[5, 5, 5, 1]);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_player := (v #>> '{line,0,0}')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  v_t2 := (v #>> '{teams,1}')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  v_t4 := (v #>> '{teams,3}')::uuid;
  v_lucas := (v #>> '{line,1,0}')::uuid;
  v_extra := (v #>> '{extras,0}')::uuid;

  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'k-ref', v_t1, v_player, null, false);
  v_j := public.reinforce_event_match(v_match, v_lucas, null, v_t4);
  v_reinf_id := (pg_temp.events_of(v_j, 'reinforcement') -> 0 ->> 'id')::uuid;
  perform pg_temp.assert_that(
    (select t.queue_order from public.event_sort_team t where t.id = v_t4) is null,
    'T4 esvaziado saiu da fila antes do descarte');

  -- Inclusão gera Time novo (campo cheio, T3 completo, T4 fora)
  perform public.include_event_sort_member(v_e, v_extra);
  select p.team_id into v_t5 from public.event_sort_team_player p
  where p.person_id = v_extra and p.left_at is null;
  perform pg_temp.assert_that(
    (select t.team_number from public.event_sort_team t where t.id = v_t5) = 5
    and (select t.queue_order from public.event_sort_team t where t.id = v_t5) = 4,
    'Inclusão criou Time 5 no fim da fila');

  -- quem assiste lê os mesmos lances
  perform pg_temp.as_(v_player);
  v_j := public.get_event_match(v_e);
  perform pg_temp.assert_that(
    (v_j #>> '{viewer,can_conduct}')::boolean is not true
    and jsonb_array_length(pg_temp.events_of(v_j, 'reinforcement')) = 1
    and jsonb_array_length(pg_temp.events_of(v_j, 'leave')) >= 1
    and jsonb_array_length(pg_temp.events_of(v_j, 'goal')) = 1
    and pg_temp.events_of(v_j, 'reinforcement') -> 0 ->> 'id' = v_reinf_id::text
    and not exists (
      select 1 from jsonb_array_elements(v_j -> 'events') x
      where (x ->> 'team_id') = v_t5::text
         or (x ->> 'to_team_id') = v_t5::text
    ),
    'caso 14: membro lê events; Time fora de campo não aparece');

  perform pg_temp.as_(v_owner);
  select count(*)::integer into v_score_home
  from public.event_match_goal g where g.match_id = v_match and g.team_id = v_t1;
  perform public.discard_event_match(v_match);
  v_j := public.get_event_match(v_e);
  select t.queue_order into v_q4 from public.event_sort_team t where t.id = v_t4;

  perform pg_temp.assert_that(
    v_j ->> 'state' = 'ready'
    and (select m.status::text from public.event_match m where m.id = v_match) = 'discarded'
    and (select t.queue_order from public.event_sort_team t where t.id = v_t1) = 1
    and (select t.queue_order from public.event_sort_team t where t.id = v_t2) = 2
    and (select t.queue_order from public.event_sort_team t where t.id = v_t3) = 3
    and v_q4 is null
    and (select t.queue_order from public.event_sort_team t where t.id = v_t5) = 4
    and exists (select 1 from public.event_match_reinforcement r where r.id = v_reinf_id)
    and exists (
      select 1 from public.event_sort_team_player p
      where p.profile_id = v_lucas and p.team_id = v_t2 and p.left_at is not null
    )
    and exists (
      select 1 from public.event_sort_team_player p
      where p.person_id = v_extra and p.team_id = v_t5 and p.left_at is null
    )
    and v_score_home = 1,
    'caso 12: fila/placar voltam; T4 vazio não volta; T5 permanece; Reforço e mudança ficam');

  -- swap de goleiro grava entry_kind goalkeeper
  v := pg_temp.scene('swap', array[5, 5], 5, 0);
  v_e := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v #>> '{teams,0}')::uuid;
  perform pg_temp.as_(v_owner);
  v_j := public.start_event_match(v_e);
  v_match := (v_j #>> '{match,id}')::uuid;
  insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id)
  values (v_e, 1, (v ->> 'extra_gk')::uuid);
  perform public.swap_event_match_goalkeeper(v_match, v_t1, (v ->> 'extra_gk')::uuid);
  perform pg_temp.assert_that(
    (select l.entry_kind::text from public.event_match_lineup l
     where l.match_id = v_match and l.profile_id = (v ->> 'extra_gk')::uuid
       and l.role = 'GOALKEEPER' and l.left_at is null) = 'goalkeeper',
    'Trocar goleiro grava entry_kind = goalkeeper');

  raise notice 'PASS: descarte, events de quem assiste, swap goleiro';
end $$;

rollback;
