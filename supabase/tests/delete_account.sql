-- Apagar conta: bloqueios, saída de todos os Rachas, anonimização e e-mail livre.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/delete_account.sql
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

create function pg_temp.person(p_name text, p_email text default null) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_id, p_email, jsonb_build_object(
    'display_name', p_name,
    'birth_date', '1990-01-01',
    'plays_as', 'OUTFIELD',
    'primary_position', 'ANY',
    'terms_accepted', true
  ));
  return v_id;
end $$;

-- Racha com Dono e N jogadores de linha. p_tag só com letras (entra no nome).
create function pg_temp.group(p_tag text, p_code text, p_players integer)
returns jsonb
language plpgsql as $$
declare
  v_owner uuid;
  v_racha uuid;
  v_players uuid[] := '{}';
  v_i integer;
  v_pid uuid;
begin
  v_owner := pg_temp.person('Dono ' || p_tag);
  insert into public.racha (name, invite_code, place, outfield_per_team)
  values ('Racha ' || p_tag, p_code, 'Quadra ' || p_tag, 3)
  returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);
  for v_i in 1..p_players loop
    v_pid := pg_temp.person('Jogador ' || p_tag || ' ' || chr(64 + v_i));
    insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
    values (v_racha, v_pid, 'PLAYER', 'OUTFIELD', 'ANY', 3);
    v_players := v_players || v_pid;
  end loop;
  return jsonb_build_object('owner', v_owner, 'racha', v_racha, 'players', to_jsonb(v_players));
end $$;

create function pg_temp.join(p_racha uuid, p_who uuid, p_role public.member_role) returns void
language sql as $$
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (p_racha, p_who, p_role, 'OUTFIELD', 'ANY', 3)
$$;

create function pg_temp.new_event(p_racha uuid, p_spot_limit smallint default null) returns uuid
language sql as $$
  select public.create_event(
    p_racha, current_date + 14, time '19:00', 'Quadra Centro', false,
    null::integer, p_spot_limit, null::integer
  )
$$;

-- Evento em andamento direto na tabela: o teste só precisa do status e do Condutor.
create function pg_temp.active_event(p_racha uuid, p_conductor uuid) returns uuid
language sql as $$
  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule, tie_return_order,
    consider_position
  ) values (
    p_racha, current_date, time '19:00', 'Quadra Centro', 'active', p_conductor, 24,
    3, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false
  ) returning id
$$;

create function pg_temp.aviso(p_recipient uuid, p_racha uuid) returns void
language sql as $$
  insert into public.notification (recipient_id, kind, racha_id, racha_name)
  select p_recipient, 'event_cancelled', r.id, r.name from public.racha r where r.id = p_racha
$$;

-- ============================================================
-- Caso 3 e 5. Dono e Condutor de Evento em andamento não apagam
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_admin uuid;
  v_event uuid;
begin
  v := pg_temp.group('Bloqueio', 'DACA23', 1);
  v_owner := (v ->> 'owner')::uuid;
  v_admin := (v #>> '{players,0}')::uuid;
  perform pg_temp.aviso(v_owner, (v ->> 'racha')::uuid);

  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    pg_temp.err('select public.delete_my_account()') like '%account_deletion_blocked%',
    'Dono recebe account_deletion_blocked'
  );
  perform pg_temp.assert_that(
    exists (select 1 from auth.users u where u.id = v_owner)
    and exists (
      select 1 from public.profile p
      where p.id = v_owner and p.anonymized_at is null and p.display_name = 'Dono Bloqueio'
    )
    and exists (select 1 from public.member m where m.profile_id = v_owner and m.is_active)
    and exists (select 1 from public.notification n where n.recipient_id = v_owner),
    'bloqueado: conta, Perfil, Membro e Avisos ficam como estavam'
  );

  update public.member set role = 'ADMIN' where profile_id = v_admin;
  v_event := pg_temp.active_event((v ->> 'racha')::uuid, v_admin);
  perform pg_temp.as_(v_admin);
  perform pg_temp.assert_that(
    pg_temp.err('select public.delete_my_account()') like '%account_deletion_blocked%',
    'Condutor de Evento em andamento recebe account_deletion_blocked'
  );
  perform pg_temp.assert_that(
    exists (select 1 from auth.users u where u.id = v_admin)
    and exists (select 1 from public.member m where m.profile_id = v_admin and m.is_active)
    and (select e.conductor_id from public.event e where e.id = v_event) = v_admin,
    'Condutor bloqueado: nada muda'
  );
  raise notice 'PASS: Dono e Condutor de Evento em andamento são bloqueados';
