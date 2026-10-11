-- Push local: os dois segredos que o gatilho de push lê no Vault.
-- O segredo é o mesmo PUSH_FUNCTION_SECRET de supabase/functions/.env.
-- Rode com:
--   docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     -v secret="$(grep PUSH_FUNCTION_SECRET supabase/functions/.env | cut -d= -f2)" \
--     -f - < supabase/snippets/push_local_secrets.sql
-- kong é o nome do gateway na rede Docker do Supabase local, que o banco alcança.
delete from vault.secrets where name in ('push_function_url', 'push_function_secret');
select vault.create_secret('http://kong:8000/functions/v1/send-push', 'push_function_url');
select vault.create_secret(:'secret', 'push_function_secret');
