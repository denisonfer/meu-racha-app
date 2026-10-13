-- Conta apagada com JWT antigo não opera; nome do apagado some dos Avisos alheios;
-- token de push e avatar_path validados.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/deleted_account_guard.sql
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

create function pg_temp.person(p_name text) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_id, null, jsonb_build_object(
    'display_name', p_name,
    'birth_date', '1990-01-01',
    'plays_as', 'OUTFIELD',
    'primary_position', 'ANY',
    'terms_accepted', true
  ));
  return v_id;
end $$;

create function pg_temp.racha(p_tag text, p_code text, p_owner uuid) returns uuid
language plpgsql as $$
declare
  v_racha uuid;
begin
  insert into public.racha (name, invite_code, place, outfield_per_team)
  values ('Racha ' || p_tag, p_code, 'Quadra ' || p_tag, 3)
  returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, p_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);
  return v_racha;
end $$;

create function pg_temp.join(p_racha uuid, p_who uuid, p_role public.member_role) returns void
language sql as $$
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (p_racha, p_who, p_role, 'OUTFIELD', 'ANY', 3)
$$;

-- ============================================================
-- MÉDIO-1. Conta apagada não opera com o JWT antigo
-- ============================================================
do $$
declare
  v_owner uuid := pg_temp.person('Dono Guarda');
  v_racha uuid := pg_temp.racha('Guarda', 'GRDA23', v_owner);
  v_live uuid := pg_temp.person('Pessoa Viva');
  v_gone uuid := pg_temp.person('Pessoa Apagada');
  v_target uuid := pg_temp.person('Alvo');
  v_before integer;
begin
  -- Controle: conta viva faz tudo isto; sem ele o teste passaria por bloquear tudo.
  perform pg_temp.as_(v_live);
  perform pg_temp.assert_that(
    (select count(*) from public.get_invite('GRDA23')) = 1
    and pg_temp.err('select public.register_push_token(''ExponentPushToken[vivo]'', ''ios'')') = 'ok'
    and pg_temp.err(format('select public.block_profile(%L)', v_target)) = 'ok'
    and pg_temp.err(format('select public.report_content(''profile'', %L, ''other'', null)', v_target)) = 'ok'
    and pg_temp.err('select (public.create_racha(''Racha Vivo'', 3::smallint, ''WINNER_STAYS'', 2::smallint, ''BOTH_OUT'', ''TEAM_ORDER'', false, ''Quadra'')).id is not null') = 'ok',
    'controle: conta viva opera'
  );
  perform pg_temp.join(v_racha, v_gone, 'PLAYER');
  perform pg_temp.as_(v_gone);
  perform pg_temp.assert_that(public.my_racha_role(v_racha) = 'PLAYER', 'controle: Membro tem papel');
  perform public.delete_my_account();

  -- JWT antigo: o sub continua setado.
  select count(*) into v_before from public.racha;
  perform pg_temp.assert_that(
    pg_temp.err('select (public.create_racha(''Racha Fantasma'', 3::smallint, ''WINNER_STAYS'', 2::smallint, ''BOTH_OUT'', ''TEAM_ORDER'', false, ''Quadra'')).id') like '%not_authenticated%'
    and (select count(*) from public.racha) = v_before,
    'conta apagada não cria Racha'
  );
  perform pg_temp.assert_that(
    pg_temp.err('select public.register_push_token(''ExponentPushToken[fantasma]'', ''ios'')') like '%not_allowed%'
    and pg_temp.err('select public.unregister_push_token(''ExponentPushToken[fantasma]'')') like '%not_allowed%'
    and pg_temp.err('select public.set_push_enabled(false)') like '%not_allowed%'
    and not exists (select 1 from public.push_token t where t.token = 'ExponentPushToken[fantasma]'),
    'conta apagada não mexe em push'
  );
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.report_content(''profile'', %L, ''other'', null)', v_target)) like '%not_allowed%'
    and pg_temp.err(format('select public.block_profile(%L)', v_target)) like '%not_allowed%'
    and not exists (select 1 from public.report r where r.reporter_id = v_gone),
    'conta apagada não denuncia nem bloqueia'
  );
  perform pg_temp.assert_that(
    (select count(*) from public.get_invite('GRDA23')) = 0,
    'conta apagada não vê o Convite'
  );
  perform pg_temp.assert_that(
    public.my_racha_role(v_racha) is null and not public.is_racha_member(v_racha),
    'conta apagada não tem papel nem pertencimento'
  );

  -- Pelas policies, como a API faz.
  set local role authenticated;
  perform pg_temp.assert_that(
    pg_temp.err(format(
      'insert into public.join_request (racha_id) values (%L)', v_racha
    )) like '%row-level security%',
    'conta apagada não entra na fila de Solicitações'
  );
  perform pg_temp.assert_that(
    pg_temp.err(format(
      'update public.profile set avatar_path = %L where id = %L', v_gone::text || '/1.jpg', v_gone
    )) = 'ok'
    and (select p.avatar_path from public.profile p where p.id = v_gone) is null,
    'conta apagada não troca a foto do Perfil anonimizado (0 linhas)'
  );
  reset role;
  perform pg_temp.assert_that(
    not exists (select 1 from public.join_request jr where jr.profile_id = v_gone),
    'nenhuma Solicitação da conta apagada'
  );

  -- Controle da policy: conta viva ainda pede entrada.
  perform pg_temp.as_(v_live);
  set local role authenticated;
  perform pg_temp.assert_that(
    pg_temp.err(format(
      'insert into public.join_request (racha_id) values (%L)', v_racha
    )) = 'ok',
    'controle: conta viva pede entrada'
  );
  reset role;
  raise notice 'PASS: conta apagada com JWT antigo não opera';
