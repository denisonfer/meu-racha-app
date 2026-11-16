-- RevenueCat local: os dois segredos que o job de sincronização lê no Vault.
-- O segredo é o mesmo REVENUECAT_SYNC_SECRET de supabase/functions/.env.
-- Rode com:
--   docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     -v secret="$(grep REVENUECAT_SYNC_SECRET supabase/functions/.env | cut -d= -f2)" \
--     -f - < supabase/snippets/revenuecat_local_secrets.sql
-- kong é o nome do gateway na rede Docker do Supabase local, que o banco alcança.
delete from vault.secrets where name in ('revenuecat_sync_url', 'revenuecat_sync_secret');
select vault.create_secret('http://kong:8000/functions/v1/revenuecat-sync', 'revenuecat_sync_url');
select vault.create_secret(:'secret', 'revenuecat_sync_secret');
