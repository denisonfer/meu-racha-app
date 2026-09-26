-- Só para a experiência: avisa na etapa 1 em vez de deixar a pessoa
-- descobrir no fim do cadastro. A garantia continua sendo a unique de
-- auth.users; entre esta consulta e o cadastro existe uma janela.
-- ponytail: responder isso é enumeração de contas. Em produção, rate limit
-- na borda (ou trocar por checagem no submit) antes de expor publicamente.
create function public.email_available(p_email text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1 from auth.users where email = lower(trim(p_email))
  );
$$;

revoke execute on function public.email_available(text) from public;
grant execute on function public.email_available(text) to anon, authenticated;