end $$;

-- ============================================================
-- get_account_deletion_check: números do próprio Perfil
-- ============================================================
do $$
declare
  va jsonb;
  vb jsonb;
  vc jsonb;
  v_me uuid := pg_temp.person('Pessoa Conferida');
  v_event uuid;
  v_check jsonb;
begin
  va := pg_temp.group('Meu', 'DACB23', 0);
  vb := pg_temp.group('Conduzo', 'DACC23', 0);
  vc := pg_temp.group('Jogo', 'DACD23', 0);
  -- O Racha "Meu" passa a ser da pessoa, com o antigo Dono e mais um como Membros.
  update public.member set role = 'PLAYER' where racha_id = (va ->> 'racha')::uuid;
  perform pg_temp.join((va ->> 'racha')::uuid, v_me, 'OWNER');
  perform pg_temp.join((va ->> 'racha')::uuid, pg_temp.person('Mais Um'), 'PLAYER');
  perform pg_temp.join((vb ->> 'racha')::uuid, v_me, 'ADMIN');
  perform pg_temp.join((vc ->> 'racha')::uuid, v_me, 'PLAYER');
  v_event := pg_temp.active_event((vb ->> 'racha')::uuid, v_me);

  perform pg_temp.as_(v_me);
  v_check := public.get_account_deletion_check();
  perform pg_temp.assert_that((v_check ->> 'racha_count')::integer = 3, 'racha_count conta os 3 Rachas');
  perform pg_temp.assert_that(
    v_check -> 'owned_rachas' = jsonb_build_array(jsonb_build_object(
      'id', va ->> 'racha', 'name', 'Racha Meu', 'member_count', 3
    )),
    'owned_rachas traz o Racha da pessoa com 3 Membros ativos'
  );
  perform pg_temp.assert_that(
    v_check -> 'conducting' = jsonb_build_array(jsonb_build_object(
      'racha_id', vb ->> 'racha', 'racha_name', 'Racha Conduzo', 'event_id', v_event
    )),
    'conducting traz o Evento em andamento'
  );

  perform pg_temp.as_((vc ->> 'owner')::uuid);
  v_check := public.get_account_deletion_check();
  perform pg_temp.assert_that(
    (v_check ->> 'racha_count')::integer = 1
    and jsonb_array_length(v_check -> 'owned_rachas') = 1
    and v_check -> 'conducting' = '[]'::jsonb,
    'outra pessoa vê só os próprios números'
  );
  raise notice 'PASS: get_account_deletion_check devolve os números certos';
end $$;

-- ============================================================
-- Caso 1, 9 e Foco 1. Caminho feliz em 2 Rachas, com a Lista de espera
-- ============================================================
do $$
declare
  va jsonb;
  vb jsonb;
  vc jsonb;
  v_me uuid := pg_temp.person('Pessoa Que Sai');
  v_wait uuid := pg_temp.person('Pessoa Na Fila');
  v_other uuid;
  v_event_a uuid;
  v_event_b uuid;
  v_i integer;
