-- Fecha duas corridas da Passagem do Racha: sair enquanto se recebe o Racha, e
-- o aviso de "novo dono" que sobrava depois de deixar de ser verdade.

create or replace function public.leave_racha(p_racha_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role;
begin
  -- a Passagem trava o Racha: sair e receber a Passagem ao mesmo tempo não deixa o Racha sem Dono
  perform 1 from public.racha r where r.id = p_racha_id for update;

  v_my_role := public.my_racha_role(p_racha_id);
  if v_my_role is null then
    raise exception 'not_member';
  end if;
  -- o Dono só sai pela Passagem (3.5)
  if v_my_role = 'OWNER' then
    raise exception 'owner_cannot_leave';
  end if;

  update public.member m set is_active = false
    where m.racha_id = p_racha_id and m.profile_id = (select auth.uid());

  delete from public.join_request jr
    where jr.racha_id = p_racha_id and jr.profile_id = (select auth.uid());
end $$;

create or replace function public.transfer_ownership(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target public.member%rowtype;
begin
  perform 1 from public.racha r where r.id = p_racha_id for update;

  if public.my_racha_role(p_racha_id) is distinct from 'OWNER' or p_profile_id = v_uid then
    raise exception 'not_allowed';
  end if;

  -- mesma chave do create_racha: quem recebe não cria um Racha enquanto recebe outro
  perform pg_advisory_xact_lock(hashtext('create_racha:' || p_profile_id::text));

  select * into v_target from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
    for update;
  if not found then
    raise exception 'not_member';
  end if;

  -- teto do Free (3.5, 12.1); sem Plano no banco, todo mundo é Free
  if exists (
    select 1 from public.member m
    where m.profile_id = p_profile_id and m.role = 'OWNER' and m.is_active
  ) then
    raise exception 'plan_owner_limit';
  end if;

  -- rebaixa antes de promover: o índice de um Dono só não pode ver dois
  update public.member m set role = 'ADMIN'
    where m.racha_id = p_racha_id and m.profile_id = v_uid;
  update public.member m set role = 'OWNER' where m.id = v_target.id;

  -- quem passa o Racha não é mais dono: o aviso que recebeu antes deixa de ser verdade
  delete from public.racha_notice n
    where n.profile_id = (select auth.uid())
      and n.racha_id = p_racha_id
      and n.kind = 'OWNERSHIP_RECEIVED';

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select p_profile_id, r.id, r.name, 'OWNERSHIP_RECEIVED'
    from public.racha r where r.id = p_racha_id;
end $$;

create or replace function public.notify_racha_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- o aviso de expulsão diria "peça de novo com o código" de um Racha que não existe mais
  update public.racha_notice n set kind = 'RACHA_DELETED'
    where n.racha_id = old.id and n.kind = 'REMOVED';

  -- quem exclui é o Dono; o aviso de "novo dono" dele não faz mais sentido
  delete from public.racha_notice n
    where n.racha_id = old.id and n.kind = 'OWNERSHIP_RECEIVED';

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select m.profile_id, old.id, old.name, 'RACHA_DELETED'
    from public.member m
    where m.racha_id = old.id
      and m.is_active
      and m.profile_id is distinct from (select auth.uid());
  return old;
end $$;
