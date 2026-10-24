-- Chave PIX do Racha e do Evento, e a leitura do Pagar (get_payment).
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/pix_key.sql
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

create function pg_temp.person(p_name text, p_verified boolean default false) returns uuid
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
  if p_verified then
    update public.profile set email_verified_at = now() where id = v_id;
  end if;
  return v_id;
end $$;

create function pg_temp.racha(p_name text, p_code text) returns uuid
language sql as $$
  insert into public.racha
    (name, invite_code, place, weekday, kickoff_time, is_paid, price, spot_limit,
     monthly_price, outfield_per_team, payer_target)
  values (p_name, p_code, 'Quadra ' || p_name, 1, '19:00', true, 25, 20, 100, 5, 2)
  returning id
$$;

create function pg_temp.member(p_racha uuid, p_profile uuid, p_role public.member_role)
returns void
language sql as $$
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (p_racha, p_profile, p_role, 'OUTFIELD', 'ANY', 3)
$$;

-- Evento direto na tabela, para ter vários abertos e um encerrado no mesmo Racha.
create function pg_temp.event(
  p_racha uuid, p_status public.event_status, p_conductor uuid, p_days integer,
  p_paid boolean default true
) returns uuid
language sql as $$
  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, ended_at, ended_by,
    is_paid, price, spot_limit, payer_target, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule,
    tie_return_order, consider_position, match_duration_min
  )
  select r.id, current_date + p_days, time '19:00', r.place, p_status, p_conductor,
    case when p_status = 'finished' then now() end,
    case when p_status = 'finished' then p_conductor end,
    p_paid, case when p_paid then r.price end, r.spot_limit,
    case when p_paid then r.payer_target end,
    r.reminder_lead_hours, r.outfield_per_team, r.game_mode,
    r.max_consecutive_wins, r.tie_rule, r.tie_return_order,
    r.consider_position, r.match_duration_min
  from public.racha r where r.id = p_racha
  returning id
$$;

create function pg_temp.event_key(p_event uuid) returns text
language sql as $$
  select coalesce(e.pix_key || '|' || e.pix_key_type, 'null')
  from public.event e where e.id = p_event
$$;

create function pg_temp.racha_key(p_racha uuid) returns text
language sql as $$
  select coalesce(
    (select k.pix_key || '|' || k.pix_key_type from private.racha_pix_key k
     where k.racha_id = p_racha),
    'null')
$$;

create function pg_temp.event_holder(p_event uuid) returns text
language sql as $$
  select coalesce(e.pix_key_holder, 'null') from public.event e where e.id = p_event
$$;

create function pg_temp.racha_holder(p_racha uuid) returns text
language sql as $$
  select coalesce(
    (select k.pix_key_holder from private.racha_pix_key k where k.racha_id = p_racha),
    'null')
$$;

create function pg_temp.norm(p_raw text) returns text
language plpgsql as $$
declare
  v record;
begin
  select * into v from private.normalize_pix_key(p_raw);
  return v.key || '|' || v.type;
exception when others then
  return sqlerrm;
end $$;

-- ============================================================
-- 1. Normalização: os mesmos casos de packages/domain/src/pix/pix-key.test.ts
-- ============================================================
do $$
declare
  v_case record;
