-- Função de gatilho em public vira /rest/v1/rpc: ninguém de fora executa, só o gatilho.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/trigger_function_grants.sql
begin;

do $$
declare
  v_open text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_open
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.prorettype = 'trigger'::regtype
    and (has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute'));

  if v_open is not null then
    raise exception 'FAIL: gatilho executável por anon/authenticated: %', v_open;
  end if;
  raise notice 'PASS: nenhuma função de gatilho exposta';
end $$;

rollback;
