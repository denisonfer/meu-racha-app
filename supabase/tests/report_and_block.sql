-- Denúncia, Bloqueio e filtro de nome.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/report_and_block.sql
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
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.person(p_name text, p_plays public.plays_as default 'OUTFIELD') returns uuid
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

-- Racha com Dono (Condutor), Ana, Bia e Caio no Time 1 e Davi, Edu e Fabio no
-- Time 2, um Goleiro em cada, Evento em andamento com Sorteio confirmado.
create function pg_temp.scene(p_code text) returns jsonb
language plpgsql as $$
declare
  v_owner uuid := pg_temp.person('Dono Cena');
  v_racha uuid;
  v_event uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_names text[] := array['Ana', 'Bia', 'Caio', 'Davi', 'Edu', 'Fabio'];
  v_ids uuid[] := '{}';
  v_pid uuid;
  v_gk uuid;
  v_i integer;
begin
  insert into public.racha (name, invite_code, place, spot_limit, outfield_per_team)
  values ('Racha Cena ' || p_code, p_code, 'Quadra', 50, 3)
  returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);

  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    v_racha, current_date, time '19:00', 'Quadra', 'active', v_owner, 50,
    24, 3, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10
  ) returning id into v_event;

  insert into public.event_sort (
    event_id, status, signature, version, leftover_ids, mode, goalkeepers_per_team,
    balance_score, balance_label, balance_diff, super_diff, capped_by_super,
    confirmed_at, confirmed_by
  ) values (
    v_event, 'confirmed', 'cena', 1, '{}', 'normal', true,
    80, 'Equilibrado', 0, 0, false, now(), v_owner
  );

  insert into public.event_sort_team (event_id, team_number, queue_order, win_streak)
  values (v_event, 1, 1, 0) returning id into v_t1;
  insert into public.event_sort_team (event_id, team_number, queue_order, win_streak)
  values (v_event, 2, 2, 0) returning id into v_t2;

  for v_i in 1..6 loop
    v_pid := pg_temp.person(v_names[v_i]);
    insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
    values (v_racha, v_pid, 'PLAYER', 'OUTFIELD', 'ANY', 3);
    insert into public.event_sort_team_player (
      event_id, team_id, profile_id, stars_snapshot, is_super_star_snapshot,
      primary_position_snapshot
    ) values (v_event, case when v_i <= 3 then v_t1 else v_t2 end, v_pid, 3, false, 'ANY');
    insert into public.event_attendance (event_id, profile_id, status, did_attend)
    values (v_event, v_pid, 'confirmed', true);
    v_ids := v_ids || v_pid;
  end loop;

  for v_i in 1..2 loop
    v_gk := pg_temp.person('Goleiro ' || chr(64 + v_i), 'GOALKEEPER');
    insert into public.member (racha_id, profile_id, role, plays_as)
    values (v_racha, v_gk, 'PLAYER', 'GOALKEEPER');
    insert into public.event_sort_goalkeeper (event_id, team_id, profile_id)
    values (v_event, case when v_i = 1 then v_t1 else v_t2 end, v_gk);
    insert into public.event_attendance (event_id, profile_id, status, did_attend)
    values (v_event, v_gk, 'confirmed', true);
  end loop;

  return jsonb_build_object(
    'owner', v_owner, 'racha', v_racha, 'event', v_event,
    't1', v_t1, 't2', v_t2, 'people', to_jsonb(v_ids)
  );
end $$;

create function pg_temp.member_blocked(p_racha uuid, p_id uuid) returns boolean
language sql as $$
  select m.is_blocked from public.list_racha_members(p_racha) m where m.profile_id = p_id
$$;

create function pg_temp.any_member_blocked(p_racha uuid) returns boolean
language sql as $$
  select bool_or(m.is_blocked) from public.list_racha_members(p_racha) m
$$;

create function pg_temp.rank_blocked(p_racha uuid, p_id uuid) returns boolean
language sql as $$
  select (x ->> 'is_blocked')::boolean
  from jsonb_array_elements(public.get_season_ranking(p_racha) -> 'members') x
  where x ->> 'profile_id' = p_id::text
$$;

