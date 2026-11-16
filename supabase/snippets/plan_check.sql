-- Conferência do Plano. A terceira se compara com o total de Pro no painel da RevenueCat.

-- 1. Diz que renova, mas a validade já passou e ninguém releu a assinatura depois.
select profile_id, expires_at, synced_at, sync_source
from public.subscription
where will_renew and expires_at < now() and synced_at < expires_at
order by expires_at;

-- 2. Cobrança falhando (carência da Play).
select profile_id, expires_at, billing_issue_at, synced_at
from public.subscription
where billing_issue_at is not null
order by billing_issue_at;

-- 3. Quantos Perfis são Pro agora.
select count(*) as pro_now
from public.subscription
where expires_at > now();
