-- Push: tokens, silêncio, toque e o corpo que o gatilho põe na fila do pg_net.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/push.sql
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
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.person(p_name text) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, raw_user_meta_data)
  values (v_id, jsonb_build_object(
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
  insert into public.racha (name, invite_code, place)
  values ('Racha ' || p_tag, p_code, 'Quadra ' || p_tag)
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

create function pg_temp.token(p_who uuid, p_token text) returns void
language plpgsql as $$
begin
  perform pg_temp.as_(p_who);
  perform public.register_push_token(p_token, 'android');
end $$;

-- Corpos que o gatilho pôs na fila depois de p_after (só os deste teste).
create function pg_temp.queued(p_after bigint) returns setof jsonb
language sql as $$
  select convert_from(q.body, 'UTF8')::jsonb
  from net.http_request_queue q
  where q.id > p_after and q.url = 'http://push.test/send-push'
  order by q.id
$$;

create function pg_temp.queue_mark() returns bigint
language sql as $$
  select coalesce(max(q.id), 0) from net.http_request_queue q
$$;

create function pg_temp.items(p_after bigint) returns setof jsonb
language sql as $$
  select i from pg_temp.queued(p_after) b, jsonb_array_elements(b -> 'items') i
$$;

create function pg_temp.new_event(p_racha uuid, p_days integer) returns uuid
language sql as $$
  select public.create_event(
    p_racha, current_date + p_days, time '19:00', 'Quadra Centro', false,
    null::integer, null::smallint, null::integer
  )
$$;

-- Grava um Aviso pelo mesmo caminho das RPCs. Racha só tem um Evento futuro,
-- então os Avisos extras não passam por create_event.
create function pg_temp.aviso(p_recipient uuid, p_racha uuid) returns void
language sql as $$
  select private.notify(
    array[p_recipient], 'event_cancelled', p_racha, null, null,
    jsonb_build_object('event_date', '2026-10-20')
  )
$$;

-- O ambiente local pode ter os segredos do snippet; o teste usa os seus.
delete from vault.secrets where name in ('push_function_url', 'push_function_secret');
select vault.create_secret('http://push.test/send-push', 'push_function_url');
select vault.create_secret('segredo-de-teste', 'push_function_secret');

-- ============================================================
-- Caso 7. Sorteio: um item por token, cada um com o Time da pessoa
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_racha uuid;
  v_event uuid;
  v_pr jsonb;
  v_i integer;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_mark bigint;
  v_bad integer;
  v_teams integer;
  v_open jsonb;
  v_id uuid;
begin
  v := pg_temp.group('Sorteio', 'PSHA23', 7);
  v_owner := (v ->> 'owner')::uuid;
  v_racha := (v ->> 'racha')::uuid;
  v_a := (v #>> '{players,0}')::uuid;
  v_b := (v #>> '{players,1}')::uuid;
  v_c := (v #>> '{players,2}')::uuid;

  perform pg_temp.token(v_a, 'ExponentPushToken[sorteio-a1]');
  perform pg_temp.token(v_a, 'ExponentPushToken[sorteio-a2]');
  perform pg_temp.token(v_b, 'ExponentPushToken[sorteio-b]');
  perform pg_temp.token(v_c, 'ExponentPushToken[sorteio-c]');

  perform pg_temp.as_(v_owner);
  v_event := pg_temp.new_event(v_racha, 20);
  perform public.assume_event_conduction(v_event);
  perform public.confirm_attendance(v_event);
  for v_i in 0..5 loop
    perform pg_temp.as_((v #>> array['players', v_i::text])::uuid);
    perform public.confirm_attendance(v_event);
  end loop;
  perform pg_temp.as_(v_owner);
  perform public.add_guest(v_event, 'Avulso Push', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  update public.event_attendance set did_attend = true where event_id = v_event;
  update public.event_guest set did_attend = true where event_id = v_event;
  v_pr := public.prepare_event_sort(v_event);

  v_mark := pg_temp.queue_mark();
  perform public.confirm_event_sort(v_event, (v_pr ->> 'version')::integer);

  perform pg_temp.assert_that(
    (select count(*) from pg_temp.items(v_mark) i
      where i #>> '{notification,kind}' = 'sort_confirmed') = 4,
    'Sorteio: 4 tokens de 3 pessoas viram 4 itens'
  );

  select count(*) into v_bad
  from pg_temp.items(v_mark) i
  join public.push_token t on t.token = i ->> 'token'
  join public.event_sort_team_player tp
    on tp.event_id = v_event and tp.profile_id = t.profile_id and tp.left_at is null
  join public.event_sort_team st on st.id = tp.team_id
  where (i #>> '{notification,payload,team}')::integer is distinct from st.team_number;
  perform pg_temp.assert_that(v_bad = 0, 'cada item leva o Time da pessoa do token');

  -- confirm_event_sort chama private.notify uma vez por Time: uma linha na
  -- fila por Time que tem token, nunca uma por pessoa.
  select count(distinct st.team_number) into v_teams
  from public.event_sort_team_player tp
  join public.event_sort_team st on st.id = tp.team_id
  where tp.event_id = v_event and tp.left_at is null and tp.profile_id in (v_a, v_b, v_c);
  perform pg_temp.assert_that(
    (select count(*) from pg_temp.queued(v_mark)) = v_teams,
    'Sorteio: uma chamada por instrução de private.notify (por Time), não por pessoa'
  );
  perform pg_temp.assert_that(
    not exists (
      select 1 from pg_temp.items(v_mark) i
      where i #>> '{notification,is_new}' <> 'true'
        or i -> 'notification' -> 'resolution' <> 'null'::jsonb
        or i #>> '{notification,target}' <> 'available'
        or i #>> '{notification,racha_name}' <> 'Racha Sorteio'
        or not (i -> 'notification' ?& array['id', 'racha_id', 'event_id', 'actor_name', 'created_at'])
    ),
    'notification do item segue a linha de get_notifications'
  );
  perform pg_temp.assert_that(
    (select q.headers ->> 'x-push-secret' from net.http_request_queue q
      where q.id > v_mark and q.url = 'http://push.test/send-push' limit 1) = 'segredo-de-teste',
    'a chamada leva o segredo do Vault no cabeçalho'
  );

  -- Evento encerrado: get_notifications e open_notification dão o mesmo target.
  perform public.finish_event(v_event, false);
  perform pg_temp.as_(v_a);
  select n.id into v_id from public.notification n
  where n.recipient_id = v_a and n.kind = 'sort_confirmed';
  perform pg_temp.assert_that(
    (select x ->> 'target' from jsonb_array_elements(public.get_notifications()) x
      where x ->> 'id' = v_id::text) = 'event_finished',
    'get_notifications: Sorteio de Evento encerrado vai à Resenha'
  );
  v_open := public.open_notification(v_id);
  perform pg_temp.assert_that(
    v_open = jsonb_build_object(
      'kind', 'sort_confirmed', 'racha_id', v_racha, 'event_id', v_event, 'target', 'event_finished'
    ),
    'open_notification devolve kind, racha_id, event_id e o mesmo target'
  );
  raise notice 'PASS: Sorteio vira um item por token, com o Time de cada pessoa';
end $$;

-- ============================================================
-- Casos 8 e 9. Silêncio por Racha, sem tocar no outro Racha
-- ============================================================
do $$
declare
  va jsonb;
  vb jsonb;
  v_person uuid;
  v_mark bigint;
begin
  va := pg_temp.group('Mudo', 'PSHB23', 0);
  vb := pg_temp.group('Falante', 'PSHC23', 0);
  v_person := pg_temp.person('Jogador Dois Rachas');
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values
    ((va ->> 'racha')::uuid, v_person, 'PLAYER', 'OUTFIELD', 'ANY', 3),
    ((vb ->> 'racha')::uuid, v_person, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  perform pg_temp.token(v_person, 'ExponentPushToken[dois-rachas]');

  perform pg_temp.as_(v_person);
  perform pg_temp.assert_that(
    not public.get_racha_push_muted((va ->> 'racha')::uuid),
    'sem linha, o Racha não está silenciado'
  );
  perform public.set_racha_push_muted((va ->> 'racha')::uuid, true);
  perform public.set_racha_push_muted((va ->> 'racha')::uuid, true);
  perform pg_temp.assert_that(
    public.get_racha_push_muted((va ->> 'racha')::uuid)
    and not public.get_racha_push_muted((vb ->> 'racha')::uuid),
    'silenciar A não silencia B, e silenciar duas vezes não quebra'
  );

  v_mark := pg_temp.queue_mark();
  perform pg_temp.as_((va ->> 'owner')::uuid);
  perform pg_temp.new_event((va ->> 'racha')::uuid, 21);
  perform pg_temp.assert_that(
    exists (select 1 from public.notification n
      where n.recipient_id = v_person and n.racha_id = (va ->> 'racha')::uuid)
    and not exists (select 1 from pg_temp.queued(v_mark)),
    'Racha silenciado: o Aviso fica na aba e nada vai para a fila'
  );

  v_mark := pg_temp.queue_mark();
  perform pg_temp.as_((vb ->> 'owner')::uuid);
  perform pg_temp.new_event((vb ->> 'racha')::uuid, 21);
  perform pg_temp.assert_that(
    (select count(*) from pg_temp.items(v_mark) i
      where i ->> 'token' = 'ExponentPushToken[dois-rachas]'
        and i #>> '{notification,racha_id}' = vb ->> 'racha') = 1,
    'o outro Racha da mesma pessoa continua mandando push'
  );

  perform pg_temp.as_(v_person);
  perform public.set_racha_push_muted((va ->> 'racha')::uuid, false);
  v_mark := pg_temp.queue_mark();
  perform pg_temp.as_((va ->> 'owner')::uuid);
  perform pg_temp.aviso(v_person, (va ->> 'racha')::uuid);
  perform pg_temp.assert_that(
    (select count(*) from pg_temp.items(v_mark)) = 1,
    'religado, o próximo Aviso sai'
  );
  raise notice 'PASS: silêncio vale só para o Racha silenciado';
end $$;

-- ============================================================
-- Caso 10. Badge conta os não vistos com o Aviso novo
-- ============================================================
do $$
declare
  v jsonb;
  v_person uuid;
  v_mark bigint;
begin
  v := pg_temp.group('Badge', 'PSHD23', 1);
  v_person := (v #>> '{players,0}')::uuid;
  perform pg_temp.token(v_person, 'ExponentPushToken[badge]');

  -- Dois não vistos e um visto antes do Aviso novo; o visto não conta.
  perform pg_temp.as_((v ->> 'owner')::uuid);
  perform pg_temp.new_event((v ->> 'racha')::uuid, 23);
  perform pg_temp.aviso(v_person, (v ->> 'racha')::uuid);
  perform pg_temp.aviso(v_person, (v ->> 'racha')::uuid);
  update public.notification n set seen_at = now()
  where n.id = (select n2.id from public.notification n2
    where n2.recipient_id = v_person order by n2.created_at limit 1);

  v_mark := pg_temp.queue_mark();
  perform pg_temp.aviso(v_person, (v ->> 'racha')::uuid);
  perform pg_temp.assert_that(
    (select (i ->> 'badge')::integer from pg_temp.items(v_mark) i) = 3,
    'com 2 não vistos, o push novo leva badge 3'
  );
  raise notice 'PASS: badge é o contador de não vistos já com o Aviso novo';
end $$;

-- ============================================================
-- Caso 16. Rollback não deixa push na fila
-- ============================================================
do $$
declare
  v jsonb;
  v_person uuid;
  v_mark bigint;
begin
  v := pg_temp.group('Desfeito', 'PSHE23', 1);
  v_person := (v #>> '{players,0}')::uuid;
  perform pg_temp.token(v_person, 'ExponentPushToken[desfeito]');

  v_mark := pg_temp.queue_mark();
  perform pg_temp.as_((v ->> 'owner')::uuid);
  begin
    perform pg_temp.new_event((v ->> 'racha')::uuid, 27);
    raise exception 'falha depois do Aviso';
  exception when others then
    null;
  end;
  perform pg_temp.assert_that(
    not exists (select 1 from public.notification n where n.recipient_id = v_person)
    and not exists (select 1 from pg_temp.queued(v_mark)),
    'operação desfeita não deixa Aviso nem linha na fila'
  );
  raise notice 'PASS: rollback não manda push';
end $$;

-- ============================================================
-- Sem segredos no Vault: o Aviso é gravado e nada vai para a fila
-- ============================================================
do $$
declare
  v jsonb;
  v_person uuid;
  v_mark bigint;
begin
  v := pg_temp.group('Cofre', 'PSHF23', 1);
  v_person := (v #>> '{players,0}')::uuid;
  perform pg_temp.token(v_person, 'ExponentPushToken[cofre]');

  delete from vault.secrets where name in ('push_function_url', 'push_function_secret');
  v_mark := pg_temp.queue_mark();
  perform pg_temp.as_((v ->> 'owner')::uuid);
  perform pg_temp.new_event((v ->> 'racha')::uuid, 28);
  perform pg_temp.assert_that(
    exists (select 1 from public.notification n where n.recipient_id = v_person)
    and not exists (select 1 from net.http_request_queue q where q.id > v_mark),
    'sem segredo: Aviso gravado, nenhuma chamada'
  );

  perform vault.create_secret('http://push.test/send-push', 'push_function_url');
  perform vault.create_secret('segredo-de-teste', 'push_function_secret');
  raise notice 'PASS: sem segredo no Vault o Aviso é gravado e o push não sai';
end $$;

-- ============================================================
-- Caso 4 e Foco 2. Token reaproveitado fica só com o Perfil novo
-- ============================================================
do $$
declare
  v_a uuid := pg_temp.person('Dono Do Aparelho');
  v_b uuid := pg_temp.person('Novo Do Aparelho');
begin
  perform pg_temp.token(v_a, 'ExponentPushToken[aparelho]');
  perform pg_temp.as_(v_b);
  perform public.register_push_token('ExponentPushToken[aparelho]', 'ios');
  perform pg_temp.assert_that(
    (select count(*) from public.push_token t where t.token = 'ExponentPushToken[aparelho]') = 1
    and (select t.profile_id from public.push_token t
      where t.token = 'ExponentPushToken[aparelho]') = v_b
    and (select t.platform from public.push_token t
      where t.token = 'ExponentPushToken[aparelho]') = 'ios',
    'register_push_token de B com o token de A deixa o token só com B'
  );
  perform pg_temp.assert_that(
    pg_temp.err($q$select public.register_push_token('ExponentPushToken[x]', 'web')$q$) <> 'ok',
    'plataforma fora de ios e android é recusada'
  );
  raise notice 'PASS: token reaproveitado passa ao Perfil novo';
end $$;

-- ============================================================
-- Caso 18. Ninguém apaga nem silencia pelo outro
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_outsider uuid := pg_temp.person('Fora Do Racha');
begin
  v := pg_temp.group('Alheio', 'PSHG23', 0);
  v_owner := (v ->> 'owner')::uuid;
  perform pg_temp.token(v_owner, 'ExponentPushToken[do-dono]');
  perform pg_temp.token(v_owner, 'ExponentPushToken[outro-aparelho]');

  perform pg_temp.as_(v_outsider);
  perform public.unregister_push_token('ExponentPushToken[do-dono]');
  perform pg_temp.assert_that(
    exists (select 1 from public.push_token t
      where t.token = 'ExponentPushToken[do-dono]' and t.profile_id = v_owner),
    'unregister_push_token com token alheio não apaga'
  );
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.set_racha_push_muted(%L, true)', v ->> 'racha')) = 'not_allowed',
    'set_racha_push_muted de quem não é Membro dá not_allowed'
  );

  perform pg_temp.as_(v_owner);
  perform public.unregister_push_token('ExponentPushToken[do-dono]');
  perform pg_temp.assert_that(
    not exists (select 1 from public.push_token t where t.token = 'ExponentPushToken[do-dono]')
    and exists (select 1 from public.push_token t where t.token = 'ExponentPushToken[outro-aparelho]'),
    'sair da conta apaga só o token deste aparelho'
  );

  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.assert_that(
    pg_temp.err($q$select public.register_push_token('ExponentPushToken[x]', 'ios')$q$) = 'not_allowed'
    and pg_temp.err($q$select public.unregister_push_token('ExponentPushToken[x]')$q$) = 'not_allowed'
    and pg_temp.err(format('select public.get_racha_push_muted(%L)', v ->> 'racha')) = 'not_allowed'
    and pg_temp.err(format('select public.open_notification(%L)', gen_random_uuid())) = 'not_allowed',
    'sem sessão, as RPCs do push dão not_allowed'
  );
  raise notice 'PASS: ninguém apaga token nem silencia pelo outro';
end $$;

-- ============================================================
-- Caso 11. open_notification: só o destinatário, marca só aquele
-- ============================================================
do $$
declare
  v jsonb;
  v_owner uuid;
  v_person uuid;
  v_racha uuid;
  v_first uuid;
  v_second uuid;
  v_seen timestamptz;
  v_open jsonb;
begin
  v := pg_temp.group('Toque', 'PSHH23', 1);
  v_owner := (v ->> 'owner')::uuid;
  v_person := (v #>> '{players,0}')::uuid;
  v_racha := (v ->> 'racha')::uuid;

  perform pg_temp.as_(v_owner);
  perform pg_temp.new_event(v_racha, 29);
  perform pg_temp.aviso(v_person, v_racha);
  select n.id into v_first from public.notification n
  where n.recipient_id = v_person and n.kind = 'event_created';
  select n.id into v_second from public.notification n
  where n.recipient_id = v_person and n.kind = 'event_cancelled';

  perform pg_temp.assert_that(
    pg_temp.err(format('select public.open_notification(%L)', v_first)) = 'not_found'
    and pg_temp.err(format('select public.open_notification(%L)', gen_random_uuid())) = 'not_found',
    'open_notification de outro Perfil ou de id inexistente dá not_found'
  );

  perform pg_temp.as_(v_person);
  v_open := public.open_notification(v_first);
  perform pg_temp.assert_that(
    v_open = jsonb_build_object(
      'kind', 'event_created', 'racha_id', v_racha,
      'event_id', (select n.event_id from public.notification n where n.id = v_first),
      'target', 'available'
    ),
    'open_notification devolve kind, racha_id, event_id e target'
  );
  select n.seen_at into v_seen from public.notification n where n.id = v_first;
  perform pg_temp.assert_that(
    v_seen is not null
    and (select n.seen_at from public.notification n where n.id = v_second) is null
    and public.get_unseen_notifications_count() = 1,
    'o toque marca só aquele Aviso'
  );
  perform public.open_notification(v_first);
  perform pg_temp.assert_that(
    (select n.seen_at from public.notification n where n.id = v_first) = v_seen,
    'tocar de novo não muda o seen_at'
  );
  perform public.set_racha_push_muted(v_racha, true);

  -- Fora do Racha e com o Racha excluído, o destino segue o get_notifications.
  perform pg_temp.as_(v_owner);
  perform public.expel_member(v_racha, v_person);
  perform pg_temp.as_(v_person);
  perform pg_temp.assert_that(
    public.open_notification(v_second) ->> 'target' = 'not_member'
    and (select x ->> 'target' from jsonb_array_elements(public.get_notifications()) x
      where x ->> 'id' = v_second::text) = 'not_member',
    'não Membro: not_member no toque e na aba'
  );
  delete from public.racha where id = v_racha;
  perform pg_temp.assert_that(
    public.open_notification(v_second) ->> 'target' = 'racha_deleted'
    and (select x ->> 'target' from jsonb_array_elements(public.get_notifications()) x
      where x ->> 'id' = v_second::text) = 'racha_deleted',
    'Racha excluído: racha_deleted no toque e na aba'
  );
  perform pg_temp.assert_that(
    not exists (select 1 from public.racha_push_mute pm where pm.racha_id = v_racha),
    'excluir o Racha apaga os silêncios dele'
  );
  raise notice 'PASS: open_notification marca só aquele Aviso e devolve o destino da aba';
end $$;

rollback;
