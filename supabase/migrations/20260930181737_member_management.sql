-- Fatia 4b: editar Membro (regras 5.2, 8.1), Expulsão e Deixar o Racha (3.5)
-- e o aviso de quem perdeu o acesso ao Racha (excluído ou expulso). O que
-- depende de Evento `active` (Condutor, `left`, Reforço) entra na fatia 5.

create type public.racha_notice_kind as enum ('RACHA_DELETED', 'REMOVED');

-- racha_id sem chave estrangeira: o aviso de Racha excluído sobrevive ao Racha
create table public.racha_notice (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  racha_id uuid not null,
  racha_name text not null,
  kind public.racha_notice_kind not null,
  created_at timestamptz not null default now()
);

create index racha_notice_profile_id_idx on public.racha_notice (profile_id);

alter table public.racha_notice enable row level security;

create policy "racha_notice: cada um lê os seus" on public.racha_notice for select
  to authenticated using (profile_id = (select auth.uid()));
create policy "racha_notice: cada um apaga os seus" on public.racha_notice for delete
  to authenticated using (profile_id = (select auth.uid()));

-- só as funções e o gatilho inserem
revoke all on public.racha_notice from anon, authenticated;
grant select, delete on public.racha_notice to authenticated;

-- quem exclui (o Dono) não precisa de aviso; os outros Membros ativos, sim
create function public.notify_racha_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select m.profile_id, old.id, old.name, 'RACHA_DELETED'
    from public.member m
    where m.racha_id = old.id
      and m.is_active
      and m.profile_id is distinct from (select auth.uid());
  return old;
end $$;

create trigger racha_notify_deleted
  before delete on public.racha
  for each row execute function public.notify_racha_deleted();

create function public.update_member(
  p_racha_id uuid,
  p_profile_id uuid,
  p_stars smallint,
  p_super_star boolean,
  p_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role;
  v_target public.member%rowtype;
  v_stars smallint;
  v_super_star boolean;
begin
  -- trava o Racha: duas promoções ao mesmo tempo não passam do teto
  perform 1 from public.racha r where r.id = p_racha_id for update;

  v_my_role := public.my_racha_role(p_racha_id);
  if v_my_role is null or v_my_role = 'PLAYER' then
    raise exception 'not_allowed';
  end if;

  select * into v_target from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active;
  if not found then
    raise exception 'not_member';
  end if;

  -- Goleiro não tem Estrelas nem Super Estrela (8.3), seja o que for que veio
  if v_target.plays_as = 'GOALKEEPER' then
    v_stars := null;
    v_super_star := false;
  else
    v_stars := p_stars;
    v_super_star := coalesce(p_super_star, false);
    -- o Admin não mexe nas próprias (8.1); o Dono mexe nas de todos
    if v_my_role = 'ADMIN'
       and p_profile_id = (select auth.uid())
       and (v_stars is distinct from v_target.stars
            or v_super_star is distinct from v_target.is_super_star) then
      raise exception 'not_allowed';
    end if;
  end if;

  if p_role is distinct from v_target.role then
    -- Cargo é só do Dono, nunca no Dono, e nunca cria outro Dono (5.2, 3.5)
    if v_my_role <> 'OWNER' or v_target.role = 'OWNER' or p_role is null or p_role = 'OWNER' then
      raise exception 'not_allowed';
    end if;
    -- teto do Dono Free (5.2); sem Plano no banco, todo Dono é Free
    if p_role = 'ADMIN' and (
      select count(*) from public.member m
      where m.racha_id = p_racha_id and m.role = 'ADMIN' and m.is_active
    ) >= 2 then
      raise exception 'admin_limit';
    end if;
  end if;

  update public.member m
    set stars = v_stars, is_super_star = v_super_star, role = p_role
    where m.id = v_target.id;
end $$;

create function public.expel_member(p_racha_id uuid, p_profile_id uuid)
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

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select p_profile_id, r.id, r.name, 'REMOVED'
    from public.racha r where r.id = p_racha_id;
end $$;

-- quem sai por conta própria não ganha aviso: a ação foi dela
create function public.leave_racha(p_racha_id uuid)
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
end $$;

revoke execute on function public.update_member(uuid, uuid, smallint, boolean, public.member_role) from public, anon;
grant execute on function public.update_member(uuid, uuid, smallint, boolean, public.member_role) to authenticated;

revoke execute on function public.expel_member(uuid, uuid) from public, anon;
grant execute on function public.expel_member(uuid, uuid) to authenticated;

revoke execute on function public.leave_racha(uuid) from public, anon;
grant execute on function public.leave_racha(uuid) to authenticated;

-- a reaprovação apaga o aviso de expulsão
create or replace function public.approve_join_request(
  p_request_id uuid,
  p_stars smallint,
  p_super_star boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.join_request%rowtype;
  v_profile public.profile%rowtype;
  v_stars smallint;
  v_super_star boolean;
begin
  -- for update: dois admins no mesmo pedido, o segundo espera e vê já resolvido
  select * into v_request from public.join_request jr
    where jr.id = p_request_id for update;
  if not found then
    raise exception 'already_resolved';
  end if;
  if not coalesce(public.my_racha_role(v_request.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'already_resolved';
  end if;

  select * into v_profile from public.profile p where p.id = v_request.profile_id;

  -- Goleiro entra sem Estrelas nem Super Estrela, seja o que for que veio (8.3)
  if v_profile.plays_as = 'GOALKEEPER' then
    v_stars := null;
    v_super_star := false;
  else
    if p_stars is null or p_stars not between 1 and 5 then
      raise exception 'stars_required';
    end if;
    v_stars := p_stars;
    v_super_star := coalesce(p_super_star, false);
  end if;

  -- quem saiu e voltou já tem a linha (inativa) do par: reativa em vez de duplicar.
  -- o where trava a reativação em quem está inativo: sem ele, um pedido
  -- pendente "impossível" (Membro já ativo, ex.: dois aprovam em paralelo)
  -- rebaixaria/sobrescreveria as Estrelas de um Membro ativo.
  insert into public.member as m (
    racha_id, profile_id, role, plays_as, primary_position, secondary_position,
    stars, is_super_star
  ) values (
    v_request.racha_id, v_request.profile_id, 'PLAYER', v_profile.plays_as,
    v_profile.primary_position, v_profile.secondary_position, v_stars, v_super_star
  )
  on conflict (racha_id, profile_id) do update set
    is_active = true,
    role = 'PLAYER',
    plays_as = excluded.plays_as,
    primary_position = excluded.primary_position,
    secondary_position = excluded.secondary_position,
    stars = excluded.stars,
    is_super_star = excluded.is_super_star,
    joined_at = now()
  where not m.is_active;

  -- found reflete o insert/update do comando acima (confirmado com o
  -- postgres local): se o where bloqueou (Membro já ativo), nada mudou.
  if not found then
    raise exception 'already_resolved';
  end if;

  update public.join_request jr
    set status = 'APPROVED', reviewed_by = (select auth.uid()), reviewed_at = now()
    where jr.id = p_request_id;

  -- reaprovado depois de expulso: o aviso antigo não pode reaparecer na lista
  delete from public.racha_notice n
    where n.profile_id = v_request.profile_id
      and n.racha_id = v_request.racha_id
      and n.kind = 'REMOVED';
end $$;
