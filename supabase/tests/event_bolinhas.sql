-- Bolinhas, etapa 1: esquema, regra de par, RPC de sorteio e leitura dos Times.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/event_bolinhas.sql
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

create function pg_temp.draw(p_event uuid, p_giver uuid, p_receiver uuid) returns jsonb
language sql as $$ select public.draw_event_bolinhas(p_event, p_giver, p_receiver) $$;

create function pg_temp.draw_err(p_event uuid, p_giver uuid, p_receiver uuid) returns text
language sql as $$
  select pg_temp.err(format('select public.draw_event_bolinhas(%L, %L, %L)', p_event, p_giver, p_receiver))
$$;

-- ============================================================
-- 1. Esquema
-- ============================================================
do $$
begin
  perform pg_temp.assert_that(
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('event_bolinhas', 'event_bolinhas_ball')
       and c.relrowsecurity) = 2
    and not has_table_privilege('authenticated', 'public.event_bolinhas', 'select')
    and not has_table_privilege('anon', 'public.event_bolinhas_ball', 'select'),
    'RLS ligada e sem acesso direto');
  perform pg_temp.assert_that(
    not has_function_privilege('authenticated', 'private.event_bolinhas_can_pair(uuid,uuid,uuid)', 'execute')
    and not has_function_privilege('anon', 'public.draw_event_bolinhas(uuid,uuid,uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.draw_event_bolinhas(uuid,uuid,uuid)', 'execute'),
    'grants das funções');
end $$;