create function pg_temp.card_blocked(p_event uuid, p_id uuid) returns boolean
language sql as $$
  select bool_or((x ->> 'is_blocked')::boolean)
  from jsonb_array_elements(public.get_event_resenha(p_event) -> 'cards') x
  where x #>> '{person,profile_id}' = p_id::text
$$;

-- Os dois resumos que leem private.event_resenha_summary.
create function pg_temp.summaries(p_racha uuid) returns jsonb
language sql as $$
  select jsonb_build_object(
    'last', public.get_racha_last_resenha(p_racha),
    'events', public.get_season_events(p_racha))
$$;

create function pg_temp.resenha_blocked(p_event uuid, p_id uuid) returns boolean
language sql as $$
  select (x ->> 'is_blocked')::boolean
  from jsonb_array_elements(public.get_event_resenha(p_event) -> 'people') x
  where x #>> '{person,profile_id}' = p_id::text
$$;

-- ============================================================
-- 1. Denúncia: motivo por tipo, próprio Perfil, alvo inexistente, upsert
-- ============================================================
do $$
declare
  v jsonb;
  v_ana uuid;
  v_bia uuid;
  v_racha uuid;
  v_row public.report;
begin
  v := pg_temp.scene('DENU23');
  v_racha := (v ->> 'racha')::uuid;
  v_ana := (v #>> '{people,0}')::uuid;
  v_bia := (v #>> '{people,1}')::uuid;
  perform pg_temp.as_(v_ana);

  perform pg_temp.assert_that(
    pg_temp.err(format('select public.report_content(%L, %L, %L)', 'profile', v_bia, 'scam_charge')) = 'invalid_reason'
    and pg_temp.err(format('select public.report_content(%L, %L, %L)', 'racha', v_racha, 'photo')) = 'invalid_reason'
    and pg_temp.err(format('select public.report_content(%L, %L, %L)', 'event', v_racha, 'other')) = 'invalid_reason',
    'motivo que não vale para o tipo é recusado');
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.report_content(%L, %L, %L)', 'profile', v_ana, 'name')) = 'not_allowed',
    'não denuncia o próprio Perfil');
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.report_content(%L, %L, %L)', 'profile', gen_random_uuid(), 'name')) = 'not_found'
    and pg_temp.err(format('select public.report_content(%L, %L, %L)', 'racha', gen_random_uuid(), 'name')) = 'not_found',
    'alvo inexistente é recusado');
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.report_content(%L, %L, %L, %L)', 'profile', v_bia, 'other', repeat('x', 501))) <> 'ok',
    'detalhes com mais de 500 caracteres são recusados');

  perform public.report_content('profile', v_bia, 'photo', '  ');
  perform public.report_content('profile', v_bia, 'harassment', 'Ofendeu no grupo');
  perform public.report_content('racha', v_racha, 'scam_charge', null);

  select * into v_row from public.report r
  where r.reporter_id = v_ana and r.target_profile_id = v_bia;
  perform pg_temp.assert_that(
    (select count(*) from public.report r where r.reporter_id = v_ana and r.target_profile_id = v_bia) = 1
    and v_row.reason = 'harassment'
    and v_row.details = 'Ofendeu no grupo'
    and v_row.status = 'open'
    and v_row.target_kind = 'profile'
    and (select count(*) from public.report r where r.reporter_id = v_ana and r.target_racha_id = v_racha) = 1,
    'a segunda denúncia aberta atualiza a primeira; a do Racha é outra linha');

  -- Fechada pela equipe, a próxima abre outra.
  update public.report set status = 'actioned' where id = v_row.id;
  perform public.report_content('profile', v_bia, 'name');
  perform pg_temp.assert_that(
    (select count(*) from public.report r where r.reporter_id = v_ana and r.target_profile_id = v_bia) = 2,
    'denúncia nova depois que a anterior foi tratada');

  raise notice 'PASS: denúncia com motivo por tipo, sem o próprio Perfil e uma aberta por alvo';
end $$;

-- ============================================================
-- 2. Ninguém lê nem escreve report ou profile_block direto
-- ============================================================
do $$
declare
  v_reports integer;
  v_blocks integer;