begin
  va := pg_temp.group('Fila', 'DACE23', 4);
  vb := pg_temp.group('Conduz', 'DACF23', 0);
  vc := pg_temp.group('Pedido', 'DACG23', 0);
  v_other := (va #>> '{players,0}')::uuid;
  perform pg_temp.join((va ->> 'racha')::uuid, v_me, 'PLAYER');
  perform pg_temp.join((va ->> 'racha')::uuid, v_wait, 'PLAYER');
  perform pg_temp.join((vb ->> 'racha')::uuid, v_me, 'ADMIN');

  -- Evento futuro com 6 vagas: Dono, 4 jogadores e a pessoa; a sétima fica na fila.
  perform pg_temp.as_((va ->> 'owner')::uuid);
  v_event_a := pg_temp.new_event((va ->> 'racha')::uuid, 6::smallint);
  perform public.confirm_attendance(v_event_a);
  for v_i in 0..3 loop
    perform pg_temp.as_((va #>> array['players', v_i::text])::uuid);
    perform public.confirm_attendance(v_event_a);
  end loop;
  perform pg_temp.as_(v_me);
  perform public.confirm_attendance(v_event_a);
  perform pg_temp.as_(v_wait);
  perform public.confirm_attendance(v_event_a);
  perform pg_temp.assert_that(
    (select ea.status from public.event_attendance ea
      where ea.event_id = v_event_a and ea.profile_id = v_wait) = 'waitlisted',
    'preparação: a sétima pessoa está na fila'
  );

  -- No outro Racha, a pessoa é Admin e conduz o Evento futuro.
  perform pg_temp.as_((vb ->> 'owner')::uuid);
  v_event_b := pg_temp.new_event((vb ->> 'racha')::uuid);
  update public.event set conductor_id = v_me where id = v_event_b;

  -- Pedido pendente num Racha de que não é Membro.
  insert into public.join_request (racha_id, profile_id) values ((vc ->> 'racha')::uuid, v_me);

  insert into public.push_token (token, profile_id, platform)
  values ('ExponentPushToken[apagar]', v_me, 'ios');
  perform pg_temp.aviso(v_me, (va ->> 'racha')::uuid);
  perform pg_temp.aviso(v_me, (vb ->> 'racha')::uuid);
  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
  select v_me, r.id, r.name, 'REMOVED' from public.racha r where r.id = (va ->> 'racha')::uuid;
  perform pg_temp.aviso(v_other, (va ->> 'racha')::uuid);
  update public.profile set avatar_path = v_me::text || '/1.jpg' where id = v_me;

  perform pg_temp.as_(v_me);
  perform public.delete_my_account();

  perform pg_temp.assert_that(
    not exists (select 1 from public.member m where m.profile_id = v_me and m.is_active)
    and (select count(*) from public.member m where m.profile_id = v_me) = 2,
    'some de Membros nos 2 Rachas, e as linhas ficam no histórico'
  );
  perform pg_temp.assert_that(
    not exists (select 1 from public.event_attendance ea where ea.profile_id = v_me),
    'a Presença futura sai'
  );
  perform pg_temp.assert_that(
    (select ea.status from public.event_attendance ea
      where ea.event_id = v_event_a and ea.profile_id = v_wait) = 'confirmed',
    'a vaga promove o primeiro da fila'
  );
  perform pg_temp.assert_that(
    (select e.conductor_id from public.event e where e.id = v_event_b) is null,
    'a condução do Evento futuro é liberada'
  );
  perform pg_temp.assert_that(
    not exists (select 1 from public.join_request jr where jr.profile_id = v_me),
    'Solicitações somem, inclusive em Racha de que não era Membro'
  );
  perform pg_temp.assert_that(
    not exists (select 1 from public.push_token t where t.profile_id = v_me)
    and not exists (select 1 from public.notification n where n.recipient_id = v_me)
    and not exists (select 1 from public.racha_notice rn where rn.profile_id = v_me),
    'tokens, Avisos e avisos da aba Rachas da pessoa somem'
  );
  perform pg_temp.assert_that(
    exists (select 1 from public.notification n where n.recipient_id = v_other),
    'Avisos dos outros ficam'
  );
  perform pg_temp.assert_that(
    exists (
      select 1 from public.profile p
      where p.id = v_me
        and p.display_name = 'Conta apagada'
        and p.avatar_path is null
        and p.birth_date is null
        and p.primary_position is null
        and p.secondary_position is null
        and p.anonymized_at is not null
    ),
    'o Perfil fica anonimizado'
  );
  perform pg_temp.assert_that(
    not exists (select 1 from auth.users u where u.id = v_me),
    'auth.users não tem mais a linha'
  );
  perform pg_temp.assert_that(
    exists (select 1 from auth.users u where u.id = v_other)
    and exists (
      select 1 from public.profile p
      where p.id = v_other and p.anonymized_at is null and p.display_name <> 'Conta apagada'
    )
    and exists (select 1 from public.member m where m.profile_id = v_other and m.is_active),
    'ninguém mais é afetado'
  );

  -- Token antigo ainda vale até expirar: não repete nem consulta.
  perform pg_temp.assert_that(
    pg_temp.err('select public.delete_my_account()') like '%not_allowed%'
    and pg_temp.err('select public.get_account_deletion_check()') like '%not_allowed%',
    'conta já apagada recebe not_allowed'
  );
  raise notice 'PASS: apagar sai dos Rachas, promove a fila, anonimiza e apaga o login';
end $$;

-- ============================================================
-- Histórico: Gols e Partidas continuam apontando para o Perfil
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_racha uuid;
  v_scorer uuid;
  v_event uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_match uuid;
  v_i integer;
  v_pid uuid;
begin
  v := pg_temp.group('Historico', 'DACH23', 0);
  v_owner := (v ->> 'owner')::uuid;
  v_racha := (v ->> 'racha')::uuid;
  v_event := pg_temp.active_event(v_racha, v_owner);
  insert into public.event_sort (
    event_id, status, signature, version, leftover_ids, mode, goalkeepers_per_team,
    balance_score, balance_label, balance_diff, super_diff, capped_by_super,
    confirmed_at, confirmed_by
  ) values (
    v_event, 'confirmed', 'historico', 1, '{}', 'normal', false,
    80, 'Equilibrado', 0, 0, false, now(), v_owner
  );
  insert into public.event_sort_team (event_id, team_number, queue_order, win_streak)
  values (v_event, 1, 1, 0) returning id into v_t1;
  insert into public.event_sort_team (event_id, team_number, queue_order, win_streak)
  values (v_event, 2, 2, 0) returning id into v_t2;
  for v_i in 1..6 loop
    v_pid := pg_temp.person('Linha Historico ' || chr(64 + v_i));
    perform pg_temp.join(v_racha, v_pid, 'PLAYER');
    insert into public.event_sort_team_player (
      event_id, team_id, profile_id, stars_snapshot, is_super_star_snapshot,
      primary_position_snapshot
    ) values (v_event, case when v_i <= 3 then v_t1 else v_t2 end, v_pid, 3, false, 'ANY');
    insert into public.event_attendance (event_id, profile_id, status, did_attend)
    values (v_event, v_pid, 'confirmed', true);
    if v_i = 1 then
      v_scorer := v_pid;
    end if;
  end loop;

  perform pg_temp.as_(v_owner);
  v_match := (public.start_event_match(v_event) #>> '{match,id}')::uuid;
  perform public.add_event_match_goal(v_match, 'gol', v_t1, v_scorer, null, false);
  perform public.finish_event_match(v_match);
  perform public.finish_event(v_event);

  perform pg_temp.as_(v_scorer);
  perform public.delete_my_account();

  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_match_goal g
      join public.profile p on p.id = g.scorer_profile_id
      where g.match_id = v_match and p.id = v_scorer and p.display_name = 'Conta apagada'
    ),
    'o Gol continua da pessoa, agora "Conta apagada"'
  );
  perform pg_temp.assert_that(
    exists (
      select 1 from public.event_match_lineup l
      where l.match_id = v_match and l.profile_id = v_scorer
    )
    and exists (
      select 1 from public.event_attendance ea
      where ea.event_id = v_event and ea.profile_id = v_scorer and ea.did_attend
    ),
    'a Partida e a Presença passada continuam apontando para o Perfil'
  );
  raise notice 'PASS: o histórico fica com o Perfil anonimizado';
end $$;

-- ============================================================
-- Caso 8 e Foco 2. Cadastro novo com o mesmo e-mail
-- ============================================================
do $$
declare
  v_old uuid := pg_temp.person('Pessoa Antiga', 'reuso@example.test');
  v_new uuid;
begin
  perform pg_temp.as_(v_old);
  perform public.delete_my_account();

  perform pg_temp.assert_that(
    public.email_available('reuso@example.test'),
    'o e-mail fica livre'
  );
  v_new := pg_temp.person('Pessoa Nova', 'reuso@example.test');
  perform pg_temp.assert_that(
    exists (
      select 1 from public.profile p
      where p.id = v_new and p.display_name = 'Pessoa Nova' and p.anonymized_at is null
    )
    and exists (
      select 1 from public.profile p where p.id = v_old and p.display_name = 'Conta apagada'
    ),
    'o Cadastro cria um Perfil novo e o antigo continua anonimizado'
  );
  raise notice 'PASS: o mesmo e-mail cria uma conta nova';
end $$;

-- ============================================================
-- Sem sessão: not_allowed
-- ============================================================
do $$
begin
  perform pg_temp.as_(null);
  perform pg_temp.assert_that(
    pg_temp.err('select public.delete_my_account()') like '%not_allowed%'
    and pg_temp.err('select public.get_account_deletion_check()') like '%not_allowed%',
    'sem sessão, as duas funções recusam com not_allowed'
  );
  perform pg_temp.assert_that(
    not has_function_privilege('anon', 'public.delete_my_account()', 'execute')
    and not has_function_privilege('anon', 'public.get_account_deletion_check()', 'execute')
    and not has_function_privilege('authenticated', 'private.leave_racha_effects(uuid, uuid)', 'execute'),
    'anon não chama as funções e ninguém chama os efeitos privados'
  );
  raise notice 'PASS: sem sessão não apaga nem consulta';
end $$;

rollback;