-- ============================================================
-- 2. Cenário do dia (5/5, 5/5, 4/5, 4/5, 3/5): Time 5 cede para o Time 4
-- ============================================================
do $$
declare
  v jsonb := pg_temp.scene('b1', array[5, 5, 4, 4, 3]);
  v_e uuid := (v ->> 'event')::uuid;
  v_t4 uuid := (v #>> '{teams,3}')::uuid;
  v_t5 uuid := (v #>> '{teams,4}')::uuid;
  v_r jsonb;
  v_blue jsonb;
  v_moved uuid;
begin
  perform pg_temp.as_((v ->> 'owner')::uuid);
  perform pg_temp.assert_that(
    private.event_sort_published_json(v_e) ->> 'bolinhas_availability' = 'ok'
    and private.event_sort_published_json(v_e) -> 'last_bolinhas' = 'null'::jsonb,
    'antes: ok e last_bolinhas nulo');

  v_r := pg_temp.draw(v_e, v_t5, v_t4);
  select jsonb_agg(x) into v_blue from jsonb_array_elements(v_r -> 'order') x where x ->> 'color' = 'blue';
  v_moved := (v_blue -> 0 ->> 'person_id')::uuid;
  perform pg_temp.assert_that(
    jsonb_array_length(v_r -> 'order') = 3 and jsonb_array_length(v_blue) = 1
    and (v_r ->> 'all_move')::boolean = false
    and pg_temp.outfield_n(v_t4) = 5 and pg_temp.outfield_n(v_t5) = 2
    and exists (select 1 from public.event_sort_team_player p
                where p.team_id = v_t4 and p.person_id = v_moved and p.left_at is null),
    'cenário do dia: 1 azul vai para o Time 4, Time 5 fica com 2');
  -- 10. ordem com nomes e cores e published atualizado
  perform pg_temp.assert_that(
    (select bool_and(x ->> 'display_name' is not null and x ->> 'color' in ('blue', 'red'))
     from jsonb_array_elements(v_r -> 'order') x)
    and v_r -> 'published' ->> 'state' = 'published'
    and v_r #>> '{published,last_bolinhas,giver_team_number}' = '5'
    and v_r #>> '{published,last_bolinhas,receiver_team_number}' = '4'
    and jsonb_array_length(v_r #> '{published,last_bolinhas,moved}') = 1
    and v_r #>> '{published,last_bolinhas,moved,0,person_id}' = v_moved::text
    and v_r #>> '{published,last_bolinhas,moved,0,from_team_number}' = '5',
    'RPC devolve ordem com nomes/cores e published com last_bolinhas');
  perform pg_temp.assert_that(
    (select p.stars_snapshot from public.event_sort_team_player p
     where p.team_id = v_t4 and p.person_id = v_moved and p.left_at is null) = 3
    and (select count(*) from public.event_sort_team_player p where p.person_id = v_moved and p.left_at is null) = 1,
    'snapshot copiado e uma linha ativa só');
  -- 9. Inclusão depois da Bolinhas: Time 5 (2/5) é o incompleto mais atrás
  perform pg_temp.assert_that(
    private.event_sort_arrival_destination(v_e) ->> 'team_id' = v_t5::text,
    'Inclusão considera o elenco novo');
  perform public.include_event_sort_member(v_e, (v #>> '{extras,0}')::uuid);
  perform pg_temp.assert_that(pg_temp.outfield_n(v_t5) = 3, 'incluído entra no Time 5');
end $$;

-- ============================================================
-- 3. Distribuição: 600 rodadas, cada jogador do Time 5 azul entre 140 e 260 vezes,
--    e a azul sai do saco em qualquer posição (1ª, 2ª ou 3ª), não sempre primeiro
-- ============================================================
do $$
declare
  v jsonb := pg_temp.scene('b2', array[5, 5, 4, 4, 3]);
  v_e uuid := (v ->> 'event')::uuid;
  v_t4 uuid := (v #>> '{teams,3}')::uuid;
  v_t5 uuid := (v #>> '{teams,4}')::uuid;
  v_ids uuid[] := array(select jsonb_array_elements_text(v #> '{line,4}')::uuid);
  v_counts integer[] := array[0, 0, 0];
  v_positions integer[] := array[0, 0, 0];
  v_pos integer;
  v_who uuid;
  v_i integer;
begin
  perform pg_temp.as_((v ->> 'owner')::uuid);
  for v_i in 1..600 loop
    begin
      select (x ->> 'person_id')::uuid, n::integer into v_who, v_pos
      from jsonb_array_elements(pg_temp.draw(v_e, v_t5, v_t4) -> 'order') with ordinality as o(x, n)
      where x ->> 'color' = 'blue';
      v_counts[array_position(v_ids, v_who)] := v_counts[array_position(v_ids, v_who)] + 1;
      v_positions[v_pos] := v_positions[v_pos] + 1;
      raise exception 'desfaz';
    exception when raise_exception then
      if sqlerrm <> 'desfaz' then raise; end if;
    end;
  end loop;
  perform pg_temp.assert_that(
    v_counts[1] between 140 and 260 and v_counts[2] between 140 and 260
    and v_counts[3] between 140 and 260 and v_counts[1] + v_counts[2] + v_counts[3] = 600,
    'distribuição viciada: ' || v_counts::text);
  perform pg_temp.assert_that(
    v_positions[1] between 140 and 260 and v_positions[2] between 140 and 260
    and v_positions[3] between 140 and 260,
    'azul presa numa posição do saco: ' || v_positions::text);
end $$;

-- ============================================================
-- 4. Todos vão e iguais
-- ============================================================
do $$
declare
  v jsonb := pg_temp.scene('b3', array[5, 5, 4, 2, 3]);
  v_e uuid := (v ->> 'event')::uuid;
  v_t3 uuid := (v #>> '{teams,2}')::uuid;
  v_t4 uuid := (v #>> '{teams,3}')::uuid;
  v_t5 uuid := (v #>> '{teams,4}')::uuid;
  v_r jsonb;
begin
  perform pg_temp.as_((v ->> 'owner')::uuid);
  -- Time 4 (2) cede para Time 5 (3 vagas): todos vão
  v_r := pg_temp.draw(v_e, v_t4, v_t5);
  perform pg_temp.assert_that(
    (v_r ->> 'all_move')::boolean
    and (select bool_and(x ->> 'color' = 'blue') from jsonb_array_elements(v_r -> 'order') x)
    and pg_temp.outfield_n(v_t4) = 0 and pg_temp.outfield_n(v_t5) = 5
    and (select queue_order from public.event_sort_team where id = v_t4) is null
    and (select queue_order from public.event_sort_team where id = v_t5) = 4
    and (select queue_order from public.event_sort_team where id = v_t3) = 3,
    'todos vão (2 para 3 vagas): fila compacta');

  v := pg_temp.scene('b3b', array[5, 5, 4, 2, 3]);
  v_e := (v ->> 'event')::uuid;
  v_t3 := (v #>> '{teams,2}')::uuid;
  v_t4 := (v #>> '{teams,3}')::uuid;
  v_t5 := (v #>> '{teams,4}')::uuid;
  perform pg_temp.as_((v ->> 'owner')::uuid);
  -- Time 4 (2) cede para Time 3 (4/5, 1 vaga)? não: 2 jogadores, 1 vaga -> sorteio. Iguais: Time 5 (3) -> Time 4? 3 vagas.
  -- iguais: Time 4 (2) ao Time 5 (3/5 = 2 vagas)
  v_r := pg_temp.draw(v_e, v_t4, v_t5);
  perform pg_temp.assert_that(
    (v_r ->> 'all_move')::boolean and pg_temp.outfield_n(v_t5) = 5 and pg_temp.outfield_n(v_t4) = 0
    and (select queue_order from public.event_sort_team where id = v_t4) is null,
    'iguais (2 para 2 vagas): todos vão e quem cedeu sai da fila');
end $$;

-- ============================================================
-- 5. Times em campo com Partida aberta
-- ============================================================
do $$
declare
  v jsonb := pg_temp.scene('b4', array[4, 4, 3, 5, 5]);
  v_e uuid := (v ->> 'event')::uuid;
  v_t1 uuid := (v #>> '{teams,0}')::uuid;
  v_t2 uuid := (v #>> '{teams,1}')::uuid;
  v_t3 uuid := (v #>> '{teams,2}')::uuid;
  v_t4 uuid := (v #>> '{teams,3}')::uuid;
begin
  perform pg_temp.as_((v ->> 'owner')::uuid);
  -- sem Partida: Time 1 cede para Time 2 (1 vaga), Time 3 recebe do Time 1
  perform pg_temp.assert_that(
    private.event_bolinhas_can_pair(v_e, v_t1, v_t3)
    and private.event_bolinhas_can_pair(v_e, v_t4, v_t2),
    'sem Partida os Times 1 e 2 podem ceder e receber');
  perform public.start_event_match(v_e);
  perform pg_temp.assert_that(
    pg_temp.draw_err(v_e, v_t1, v_t3) = 'invalid_pair'
    and pg_temp.draw_err(v_e, v_t4, v_t2) = 'invalid_pair'
    and pg_temp.draw_err(v_e, v_t2, v_t3) = 'invalid_pair'
    and pg_temp.draw_err(v_e, v_t4, v_t1) = 'invalid_pair',
    'com Partida aberta os Times 1 e 2 são recusados');
  perform pg_temp.assert_that(pg_temp.outfield_n(v_t3) = 3, 'nada mudou');
end $$;

-- ============================================================
-- 6. Recusas
-- ============================================================
do $$
declare
  v jsonb := pg_temp.scene('b5', array[5, 5, 4, 3, 2]);
  v_e uuid := (v ->> 'event')::uuid;
  v_t1 uuid := (v #>> '{teams,0}')::uuid;
  v_t3 uuid := (v #>> '{teams,2}')::uuid;
  v_t4 uuid := (v #>> '{teams,3}')::uuid;
  v_t5 uuid := (v #>> '{teams,4}')::uuid;
begin
  perform pg_temp.as_((v ->> 'admin')::uuid);
  perform pg_temp.assert_that(pg_temp.draw_err(v_e, v_t5, v_t4) = 'not_conductor', 'não Condutor');
  perform pg_temp.as_((v ->> 'owner')::uuid);
  perform pg_temp.assert_that(pg_temp.draw_err(v_e, v_t4, v_t4) = 'invalid_pair', 'mesmo Time');
  perform pg_temp.assert_that(pg_temp.draw_err(v_e, v_t5, v_t1) = 'invalid_pair', 'receptor sem vaga');
  perform pg_temp.assert_that(pg_temp.draw_err(v_e, gen_random_uuid(), v_t4) = 'invalid_pair', 'Time inexistente');
  update public.event_sort_team set queue_order = null where id = v_t5;
  perform pg_temp.assert_that(pg_temp.draw_err(v_e, v_t5, v_t4) = 'invalid_pair', 'Time fora da fila');
  update public.event_sort_team set queue_order = 5 where id = v_t5;
  update public.event_sort_team_player set left_at = now() where team_id = v_t5 and left_at is null;
  perform pg_temp.assert_that(pg_temp.draw_err(v_e, v_t5, v_t4) = 'invalid_pair', 'quem cede sem jogador');
  update public.event_sort_team_player set left_at = null where team_id = v_t5;
  update public.event set status = 'finished', ended_at = now(), ended_by = conductor_id where id = v_e;
  perform pg_temp.assert_that(pg_temp.draw_err(v_e, v_t5, v_t4) <> 'ok', 'Evento fora de active');
  update public.event set status = 'active', ended_at = null, ended_by = null where id = v_e;
  perform pg_temp.assert_that(pg_temp.draw_err(v_e, v_t5, v_t4) = 'ok', 'controle: par válido passa');
end $$;

-- ============================================================
-- 7. Goleiro fora do saco
-- ============================================================
do $$
declare
  v jsonb := pg_temp.scene('b6', array[5, 5, 4, 3]);
  v_e uuid := (v ->> 'event')::uuid;
  v_t3 uuid := (v #>> '{teams,2}')::uuid;
  v_t4 uuid := (v #>> '{teams,3}')::uuid;
  v_gk uuid[] := array(select jsonb_array_elements_text(v -> 'gk')::uuid);
  v_r jsonb;
begin
  perform pg_temp.as_((v ->> 'owner')::uuid);
  v_r := pg_temp.draw(v_e, v_t4, v_t3);
  perform pg_temp.assert_that(
    not exists (select 1 from jsonb_array_elements(v_r -> 'order') x where (x ->> 'person_id')::uuid = any (v_gk))
    and (select count(*) from public.event_sort_team_player p
         where p.person_id = any (v_gk)) = 0,
    'goleiro fora das bolinhas e do elenco de linha');
end $$;

-- ============================================================
-- 8. Disponibilidade
-- ============================================================
do $$
declare
  v jsonb := pg_temp.scene('b7', array[5, 5, 5, 5]);
  v_e uuid := (v ->> 'event')::uuid;
  v_t1 uuid := (v #>> '{teams,0}')::uuid;
  v_t2 uuid := (v #>> '{teams,1}')::uuid;
  v_t3 uuid := (v #>> '{teams,2}')::uuid;
  v_t4 uuid := (v #>> '{teams,3}')::uuid;
begin
  perform pg_temp.as_((v ->> 'owner')::uuid);
  perform pg_temp.assert_that(private.event_bolinhas_availability(v_e) = 'no_receiver',
    'todos completos: no_receiver');
  -- Time 3 incompleto, Time 4 com gente: ok
  update public.event_sort_team_player set left_at = now()
  where id = (select id from public.event_sort_team_player where team_id = v_t3 and left_at is null limit 1);
  perform pg_temp.assert_that(private.event_bolinhas_availability(v_e) = 'ok'
    and private.event_sort_published_json(v_e) ->> 'bolinhas_availability' = 'ok', 'incompleto + gente: ok');
  perform public.start_event_match(v_e);
  perform pg_temp.assert_that(private.event_bolinhas_availability(v_e) = 'ok', 'em campo completos, fila ok');
  -- Time 3 recebe, mas quem tem gente (Times 1 e 2) está em campo
  update public.event_sort_team set queue_order = null where id = v_t4;
  perform pg_temp.assert_that(private.event_bolinhas_availability(v_e) = 'no_giver',
    'quem poderia ceder está em campo: no_giver');
end $$;

-- ============================================================
-- 9. last_bolinhas some depois de nova Partida
-- ============================================================
do $$
declare
  v jsonb := pg_temp.scene('b8', array[5, 5, 4, 3]);
  v_e uuid := (v ->> 'event')::uuid;
  v_t3 uuid := (v #>> '{teams,2}')::uuid;
  v_t4 uuid := (v #>> '{teams,3}')::uuid;
  v_m uuid;
begin
  perform pg_temp.as_((v ->> 'owner')::uuid);
  perform pg_temp.draw(v_e, v_t4, v_t3);
  perform pg_temp.assert_that(
    private.event_sort_published_json(v_e) -> 'last_bolinhas' <> 'null'::jsonb, 'aparece depois da Bolinhas');
  -- now() é fixo na transação: a Partida nova precisa ser posterior de fato
  update public.event_bolinhas set created_at = clock_timestamp() - interval '1 minute' where event_id = v_e;
  v_m := (public.start_event_match(v_e) #>> '{match,id}')::uuid;
  update public.event_match set started_at = clock_timestamp() where id = v_m;
  perform pg_temp.assert_that(
    private.event_sort_published_json(v_e) -> 'last_bolinhas' = 'null'::jsonb,
    'some depois que a Partida começa');
end $$;

rollback;