begin
  for v_case in
    select * from (values
      ('529.982.247-25', '52998224725|cpf'),
      ('52998224725', '52998224725|cpf'),
      ('529.982.247-24', 'invalid_pix_key'),
      ('11.222.333/0001-81', '11222333000181|cnpj'),
      ('11.222.333/0001-82', 'invalid_pix_key'),
      (' ANA@X.COM ', 'ana@x.com|email'),
      (repeat('a', 72) || '@x.com', 'invalid_pix_key'),
      (repeat('a', 71) || '@x.com', repeat('a', 71) || '@x.com|email'),
      ('joão@x.com', 'invalid_pix_key'),
      ('sem-arroba.com', 'invalid_pix_key'),
      ('a@b', 'invalid_pix_key'),
      ('a@b@c.co', 'invalid_pix_key'),
      ('(11) 99999-9999', '+5511999999999|phone'),
      ('  (11) 99999-9999 ', '+5511999999999|phone'),
      ('11999999999', '+5511999999999|phone'),
      ('+5511999999999', '+5511999999999|phone'),
      ('+55 (11) 99999-9999', '+5511999999999|phone'),
      ('1199999999', 'invalid_pix_key'),
      ('(11) 3333-4444', 'invalid_pix_key'),
      ('+551133334444', 'invalid_pix_key'),
      ('+5511999', 'invalid_pix_key'),
      ('11900000083', '11900000083|cpf'),
      ('(11) 90000-0083', '+5511900000083|phone'),
      ('+5511900000083', '+5511900000083|phone'),
      ('123E4567-E89B-42D3-A456-426614174000', '123e4567-e89b-42d3-a456-426614174000|random'),
      ('123e4567-e89b-12d3-a456-426614174000', 'invalid_pix_key'),
      ('', 'invalid_pix_key'),
      ('   ', 'invalid_pix_key'),
      ('abc', 'invalid_pix_key'),
      (null, 'invalid_pix_key')
    ) t(raw, expected)
  loop
    perform pg_temp.assert_that(pg_temp.norm(v_case.raw) = v_case.expected,
      format('normalize %L: esperado %s, veio %s',
        v_case.raw, v_case.expected, pg_temp.norm(v_case.raw)));
  end loop;
  raise notice 'PASS: 1 normalização igual ao domínio';
end $$;

-- ============================================================
-- 2..10. Chave no Racha, nos Eventos, papéis e Passagem
-- ============================================================
do $$
declare
  v_owner uuid := pg_temp.person('Dono Pix', true);
  v_admin uuid := pg_temp.person('Admin Pix', true);
  v_player uuid := pg_temp.person('Jogador Pix', true);
  v_owner2 uuid := pg_temp.person('Dono Sem Email');
  v_racha uuid := pg_temp.racha('Racha Pix', 'PXPXPA');
  v_racha2 uuid := pg_temp.racha('Racha Pix Dois', 'PXPXPB');
  v_active uuid;
  v_fin uuid;
  v_up uuid;
  v_next uuid;
  v_row record;
  v_err text;
  v_count integer;
