-- Confirmação de e-mail: só sessão aberta por código OTP recente marca o Perfil.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/email_verified.sql
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

create function pg_temp.as_(p uuid, p_amr jsonb) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p, 'role', 'authenticated', 'amr', p_amr)::text, true);
end $$;

create function pg_temp.otp_at(p_ago interval) returns jsonb
language sql as $$
  select jsonb_build_array(
    jsonb_build_object('method', 'otp',
      'timestamp', floor(extract(epoch from now() - p_ago))::bigint),
    jsonb_build_object('method', 'password',
      'timestamp', floor(extract(epoch from now() - interval '1 day'))::bigint));
$$;

create temp table t_user (id uuid);
insert into t_user values (gen_random_uuid());
insert into auth.users (id, raw_user_meta_data)
select id, jsonb_build_object('display_name', 'Ana Teste', 'birth_date', '1990-01-01',
  'plays_as', 'OUTFIELD', 'primary_position', 'ANY', 'terms_accepted', true)
from t_user;
grant all on t_user to authenticated;

set local role authenticated;

-- 1. Sessão por senha: recusada.
select pg_temp.as_((select id from t_user),
  '[{"method":"password","timestamp":1}]'::jsonb);
select pg_temp.assert_that(
  pg_temp.err('select public.confirm_email_verified()') = 'email_not_verified',
  'senha não confirma');

-- 2. Sem amr: recusada.
select pg_temp.as_((select id from t_user), 'null'::jsonb);
select pg_temp.assert_that(
  pg_temp.err('select public.confirm_email_verified()') = 'email_not_verified',
  'sem amr não confirma');

-- 3. OTP de 11 minutos atrás: recusada.
select pg_temp.as_((select id from t_user), pg_temp.otp_at(interval '11 minutes'));
select pg_temp.assert_that(
  pg_temp.err('select public.confirm_email_verified()') = 'email_not_verified',
  'otp vencido não confirma');
select pg_temp.assert_that(
  (select email_verified_at is null from public.profile where id = (select id from t_user)),
  'nada gravado até aqui');

-- 4. OTP de agora: grava.
select pg_temp.as_((select id from t_user), pg_temp.otp_at(interval '5 seconds'));
create temp table t_first as select public.confirm_email_verified() as at;
select pg_temp.assert_that(
  (select at is not null from t_first)
  and (select email_verified_at = (select at from t_first)
       from public.profile where id = (select id from t_user)),
  'otp recente grava');

-- 5. De novo: mantém o primeiro valor.
select pg_temp.assert_that(
  public.confirm_email_verified() = (select at from t_first),
  'segunda chamada mantém o primeiro valor');

-- 6. anon não executa.
reset role;
set local role anon;
select pg_temp.assert_that(
  pg_temp.err('select public.confirm_email_verified()') like 'permission denied%',
  'anon sem execute');

rollback;
\echo email_verified: ok
