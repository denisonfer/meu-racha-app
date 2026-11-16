-- Plano: quem é Pro, os três tetos que leem dele, o acesso à tabela e o job.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/plan.sql
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

-- Grava a validade do Plano como a Edge Function faria.
create function pg_temp.pro(p uuid, p_until timestamptz) returns void
language sql as $$
  insert into public.subscription (
    profile_id, expires_at, product_id, store, is_trial, will_renew, is_sandbox, sync_source
  ) values (p, p_until, 'pro:mensal', 'PLAY_STORE', false, true, true, 'app')
  on conflict (profile_id) do update set expires_at = excluded.expires_at
$$;

-- create_racha como a sessão atual; devolve 'ok' ou a mensagem do erro.
create function pg_temp.create_racha(p_name text) returns text
language sql as $$
  select pg_temp.err(format(
    'select (public.create_racha(%L, 3::smallint, ''WINNER_STAYS'', 2::smallint, ''BOTH_OUT'', ''TEAM_ORDER'', false, ''Quadra'')).id',
    p_name
  ))
$$;

-- ============================================================
-- Plano
-- ============================================================
do $$
declare
  v_p uuid := pg_temp.person('Pessoa Plano');
  v_plan record;
begin
  perform pg_temp.assert_that(not private.is_pro(v_p), 'sem linha é Free');
  perform pg_temp.pro(v_p, now() + interval '1 day');
  perform pg_temp.assert_that(private.is_pro(v_p), 'validade no futuro é Pro');
  perform pg_temp.pro(v_p, now() - interval '1 second');
  perform pg_temp.assert_that(not private.is_pro(v_p), 'validade passada é Free');
  perform pg_temp.pro(v_p, now());
  perform pg_temp.assert_that(not private.is_pro(v_p), 'validade igual a agora é Free');

  v_p := pg_temp.person('Pessoa Sem Plano');
  perform pg_temp.as_(v_p);
  perform pg_temp.assert_that((select count(*) from public.get_my_plan()) = 1, 'get_my_plan sempre devolve 1 linha');
  select * into v_plan from public.get_my_plan();
  perform pg_temp.assert_that(
    v_plan.is_pro = false and v_plan.expires_at is null and v_plan.product_id is null
    and v_plan.owned_racha_count = 0 and v_plan.can_create_racha,
    'sem linha: Free, campos da assinatura nulos e pode criar o primeiro Racha'
  );

  perform pg_temp.assert_that(pg_temp.create_racha('Racha Primeiro') = 'ok', 'Free cria o primeiro Racha');
  perform pg_temp.assert_that(
    not (select can_create_racha from public.get_my_plan()),
    'can_create_racha falso com 1 Racha e Free'
  );
  perform pg_temp.pro(v_p, now() + interval '1 day');
  perform pg_temp.assert_that(
    (select can_create_racha and is_pro from public.get_my_plan()),
    'can_create_racha verdadeiro com 1 Racha e Pro'
  );
  raise notice 'PASS: Plano';
end $$;

-- ============================================================
-- Teto de Rachas
-- ============================================================
do $$
declare
  v_free uuid := pg_temp.person('Dono Free');
  v_ex uuid := pg_temp.person('Dono Ex Pro');
begin
  perform pg_temp.as_(v_free);
  perform pg_temp.assert_that(pg_temp.create_racha('Racha Free Um') = 'ok', 'controle: Free cria o primeiro');
  perform pg_temp.assert_that(
    pg_temp.create_racha('Racha Free Dois') like '%plan_owner_limit%',
    'Free com 1 Racha recebe plan_owner_limit'
  );
  perform pg_temp.pro(v_free, now() + interval '1 day');
  perform pg_temp.assert_that(pg_temp.create_racha('Racha Free Dois') = 'ok', 'Pro cria o segundo Racha');

  perform pg_temp.as_(v_ex);
  perform pg_temp.pro(v_ex, now() + interval '1 day');
  perform pg_temp.assert_that(
    pg_temp.create_racha('Racha Ex Um') = 'ok'
    and pg_temp.create_racha('Racha Ex Dois') = 'ok'
    and pg_temp.create_racha('Racha Ex Tres') = 'ok',
    'controle: Pro cria 3 Rachas'
  );
  perform pg_temp.pro(v_ex, now() - interval '1 day');
  perform pg_temp.assert_that(
    pg_temp.create_racha('Racha Ex Quatro') like '%plan_owner_limit%',
    'ex-Pro com 3 Rachas recebe plan_owner_limit'
  );
  perform pg_temp.assert_that(
    (select owned_racha_count = 3 and not can_create_racha and not is_pro from public.get_my_plan()),
    'ex-Pro: owned_racha_count é 3'
  );
  raise notice 'PASS: teto de Rachas no create_racha';
end $$;

do $$
declare
  v_g jsonb := pg_temp.group('Passe', 'PSSE23', 1);
  v_owner uuid := (v_g ->> 'owner')::uuid;
  v_racha uuid := (v_g ->> 'racha')::uuid;
  v_target uuid := (v_g -> 'players' ->> 0)::uuid;
