-- Regras 4.4: Deixar o Racha e Expulsão apagam a Solicitação do par, mesmo a
-- aprovada. Sem isso o unique (racha_id, profile_id) barra o pedido novo de
-- quem saiu.

create or replace function public.expel_member(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role := public.my_racha_role(p_racha_id);
  v_target public.member%rowtype;
begin
  if v_my_role is null or v_my_role = 'PLAYER' or p_profile_id = (select auth.uid()) then
    raise exception 'not_allowed';
  end if;

  select * into v_target from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
    for update;
  if not found then
    raise exception 'not_member';
  end if;

  -- Dono expulsa Admin e Jogador; Admin, só Jogador; ninguém expulsa o Dono (3.5)
  if v_target.role = 'OWNER' or (v_my_role = 'ADMIN' and v_target.role <> 'PLAYER') then
    raise exception 'not_allowed';
  end if;

  update public.member m set is_active = false where m.id = v_target.id;

  delete from public.join_request jr
    where jr.racha_id = p_racha_id and jr.profile_id = p_profile_id;

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select p_profile_id, r.id, r.name, 'REMOVED'
    from public.racha r where r.id = p_racha_id;
end $$;

-- quem sai por conta própria não ganha aviso: a ação foi dela
create or replace function public.leave_racha(p_racha_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role := public.my_racha_role(p_racha_id);
begin
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

-- quem já saiu antes desta migration ficou com a Solicitação presa
delete from public.join_request jr
  using public.member m
  where m.racha_id = jr.racha_id
    and m.profile_id = jr.profile_id
    and not m.is_active;
