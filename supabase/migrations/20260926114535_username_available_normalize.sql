-- O app guarda username em minúscula (o schema faz trim+lowercase antes de
-- inserir), mas a consulta comparava o texto cru: username_available('SuperMan')
-- respondia "disponível" com 'superman' já no banco, e a pessoa só descobria
-- no fim do cadastro, no 23505. Normaliza aqui, que é onde a verdade mora.
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1 from public.profile where username = lower(trim(p_username))
  );
$$;