begin
  perform pg_temp.as_(v_target);
  perform pg_temp.assert_that(pg_temp.create_racha('Racha Do Alvo') = 'ok', 'controle: o alvo já é Dono de outro Racha');

  perform pg_temp.as_(v_owner);
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.transfer_ownership(%L, %L)', v_racha, v_target)) like '%plan_owner_limit%',
    'transfer_ownership para Free que já é Dono recebe plan_owner_limit'
  );
  perform pg_temp.pro(v_target, now() + interval '1 day');
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.transfer_ownership(%L, %L)', v_racha, v_target)) = 'ok',
    'transfer_ownership para Pro que já é Dono passa'
  );
  -- Em assert separado: na mesma expressão, a subconsulta roda antes do err().
  perform pg_temp.assert_that(
    (select m.role from public.member m where m.racha_id = v_racha and m.profile_id = v_target) = 'OWNER',
    'o Pro vira Dono'
  );
  raise notice 'PASS: teto de Rachas no transfer_ownership';
end $$;

-- ============================================================
-- Teto de Admins
-- ============================================================
do $$
declare
  v_g jsonb := pg_temp.group('Admins', 'ADMN23', 3);
  v_owner uuid := (v_g ->> 'owner')::uuid;
  v_racha uuid := (v_g ->> 'racha')::uuid;
  v_p uuid[] := array(select jsonb_array_elements_text(v_g -> 'players')::uuid);
begin
  perform pg_temp.as_(v_owner);
  perform public.update_member(v_racha, v_p[1], 3::smallint, false, 'ADMIN');
  perform public.update_member(v_racha, v_p[2], 3::smallint, false, 'ADMIN');
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.update_member(%L, %L, 3::smallint, false, ''ADMIN'')', v_racha, v_p[3])) like '%admin_limit%',
    'Dono Free com 2 Admins recebe admin_limit no terceiro'
  );
  perform pg_temp.pro(v_owner, now() + interval '1 day');
  perform pg_temp.assert_that(
    pg_temp.err(format('select public.update_member(%L, %L, 3::smallint, false, ''ADMIN'')', v_racha, v_p[3])) = 'ok',
    'Dono Pro promove o terceiro Admin'
  );

  perform pg_temp.assert_that(private.racha_owner_is_pro(v_racha), 'controle: Dono ativo e Pro');
  update public.member set is_active = false where racha_id = v_racha and role = 'OWNER';
  perform pg_temp.assert_that(not private.racha_owner_is_pro(v_racha), 'Dono inativo não conta como Pro');
  raise notice 'PASS: teto de Admins';
end $$;

-- ============================================================
-- Como authenticated
-- ============================================================
do $$
declare
  v_free jsonb := pg_temp.group('Leitura Free', 'LTFR23', 1);
  v_pro jsonb := pg_temp.group('Leitura Pro', 'LTPR23', 1);
  v_reader uuid := (v_free -> 'players' ->> 0)::uuid;
  v_outsider uuid;
  v_row public.racha;
begin
  perform pg_temp.pro((v_pro ->> 'owner')::uuid, now() + interval '1 day');
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values ((v_pro ->> 'racha')::uuid, v_reader, 'PLAYER', 'OUTFIELD', 'ANY', 3);

  perform pg_temp.as_(v_reader);
  set local role authenticated;
  perform pg_temp.assert_that(
    (select r.admin_limit from public.racha r where r.id = (v_free ->> 'racha')::uuid) = 2,
    'admin_limit é 2 com Dono Free'
  );
  perform pg_temp.assert_that(
    exists (select 1 from public.racha r where r.id = (v_pro ->> 'racha')::uuid and r.admin_limit is null),
    'admin_limit é nulo com Dono Pro'
  );
  perform pg_temp.assert_that(
    pg_temp.err('select 1 from public.subscription') like '%permission denied%',
    'authenticated não lê subscription'
  );
  perform pg_temp.assert_that(
    pg_temp.err(format(
      'insert into public.subscription (profile_id, expires_at, product_id, store, is_trial, will_renew, is_sandbox, sync_source) values (%L, now() + interval ''1 year'', ''x'', ''PLAY_STORE'', false, true, false, ''app'')',
      v_reader
    )) like '%permission denied%',
    'authenticated não escreve subscription'
  );
  reset role;

  -- Quem não é Membro não vê o Racha nem, chamando a função direto, o Plano do Dono.
  -- A chamada direta usa o Racha Free: para Membro daria 2, então o nulo vem do filtro.
  select * into v_row from public.racha r where r.id = (v_free ->> 'racha')::uuid;
  v_outsider := pg_temp.person('Pessoa De Fora');
  perform pg_temp.as_(v_outsider);
  set local role authenticated;
  perform pg_temp.assert_that(
    not exists (select 1 from public.racha r where r.id = (v_pro ->> 'racha')::uuid),
    'quem não é Membro não lê o Racha'
  );
  perform pg_temp.assert_that(
    not exists (select public.admin_limit(r) from public.racha r where r.id = (v_pro ->> 'racha')::uuid),
    'quem não é Membro não lê admin_limit pelo select do Racha'
  );
  perform pg_temp.assert_that(
    public.admin_limit(v_row) is null,
    'admin_limit chamado direto por quem não é Membro é nulo'
  );
  reset role;
  raise notice 'PASS: leitura como authenticated';
end $$;

-- ============================================================
-- Job
-- ============================================================
do $$
begin
  delete from vault.secrets where name in ('revenuecat_sync_url', 'revenuecat_sync_secret');
  perform private.request_subscription_sync();
  raise notice 'PASS: job sem segredos no Vault não falha';
end $$;

rollback;