begin
  perform pg_temp.member(v_racha, v_owner, 'OWNER');
  perform pg_temp.member(v_racha, v_admin, 'ADMIN');
  perform pg_temp.member(v_racha, v_player, 'PLAYER');
  perform pg_temp.member(v_racha2, v_owner2, 'OWNER');

  -- Eventos antes de existir chave: nascem sem.
  v_active := pg_temp.event(v_racha, 'active', v_owner, 0);
  v_fin := pg_temp.event(v_racha, 'finished', v_owner, -7);
  update public.event set pix_key = 'antiga@x.com', pix_key_type = 'email', pix_key_holder = 'Antigo' where id = v_fin;
  perform pg_temp.assert_that(pg_temp.event_key(v_active) = 'null', 'evento sem chave no Racha nasce sem');

  -- 2. set_racha_pix_key: travas
  perform pg_temp.as_(v_owner2);
  v_err := pg_temp.err(format('select public.set_racha_pix_key(%L, %L, %L)', v_racha2, 'ana@x.com', 'Ana Titular'));
  perform pg_temp.assert_that(v_err = 'email_not_verified', 'Dono não confirmado: ' || v_err);
  perform pg_temp.as_(v_admin);
  v_err := pg_temp.err(format('select public.set_racha_pix_key(%L, %L, %L)', v_racha, 'ana@x.com', 'Ana Titular'));
  perform pg_temp.assert_that(v_err = 'not_owner', 'Admin: ' || v_err);
  perform pg_temp.as_(v_player);
  v_err := pg_temp.err(format('select public.set_racha_pix_key(%L, %L, %L)', v_racha, 'ana@x.com', 'Ana Titular'));
  perform pg_temp.assert_that(v_err = 'not_owner', 'Jogador: ' || v_err);
  perform pg_temp.as_(v_owner);
  v_err := pg_temp.err(format('select public.set_racha_pix_key(%L, %L, %L)', v_racha, '529.982.247-24', 'Ana Titular'));
  perform pg_temp.assert_that(v_err = 'invalid_pix_key', 'chave inválida: ' || v_err);
  perform pg_temp.assert_that(pg_temp.racha_key(v_racha) = 'null', 'nada gravado nas recusas');
  raise notice 'PASS: 2 set_racha_pix_key recusa não confirmado, Admin, Jogador e inválida';

  -- 2b. Com chave, o titular é obrigatório: 2 a 60 caracteres depois de aparar
  v_err := pg_temp.err(format('select public.set_racha_pix_key(%L, %L, null)', v_racha, 'ana@x.com'));
  perform pg_temp.assert_that(v_err = 'invalid_pix_key_holder', 'titular nulo: ' || v_err);
  v_err := pg_temp.err(format('select public.set_racha_pix_key(%L, %L, %L)', v_racha, 'ana@x.com', '  A  '));
  perform pg_temp.assert_that(v_err = 'invalid_pix_key_holder', 'titular de 1: ' || v_err);
  v_err := pg_temp.err(format('select public.set_racha_pix_key(%L, %L, %L)', v_racha, 'ana@x.com', repeat('a', 61)));
  perform pg_temp.assert_that(v_err = 'invalid_pix_key_holder', 'titular de 61: ' || v_err);
  perform pg_temp.assert_that(pg_temp.racha_key(v_racha) = 'null', 'nada gravado sem titular');
  raise notice 'PASS: 2b titular obrigatório e com tamanho';

  -- 3. Gravar no Racha normaliza e copia para os abertos; o encerrado fica
  perform public.set_racha_pix_key(v_racha, ' ANA@X.COM ', '  Ana Titular ');
  perform pg_temp.assert_that(pg_temp.racha_key(v_racha) = 'ana@x.com|email', 'Racha normalizado');
  perform pg_temp.assert_that(pg_temp.racha_holder(v_racha) = 'Ana Titular', 'titular aparado');
  perform pg_temp.assert_that(pg_temp.event_key(v_active) = 'ana@x.com|email', 'active recebe');
  perform pg_temp.assert_that(pg_temp.event_holder(v_active) = 'Ana Titular', 'active recebe o titular');
  perform pg_temp.assert_that(pg_temp.event_key(v_fin) = 'antiga@x.com|email', 'finished intocado');
  perform pg_temp.assert_that(pg_temp.event_holder(v_fin) = 'Antigo', 'titular do finished intocado');
  raise notice 'PASS: 3 chave do Racha vai para os Eventos abertos';

  -- 4. create_event nasce com a chave do Racha
  v_up := public.create_event(v_racha, current_date + 3, time '19:00', 'Quadra Racha Pix',
    true, 25, null::smallint, 2);
  perform pg_temp.assert_that(pg_temp.event_key(v_up) = 'ana@x.com|email', 'create_event copia');
  perform pg_temp.assert_that(pg_temp.event_holder(v_up) = 'Ana Titular', 'create_event copia o titular');
  raise notice 'PASS: 4 create_event copia a chave';

  -- 5. set_event_pix_key
  v_err := pg_temp.err(format('select public.set_event_pix_key(%L, %L, %L)', v_up, 'bia@x.com', 'B'));
  perform pg_temp.assert_that(v_err = 'invalid_pix_key_holder', 'titular curto no Evento: ' || v_err);
  perform public.set_event_pix_key(v_up, '(11) 99999-9999', ' Bia do Dia ');
  perform pg_temp.assert_that(pg_temp.event_key(v_up) = '+5511999999999|phone', 'chave do dia');
  perform pg_temp.assert_that(pg_temp.event_holder(v_up) = 'Bia do Dia', 'titular do dia');
  perform pg_temp.assert_that(pg_temp.racha_holder(v_racha) = 'Ana Titular', 'titular do Racha não muda');
  perform pg_temp.assert_that(pg_temp.racha_key(v_racha) = 'ana@x.com|email', 'Racha não muda');
  v_err := pg_temp.err(format('select public.set_event_pix_key(%L, %L, %L)', v_fin, 'ana@x.com', 'Ana Titular'));
  perform pg_temp.assert_that(v_err = 'event_closed', 'finished: ' || v_err);
  v_err := pg_temp.err(format('select public.set_event_pix_key(%L, %L, %L)', v_up, 'xx', 'Ana Titular'));
  perform pg_temp.assert_that(v_err = 'invalid_pix_key', 'inválida no Evento: ' || v_err);
  update public.profile set email_verified_at = null where id = v_owner;
  v_err := pg_temp.err(format('select public.set_event_pix_key(%L, %L, %L)', v_up, 'ana@x.com', 'Ana Titular'));
  perform pg_temp.assert_that(v_err = 'email_not_verified', 'Dono não confirmado no Evento: ' || v_err);
  update public.profile set email_verified_at = now() where id = v_owner;
  perform pg_temp.as_(v_admin);
  v_err := pg_temp.err(format('select public.set_event_pix_key(%L, %L, %L)', v_up, 'ana@x.com', 'Ana Titular'));
  perform pg_temp.assert_that(v_err = 'not_owner', 'Admin no Evento: ' || v_err);
  perform pg_temp.assert_that(pg_temp.event_key(v_up) = '+5511999999999|phone', 'recusas não mudam');
  raise notice 'PASS: 5 set_event_pix_key só do Dono confirmado, só aberto';

  -- 6. Trocar no Racha sobrescreve até a chave própria do Evento (decisão 10)
  perform pg_temp.as_(v_owner);
  perform public.set_racha_pix_key(v_racha, '529.982.247-25', 'Liandra');
  perform pg_temp.assert_that(pg_temp.event_key(v_up) = '52998224725|cpf', 'upcoming sobrescrito');
  perform pg_temp.assert_that(pg_temp.event_holder(v_up) = 'Liandra'
    and pg_temp.event_holder(v_active) = 'Liandra', 'titular dos abertos sobrescrito');
  perform pg_temp.assert_that(pg_temp.event_holder(v_fin) = 'Antigo', 'titular do finished intocado 2');
  perform pg_temp.assert_that(pg_temp.event_key(v_active) = '52998224725|cpf', 'active sobrescrito');
  perform pg_temp.assert_that(pg_temp.event_key(v_fin) = 'antiga@x.com|email', 'finished intocado 2');
  raise notice 'PASS: 6 trocar no Racha sobrescreve os abertos';

  -- 7. Admin salvando Evento e Logística não mexe na chave
  perform pg_temp.as_(v_admin);
  perform public.update_event(v_up, current_date + 4, time '20:00', 'Quadra Nova',
    true, 30, null::smallint, 2);
  perform public.update_racha_logistics(v_racha, 'Quadra Racha Pix', 1::smallint,
    time '19:00', null::smallint, true, 25, 100, 20::smallint, 2);
  perform pg_temp.assert_that(pg_temp.event_key(v_up) = '52998224725|cpf', 'update_event mantém');
  perform pg_temp.assert_that(pg_temp.racha_key(v_racha) = '52998224725|cpf', 'logística mantém');
  raise notice 'PASS: 7 Admin salva Evento e Logística sem apagar a chave';

  -- 8. Pago → grátis guarda a chave; grátis sem chave → pago pega a do Racha
  perform public.update_event(v_up, current_date + 4, time '20:00', 'Quadra Nova',
    false, null::integer, null::smallint, null::integer);
  perform pg_temp.assert_that(pg_temp.event_key(v_up) = '52998224725|cpf', 'grátis guarda');
  update public.event set pix_key = null, pix_key_type = null, pix_key_holder = null where id = v_up;
  perform public.update_event(v_up, current_date + 4, time '20:00', 'Quadra Nova',
    true, 25, null::smallint, 2);
  perform pg_temp.assert_that(pg_temp.event_key(v_up) = '52998224725|cpf', 'vira pago e copia');
  perform pg_temp.assert_that(pg_temp.event_holder(v_up) = 'Liandra', 'vira pago e copia o titular');
  raise notice 'PASS: 8 Evento que vira pago pega a chave do Racha';

  -- 9. Leituras: Dono e Admin leem; Jogador não
  perform pg_temp.as_(v_owner);
  select * into v_row from public.get_racha_pix_key(v_racha);
  perform pg_temp.assert_that(v_row.pix_key = '52998224725' and v_row.pix_key_type = 'cpf'
    and v_row.pix_key_holder = 'Liandra' and v_row.has_open_event_key, 'get_racha_pix_key do Dono');
  select count(*) into v_count from public.list_open_events(v_racha) e
    where e.pix_key = '52998224725' and e.pix_key_type = 'cpf' and e.pix_key_holder = 'Liandra';
  perform pg_temp.assert_that(v_count = 2, 'list_open_events do Dono traz a chave');
  perform pg_temp.as_(v_admin);
  select * into v_row from public.get_racha_pix_key(v_racha);
  perform pg_temp.assert_that(v_row.pix_key = '52998224725' and v_row.pix_key_holder = 'Liandra',
    'get_racha_pix_key do Admin');
  select count(*) into v_count from public.list_open_events(v_racha) e
    where e.pix_key is not null and e.pix_key_holder = 'Liandra';
  perform pg_temp.assert_that(v_count = 2, 'list_open_events do Admin traz a chave');
  perform pg_temp.as_(v_player);
  v_err := pg_temp.err(format('select public.get_racha_pix_key(%L)', v_racha));
  perform pg_temp.assert_that(v_err = 'not_allowed', 'get_racha_pix_key do Jogador: ' || v_err);
  select count(*) into v_count from public.list_open_events(v_racha) e
    where e.pix_key is null and e.pix_key_type is null and e.pix_key_holder is null;
  perform pg_temp.assert_that(v_count = 2, 'list_open_events do Jogador sem chave');
  set local role authenticated;
  v_err := pg_temp.err('select * from private.racha_pix_key');
  reset role;
  perform pg_temp.assert_that(v_err like 'permission denied%', 'Jogador lê a tabela: ' || v_err);
  raise notice 'PASS: 9 só Dono e Admin leem a chave';

  -- 10. Chave vazia apaga do Racha e dos abertos
  perform pg_temp.as_(v_owner);
  perform public.set_racha_pix_key(v_racha, '  ', 'Ana Titular');
  perform pg_temp.assert_that(pg_temp.racha_key(v_racha) = 'null', 'Racha apagado');
  perform pg_temp.assert_that(pg_temp.event_key(v_up) = 'null' and pg_temp.event_key(v_active) = 'null',
    'abertos apagados');
  perform pg_temp.assert_that(pg_temp.event_holder(v_up) = 'null' and pg_temp.event_holder(v_active) = 'null',
    'titular dos abertos apagado');
  perform public.set_event_pix_key(v_up, 'bia@x.com', 'Bia do Dia');
  perform public.set_event_pix_key(v_up, '', '');
  perform pg_temp.assert_that(pg_temp.event_key(v_up) = 'null' and pg_temp.event_holder(v_up) = 'null',
    'chave vazia no Evento apaga o titular');
  v_err := pg_temp.err(format(
    'update public.event set pix_key_holder = %L where id = %L', 'Antigo', v_up));
  perform pg_temp.assert_that(v_err like '%event_pix_key_holder_both%', 'titular sem chave: ' || v_err);
  v_err := pg_temp.err(format(
    'update public.event set pix_key_holder = %L where id = %L', 'A', v_fin));
  perform pg_temp.assert_that(v_err like '%event_pix_key_holder_length%', 'titular de 1 no Evento: ' || v_err);
  perform pg_temp.assert_that(pg_temp.event_key(v_fin) = 'antiga@x.com|email', 'finished intocado 3');
  select * into v_row from public.get_racha_pix_key(v_racha);
  perform pg_temp.assert_that(v_row.pix_key is null and not v_row.has_open_event_key,
    'get_racha_pix_key sem chave');
  raise notice 'PASS: 10 chave vazia apaga';

  -- 11. Recorrência nasce com a chave do Racha
  perform public.set_racha_pix_key(v_racha, '11.222.333/0001-81', repeat('L', 60));
  delete from public.event where id = v_up;
  v_next := private.create_next_recurring_event(v_racha, v_fin, current_date - 7,
    time '19:00', now());
  perform pg_temp.assert_that(pg_temp.event_key(v_next) = '11222333000181|cnpj', 'recorrência copia');
  perform pg_temp.assert_that(pg_temp.event_holder(v_next) = repeat('L', 60), 'recorrência copia o titular de 60');
  raise notice 'PASS: 11 recorrência copia a chave';

  -- 12. Passagem apaga a chave do Racha e de todos os Eventos, também do encerrado
  perform public.transfer_ownership(v_racha, v_admin);
  perform pg_temp.assert_that(pg_temp.racha_key(v_racha) = 'null', 'Passagem apaga do Racha');
  perform pg_temp.assert_that(pg_temp.event_key(v_next) = 'null' and pg_temp.event_key(v_active) = 'null',
    'Passagem apaga dos abertos');
  perform pg_temp.assert_that(pg_temp.event_key(v_fin) = 'null', 'Passagem apaga do encerrado');
  perform pg_temp.assert_that(pg_temp.racha_holder(v_racha) = 'null'
    and pg_temp.event_holder(v_next) = 'null' and pg_temp.event_holder(v_active) = 'null'
    and pg_temp.event_holder(v_fin) = 'null', 'Passagem apaga o titular');
  raise notice 'PASS: 12 Passagem apaga a chave';