end $$;

-- ============================================================
-- MÉDIO-2a. O nome do apagado some dos Avisos dos outros
-- ============================================================
do $$
declare
  v_owner uuid := pg_temp.person('Dono Aviso');
  v_admin uuid := pg_temp.person('Admin Que Sai');
  v_player uuid := pg_temp.person('Jogador Que Fica');
  v_asker uuid := pg_temp.person('Pedinte Que Sai');
  v_asker2 uuid := pg_temp.person('Pedinte Recusado');
  v_racha uuid := pg_temp.racha('Aviso', 'AVSA23', v_owner);
  v_event uuid;
  v_req uuid;
  v_req2 uuid;
begin
  perform pg_temp.join(v_racha, v_admin, 'ADMIN');
  perform pg_temp.join(v_racha, v_player, 'PLAYER');

  perform pg_temp.as_(v_owner);
  v_event := public.create_event(
    v_racha, current_date + 14, time '19:00', 'Quadra Centro', false,
    null::integer, null::smallint, null::integer
  );

  perform pg_temp.as_(v_admin);
  perform public.update_event(
    v_event, current_date + 14, time '20:00', 'Quadra Centro', false,
    null::integer, null::smallint, null::integer
  );
  perform pg_temp.assert_that(
    (select n.actor_name from public.notification n
      where n.recipient_id = v_player and n.kind = 'event_changed') = 'Admin Que Sai'
    and (select n.actor_id from public.notification n
      where n.recipient_id = v_player and n.kind = 'event_changed') = v_admin,
    'preparação: Aviso do Jogador traz nome e id do Admin'
  );

  -- Pedido recusado pelo Admin: o nome dele fica no retrato da resolução do Dono.
  perform pg_temp.as_(v_asker2);
  insert into public.join_request (racha_id, profile_id) values (v_racha, v_asker2)
  returning id into v_req2;
  perform pg_temp.as_(v_admin);
  perform public.refuse_join_request(v_req2);
  perform pg_temp.assert_that(
    exists (
      select 1 from public.notification n
      where n.recipient_id = v_owner and n.join_request_id = v_req2
        and n.payload #>> '{resolution,by_name}' = 'Admin Que Sai'
    ),
    'preparação: resolução do Dono traz o Admin'
  );

  -- Pedido que o pedinte apagará a conta: Aviso do Dono traz o nome dele.
  perform pg_temp.as_(v_asker);
  insert into public.join_request (racha_id, profile_id) values (v_racha, v_asker)
  returning id into v_req;
  perform pg_temp.assert_that(
    (select n.actor_name from public.notification n
      where n.recipient_id = v_owner and n.join_request_id = v_req) = 'Pedinte Que Sai',
    'preparação: Aviso de pedido traz o pedinte'
  );
  -- Aviso anterior à coluna: sem actor_id, atribuído pelo join_request.
  update public.notification set actor_id = null where join_request_id = v_req;

  perform pg_temp.as_(v_admin);
  perform public.delete_my_account();
  perform pg_temp.as_(v_asker);
  perform public.delete_my_account();

  perform pg_temp.assert_that(
    not exists (
      select 1 from public.notification n
      where n.actor_name in ('Admin Que Sai', 'Pedinte Que Sai')
        or n.payload::text like '%Admin Que Sai%'
        or n.payload::text like '%' || v_admin::text || '%'
        or n.actor_id in (v_admin, v_asker)
    ),
    'nenhum Aviso guarda nome ou id de quem apagou a conta'
  );
  perform pg_temp.assert_that(
    (select n.actor_name from public.notification n
      where n.recipient_id = v_player and n.kind = 'event_changed') = 'Conta apagada'
    and (select n.payload #>> '{resolution,by_name}' from public.notification n
      where n.recipient_id = v_owner and n.join_request_id = v_req2) = 'Conta apagada'
    and (select n.actor_name from public.notification n
      where n.recipient_id = v_owner and n.join_request_id = v_req) = 'Conta apagada',
    'o texto vira "Conta apagada", que o app já sabe ler'
  );

  -- A leitura do app continua inteira, com by_me falso.
  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    (select count(*) from jsonb_array_elements(public.get_notifications()) e
      where e ->> 'actor_name' is null and e ->> 'kind' in ('join_request', 'event_changed')) = 0,
    'get_notifications não devolve actor_name nulo'
  );
  raise notice 'PASS: nome do ator some dos Avisos alheios';