begin
  perform pg_temp.as_((select r.reporter_id from public.report r limit 1));
  set local role authenticated;
  select count(*) into v_reports from public.report;
  select count(*) into v_blocks from public.profile_block;
  reset role;
  perform pg_temp.assert_that(v_reports = 0 and v_blocks = 0,
    'authenticated não lê report nem profile_block');
  perform pg_temp.assert_that(
    not has_function_privilege('anon', 'public.report_content(text, uuid, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.block_profile(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.unblock_profile(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.get_blocked_profiles()', 'execute')
    and has_function_privilege('authenticated', 'public.report_content(text, uuid, text, text)', 'execute')
    and has_function_privilege('authenticated', 'public.block_profile(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'private.is_blocked_by_caller(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'private.name_is_allowed(text)', 'execute'),
    'grants: RPCs só para authenticated, privadas fechadas');
  raise notice 'PASS: report e profile_block fechados para o app';
end $$;

-- ============================================================
-- 3. Bloqueio: some só para quem bloqueou; o resto não muda
-- ============================================================
do $$
declare
  v jsonb;
  v_racha uuid;
  v_event uuid;
  v_owner uuid;
  v_ana uuid;
  v_bia uuid;
  v_caio uuid;
  v_t1 uuid;
  v_match uuid;
  v_before_ana jsonb;
  v_before_bia jsonb;
  v_after_bia jsonb;
begin
  v := pg_temp.scene('BLKQ23');
  v_racha := (v ->> 'racha')::uuid;
  v_event := (v ->> 'event')::uuid;
  v_owner := (v ->> 'owner')::uuid;
  v_t1 := (v ->> 't1')::uuid;
  v_ana := (v #>> '{people,0}')::uuid;
  v_bia := (v #>> '{people,1}')::uuid;
  v_caio := (v #>> '{people,2}')::uuid;

  -- Bia artilheira única (2), Caio 1: o Time 1 vence.
  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_event) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'b1', v_t1, v_bia, v_caio, false);
  perform public.add_event_match_goal(v_match, 'b2', v_t1, v_bia, null, false);
  perform public.add_event_match_goal(v_match, 'c1', v_t1, v_caio, null, false);
  perform public.add_event_match_card(v_match, v_bia, null, 'yellow');
  perform public.add_event_match_card(v_match, v_caio, null, 'yellow');
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_event);

  perform pg_temp.as_(v_bia);
  v_before_bia := jsonb_build_object(
    'members', (select jsonb_agg(to_jsonb(m) order by m.profile_id) from public.list_racha_members(v_racha) m),
    'ranking', public.get_season_ranking(v_racha),
    'resenha', public.get_event_resenha(v_event),
    'summaries', pg_temp.summaries(v_racha));

  perform pg_temp.as_(v_ana);
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.block_profile(%L)', v_ana)) = 'not_allowed'
    and pg_temp.err(format('select public.block_profile(%L)', gen_random_uuid())) = 'not_found',
    'não bloqueia a si mesmo nem quem não existe');
  perform public.block_profile(v_bia);
  perform public.block_profile(v_bia);
  perform pg_temp.assert_that(
    (select count(*) from public.profile_block b where b.blocker_id = v_ana) = 1,
    'bloquear de novo não duplica');

  -- Quem bloqueou: a Bia vem marcada nas três leituras, e só ela.
  perform pg_temp.assert_that(
    pg_temp.member_blocked(v_racha, v_bia)
    and not pg_temp.member_blocked(v_racha, v_caio)
    and (select count(*) from public.list_racha_members(v_racha) m where m.is_blocked) = 1
    and (select count(*) from public.list_racha_members(v_racha)) = 9,
    'Membros: a Bia marcada para a Ana; a lista continua com os 9 para as outras telas');
  perform pg_temp.assert_that(
    pg_temp.rank_blocked(v_racha, v_bia) and not pg_temp.rank_blocked(v_racha, v_caio),
    'Ranking: a Bia marcada para a Ana, com os números dela');
  perform pg_temp.assert_that(
    pg_temp.resenha_blocked(v_event, v_bia)
    and not pg_temp.resenha_blocked(v_event, v_caio)
    and public.get_event_resenha(v_event) #>> '{scorer_card,display_name}' = 'Bia',
    'Resenha: a Bia marcada nas pessoas; a carta (cartaz) continua com ela');

  perform pg_temp.assert_that(
    pg_temp.card_blocked(v_event, v_bia) and not pg_temp.card_blocked(v_event, v_caio),
    'Resenha: o cartão da Bia marcado para a Ana, o do Caio não');
  perform pg_temp.assert_that(
    pg_temp.summaries(v_racha) #> '{last,scorers}' = '["Bia"]'::jsonb
    and pg_temp.summaries(v_racha) #> '{last,scorers_blocked}' = '[true]'::jsonb
    and pg_temp.summaries(v_racha) #> '{events,0,scorers_blocked}' = '[true]'::jsonb
    and (pg_temp.summaries(v_racha) #>> '{last,top_goals}')::integer = 2,
    'última Resenha e Eventos da Temporada: a artilheira marcada para a Ana, com o número');

  -- Telas de jogo: a Presença não filtra.
  perform pg_temp.assert_that(
    exists (select 1 from public.list_event_attendance(v_event) a where a.profile_id = v_bia),
    'Presença continua com a Bia');

  -- A Bia (bloqueada) e o Caio (terceiro) não veem diferença nenhuma.
  perform pg_temp.as_(v_bia);
  v_after_bia := jsonb_build_object(
    'members', (select jsonb_agg(to_jsonb(m) order by m.profile_id) from public.list_racha_members(v_racha) m),
    'ranking', public.get_season_ranking(v_racha),
    'resenha', public.get_event_resenha(v_event),
    'summaries', pg_temp.summaries(v_racha));
  perform pg_temp.assert_that(v_after_bia = v_before_bia,
    'a Bia vê exatamente o mesmo de antes do bloqueio');
  perform pg_temp.assert_that(
    not pg_temp.any_member_blocked(v_racha)
    and not pg_temp.rank_blocked(v_racha, v_bia)
    and not pg_temp.resenha_blocked(v_event, v_bia),
    'a Bia não vê ninguém marcado');
  perform pg_temp.as_(v_caio);
  perform pg_temp.assert_that(
    not pg_temp.any_member_blocked(v_racha)
    and not pg_temp.rank_blocked(v_racha, v_bia)
    and not pg_temp.resenha_blocked(v_event, v_bia),
    'o Caio não vê ninguém marcado');
  perform pg_temp.assert_that(
    not pg_temp.card_blocked(v_event, v_bia)
    and not (pg_temp.summaries(v_racha) -> 'last' ? 'scorers_blocked')
    and not (pg_temp.summaries(v_racha) #> '{events,0}' ? 'scorers_blocked'),
    'o Caio não vê cartão marcado nem scorers_blocked nos resumos');

  -- Pessoas bloqueadas, com um Racha em comum.
  perform pg_temp.as_(v_ana);
  perform pg_temp.assert_that(
    (select count(*) from public.get_blocked_profiles()) = 1
    and (select g.display_name from public.get_blocked_profiles() g) = 'Bia'
    and (select g.shared_racha_name from public.get_blocked_profiles() g) = 'Racha Cena BLKQ23',
    'Pessoas bloqueadas: a Bia com o Racha em comum');

  -- Desbloquear volta.
  perform public.unblock_profile(v_bia);
  perform pg_temp.assert_that(
    not pg_temp.any_member_blocked(v_racha)
    and not pg_temp.rank_blocked(v_racha, v_bia)
    and not pg_temp.resenha_blocked(v_event, v_bia)
    and not pg_temp.card_blocked(v_event, v_bia)
    and not (pg_temp.summaries(v_racha) -> 'last' ? 'scorers_blocked')
    and not exists (select 1 from public.get_blocked_profiles()),
    'desbloquear tira a marca das três leituras e da lista');

  raise notice 'PASS: bloqueio marca só para quem bloqueou; bloqueado e terceiros veem igual';
end $$;

-- ============================================================
-- 4. Sem Racha em comum e cascata ao apagar a conta
-- ============================================================
do $$
declare
  v jsonb;
  v_ana uuid;
  v_bia uuid;
  v_caio uuid;
  v_stranger uuid;
begin
  v := pg_temp.scene('CASC23');
  v_ana := (v #>> '{people,0}')::uuid;
  v_bia := (v #>> '{people,1}')::uuid;
  v_caio := (v #>> '{people,2}')::uuid;
  v_stranger := pg_temp.person('Estranho');

  perform pg_temp.as_(v_ana);
  perform public.block_profile(v_stranger);
  perform public.block_profile(v_bia);
  perform pg_temp.assert_that(
    (select g.shared_racha_name from public.get_blocked_profiles() g where g.profile_id = v_stranger) is null,
    'sem Racha em comum vem nulo');

  perform pg_temp.as_(v_caio);
  perform public.block_profile(v_ana);
  perform public.report_content('profile', v_ana, 'spam_scam');

  -- Quem bloqueou e foi bloqueada apaga a conta: as linhas dela somem, a denúncia fica.
  perform pg_temp.as_(v_ana);
  perform public.delete_my_account();
  perform pg_temp.assert_that(
    not exists (select 1 from public.profile_block b where v_ana in (b.blocker_id, b.blocked_id))
    and exists (select 1 from public.report r where r.target_profile_id = v_ana)
    and (select p.display_name from public.profile p where p.id = v_ana) = 'Conta apagada',
    'apagar a conta leva os bloqueios em cascata; a denúncia fica');

  raise notice 'PASS: Racha em comum nulo e cascata ao apagar a conta';
end $$;

-- ============================================================
-- 5. Filtro de nome
-- ============================================================
do $$
declare
  v jsonb;
  v_racha uuid;
  v_ana uuid;
  v_allowed boolean;
begin
  perform pg_temp.assert_that(
    not public.name_allowed('Racha da Merda')
    and not public.name_allowed('PORRA')
    and not public.name_allowed('Pôrra Futebol')
    and not public.name_allowed('P0rr4 FC')
    and not public.name_allowed('M3rd@')
    and not public.name_allowed('5ap4tao'),
    'palavra da lista, com acento, maiúscula e troca de letra, é recusada');
  perform pg_temp.assert_that(
    public.name_allowed('Cuiabá Futebol')
    and public.name_allowed('Computador')
    and public.name_allowed('Merdinha Brava') -- palavra inteira: só "merda" sozinha
    and public.name_allowed('Racha 10')
    and public.name_allowed('Ana Paula')
    and public.name_allowed('Conta apagada'),
    'palavra inocente parecida passa');

  set local role anon;
  select public.name_allowed('caralho') into v_allowed;
  reset role;
  perform pg_temp.assert_that(v_allowed = false, 'anon consulta name_allowed antes do Cadastro');

  -- Gatilho no Perfil: o Cadastro que pula o app também é barrado.
  perform pg_temp.assert_that(
    pg_temp.err($q$select pg_temp.person('Ze Buceta')$q$) = 'name_not_allowed',
    'Cadastro com nome impróprio é recusado no banco');

  v := pg_temp.scene('FLTR23');
  v_racha := (v ->> 'racha')::uuid;
  v_ana := (v #>> '{people,0}')::uuid;

  perform pg_temp.assert_that(
    pg_temp.err(format('update public.profile set display_name = %L where id = %L', 'Ana Porra', v_ana)) = 'name_not_allowed',
    'trocar o nome do Perfil para um impróprio é recusado');
  perform pg_temp.assert_that(
    pg_temp.err(format('update public.racha set name = %L where id = %L', 'Racha do Caralho', v_racha)) = 'name_not_allowed',
    'renomear o Racha para um impróprio é recusado');
  perform pg_temp.assert_that(
    pg_temp.err($q$insert into public.racha (name, invite_code, place) values ('Os Fdp', 'FLTR45', 'Quadra')$q$) = 'name_not_allowed',
    'criar Racha com nome impróprio é recusado');

  -- Nome gravado antes do filtro continua salvando o resto da linha.
  alter table public.racha disable trigger racha_name_allowed;
  update public.racha set name = 'Racha da Bosta' where id = v_racha;
  alter table public.racha enable trigger racha_name_allowed;
  perform pg_temp.assert_that(
    pg_temp.err(format('update public.racha set name = %L, place = %L where id = %L', 'Racha da Bosta', 'Quadra Nova', v_racha)) = 'ok',
    'nome antigo igual não trava a edição do resto');

  raise notice 'PASS: filtro de nome no Perfil, no Racha e como anon';
end $$;

rollback;