end $$;

-- ============================================================
-- 13..19. get_payment: o que o Pagar mostra a quem está no Evento
-- ============================================================
do $$
declare
  v_owner uuid := pg_temp.person('Dono Pagar', true);
  v_a uuid := pg_temp.person('Jogador Cheio');
  v_b uuid := pg_temp.person('Jogador Dez');
  v_c uuid := pg_temp.person('Jogador Trinta');
  v_d uuid := pg_temp.person('Jogador Mensal');
  v_w uuid := pg_temp.person('Jogador Espera');
  v_out uuid := pg_temp.person('Jogador Fora');
  v_stranger uuid := pg_temp.person('Sem Racha');
  v_racha uuid := pg_temp.racha('Racha Pagar', 'PXPGAA');
  v_event uuid;
  v_free uuid;
  v_closed uuid;
  v_p uuid;
  v_row record;
  v_err text;
begin
  perform pg_temp.member(v_racha, v_owner, 'OWNER');
  foreach v_p in array array[v_a, v_b, v_c, v_d, v_w, v_out] loop
    perform pg_temp.member(v_racha, v_p, 'PLAYER');
  end loop;

  perform pg_temp.as_(v_owner);
  perform public.set_racha_pix_key(v_racha, 'ana@x.com', 'Liandra Souza');
  v_event := pg_temp.event(v_racha, 'upcoming', null, 3);
  perform public.set_monthly_pass(v_racha, v_d,
    (select private.event_civil_year_month(e.starts_on, e.starts_at)
     from public.event e where e.id = v_event), true);

  foreach v_p in array array[v_owner, v_a, v_b, v_c, v_d] loop
    perform pg_temp.as_(v_p);
    perform public.confirm_attendance(v_event);
  end loop;
  insert into public.event_attendance (event_id, profile_id, status, waitlisted_at)
  values (v_event, v_w, 'waitlisted', now());

  insert into public.racha_credit_entry (
    racha_id, profile_id, source_event_id, operation_key, entry_kind, amount_delta, expires_at
  ) values
    (v_racha, v_b, v_event, 'seed:pix:b', 'cancel_daily', 10, now() + interval '6 months'),
    (v_racha, v_c, v_event, 'seed:pix:c', 'cancel_daily', 30, now() + interval '6 months');

  -- 13. Diária cheia
  perform pg_temp.as_(v_a);
  select * into v_row from public.get_payment(v_event);
  perform pg_temp.assert_that(v_row.daily_price = 25 and v_row.credit_available = 0
    and v_row.amount_due = 25 and not v_row.is_paid and not v_row.is_waitlisted
    and not v_row.is_owner and v_row.recipient_name = 'Liandra Souza'
    and v_row.pix_key = 'ana@x.com' and v_row.pix_key_type = 'email',
    'diária cheia: ' || row_to_json(v_row)::text);
  raise notice 'PASS: 13 diária cheia, sem Crédito';

  -- 14. Crédito parcial e Crédito que cobre a diária
  perform pg_temp.as_(v_b);
  select * into v_row from public.get_payment(v_event);
  perform pg_temp.assert_that(v_row.credit_available = 10 and v_row.credit_balance = 10 and v_row.amount_due = 15,
    'Crédito 10: ' || row_to_json(v_row)::text);
  perform pg_temp.as_(v_c);
  select * into v_row from public.get_payment(v_event);
  perform pg_temp.assert_that(v_row.credit_available = 25 and v_row.credit_balance = 30 and v_row.amount_due = 0,
    'Crédito 30: ' || row_to_json(v_row)::text);
  raise notice 'PASS: 14 Crédito abatido até a diária';

  -- 15. "A pagar" bate com o que o pagou desconta
  perform pg_temp.as_(v_owner);
  perform public.set_attendance_paid(v_event, v_b, null, true);
  perform pg_temp.assert_that((select f.cash_paid_amount = 15 and f.credit_applied_amount = 10
    from public.event_payment_fact f where f.event_id = v_event and f.profile_id = v_b),
    'pagou desconta o mesmo Crédito');
  perform pg_temp.as_(v_b);
  select * into v_row from public.get_payment(v_event);
  perform pg_temp.assert_that(v_row.is_paid, 'marcado como pago');
  raise notice 'PASS: 15 A pagar igual ao que o pagou desconta';

  -- 16. Passe mensal conta como pago; Lista de espera
  perform pg_temp.as_(v_d);
  select * into v_row from public.get_payment(v_event);
  perform pg_temp.assert_that(v_row.is_paid, 'passe mensal: ' || row_to_json(v_row)::text);
  perform pg_temp.as_(v_w);
  select * into v_row from public.get_payment(v_event);
  perform pg_temp.assert_that(v_row.is_waitlisted and v_row.amount_due = 25,
    'Lista de espera: ' || row_to_json(v_row)::text);
  raise notice 'PASS: 16 passe mensal e Lista de espera';

  -- 17. Quem não está no Evento não lê
  perform pg_temp.as_(v_out);
  v_err := pg_temp.err(format('select * from public.get_payment(%L)', v_event));
  perform pg_temp.assert_that(v_err = 'not_in_event', 'Membro fora do Evento: ' || v_err);
  perform pg_temp.as_(v_stranger);
  v_err := pg_temp.err(format('select * from public.get_payment(%L)', v_event));
  perform pg_temp.assert_that(v_err = 'not_in_event', 'fora do Racha: ' || v_err);
  v_err := pg_temp.err(format('select * from public.get_payment(%L)', gen_random_uuid()));
  perform pg_temp.assert_that(v_err = 'not_in_event', 'Evento inexistente: ' || v_err);
  raise notice 'PASS: 17 not_in_event';

  -- 18. O Dono chamando
  perform pg_temp.as_(v_owner);
  select * into v_row from public.get_payment(v_event);
  perform pg_temp.assert_that(v_row.is_owner, 'Dono: ' || row_to_json(v_row)::text);
  raise notice 'PASS: 18 is_owner';

  -- 19. Evento grátis não entrega a chave
  delete from public.event where id = v_event;
  v_free := pg_temp.event(v_racha, 'upcoming', null, 3, false);
  perform pg_temp.assert_that(pg_temp.event_key(v_free) = 'ana@x.com|email', 'grátis guarda a chave');
  perform pg_temp.as_(v_a);
  perform public.confirm_attendance(v_free);
  select * into v_row from public.get_payment(v_free);
  perform pg_temp.assert_that(v_row.pix_key is null and v_row.pix_key_type is null
    and v_row.recipient_name = 'Dono Pagar', 'grátis: ' || row_to_json(v_row)::text);
  raise notice 'PASS: 19 Evento grátis sem chave';

  -- 20. Evento encerrado não entrega a chave, nem a quem confirmou
  delete from public.event where id = v_free;
  v_closed := pg_temp.event(v_racha, 'upcoming', null, 3);
  perform public.confirm_attendance(v_closed);
  update public.event
    set status = 'finished', ended_at = now(), ended_by = v_owner, conductor_id = v_owner
    where id = v_closed;
  perform pg_temp.assert_that(pg_temp.event_key(v_closed) = 'ana@x.com|email', 'encerrado guarda a chave');
  select * into v_row from public.get_payment(v_closed);
  perform pg_temp.assert_that(v_row.pix_key is null and v_row.pix_key_type is null,
    'encerrado: ' || row_to_json(v_row)::text);
  raise notice 'PASS: 20 Evento encerrado sem chave';
end $$;

rollback;