end $$;

-- ============================================================
-- BAIXO-1. Token de push: formato, tamanho e limite por Perfil
-- ============================================================
do $$
declare
  v_a uuid := pg_temp.person('Tokens A');
  v_b uuid := pg_temp.person('Tokens B');
  v_i integer;
begin
  perform pg_temp.as_(v_a);
  perform pg_temp.assert_that(
    pg_temp.err('select public.register_push_token('''', ''ios'')') like '%push_token_expo_format%'
    and pg_temp.err(format('select public.register_push_token(%L, ''ios'')', repeat('x', 100000)))
      like '%push_token_expo_format%'
    and pg_temp.err(format(
      'select public.register_push_token(%L, ''ios'')',
      'ExponentPushToken[' || repeat('a', 200) || ']'
    )) like '%push_token_expo_format%'
    and pg_temp.err('select public.register_push_token(''ExponentPushToken[]'', ''ios'')')
      like '%push_token_expo_format%'
    and pg_temp.err('select public.register_push_token(''ExponentPushToken[a b]'', ''ios'')')
      like '%push_token_expo_format%'
    and pg_temp.err('select public.register_push_token(''ExpoPushToken[ok_1-x]'', ''android'')') = 'ok',
    'token vazio, gigante ou fora do formato é recusado; ExpoPushToken[...] vale'
  );

  for v_i in 1..12 loop
    perform public.register_push_token('ExponentPushToken[lim' || v_i || ']', 'ios');
    update public.push_token set updated_at = now() + make_interval(secs => v_i)
      where token = 'ExponentPushToken[lim' || v_i || ']';
  end loop;
  perform public.register_push_token('ExponentPushToken[lim1]', 'ios');
  perform pg_temp.assert_that(
    (select count(*) from public.push_token t where t.profile_id = v_a) = 10
    and exists (select 1 from public.push_token t where t.token = 'ExponentPushToken[lim1]'),
    'no máximo 10 por Perfil e o recém-registrado fica'
  );
  perform pg_temp.assert_that(
    not exists (select 1 from public.push_token t where t.token = 'ExponentPushToken[lim2]'),
    'sai o mais antigo'
  );

  -- Troca de conta no aparelho: quem entra por último fica com o token.
  perform pg_temp.as_(v_b);
  perform public.register_push_token('ExponentPushToken[lim1]', 'ios');
  perform pg_temp.assert_that(
    (select t.profile_id from public.push_token t where t.token = 'ExponentPushToken[lim1]') = v_b
    and (select count(*) from public.push_token t where t.profile_id = v_a) = 9,
    'token reaproveitado passa ao Perfil novo'
  );
  raise notice 'PASS: token de push validado e limitado';
end $$;

-- ============================================================
-- BAIXO-2. avatar_path só na própria pasta, com arquivo simples
-- ============================================================
do $$
declare
  v_me uuid := pg_temp.person('Avatar Eu');
  v_other uuid := pg_temp.person('Avatar Outro');
begin
  perform pg_temp.assert_that(
    pg_temp.err(format('update public.profile set avatar_path = %L where id = %L', v_me || '/../' || v_other || '/a.jpg', v_me))
      like '%avatar_path_in_own_folder%'
    and pg_temp.err(format('update public.profile set avatar_path = %L where id = %L', v_me || '/..', v_me))
      like '%avatar_path_in_own_folder%'
    and pg_temp.err(format('update public.profile set avatar_path = %L where id = %L', v_me || '/a/b.jpg', v_me))
      like '%avatar_path_in_own_folder%'
    and pg_temp.err(format('update public.profile set avatar_path = %L where id = %L', v_other || '/1.jpg', v_me))
      like '%avatar_path_in_own_folder%'
    and pg_temp.err(format('update public.profile set avatar_path = %L where id = %L', v_me || '/a..jpg', v_me))
      like '%avatar_path_in_own_folder%',
    'avatar_path com "..", subpasta ou de outra pasta é recusado'
  );
  perform pg_temp.assert_that(
    pg_temp.err(format('update public.profile set avatar_path = %L where id = %L', v_me || '/1760000000000.jpg', v_me)) = 'ok',
    'o formato real do app (<id>/<epoch>.jpg) passa'
  );
  raise notice 'PASS: avatar_path restrito';
end $$;

rollback;
