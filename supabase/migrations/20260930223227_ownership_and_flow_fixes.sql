-- Fatia 4c: Passagem do Racha (regras 3.5, 5.3) e as correções da varredura
-- de fluxos de 30/09/2026 (spec 4c, "Correções da varredura").

-- regra 5.1: exatamente um Dono. As funções já garantiam; o índice garante
-- contra qualquer caminho futuro
create unique index member_one_owner_per_racha
  on public.member (racha_id) where role = 'OWNER' and is_active;

create function public.transfer_ownership(p_racha_id uuid, p_profile_id uuid)
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

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select p_profile_id, r.id, r.name, 'OWNERSHIP_RECEIVED'
    from public.racha r where r.id = p_racha_id;
end $$;

revoke execute on function public.transfer_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;

-- G2: p_role nulo mantém o Cargo
create or replace function public.update_member(
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
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
    for update;
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

  -- p_role nulo mantém o Cargo: quem só mexe nas Estrelas não disputa o Cargo
  if p_role is not null and p_role is distinct from v_target.role then
    -- Cargo é só do Dono, nunca no Dono, e nunca cria outro Dono (5.2, 3.5)
    if v_my_role <> 'OWNER' or v_target.role = 'OWNER' or p_role = 'OWNER' then
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
    set stars = v_stars, is_super_star = v_super_star, role = coalesce(p_role, v_target.role)
    where m.id = v_target.id;
end $$;

-- G3: o aviso de expulsão não sobrevive à exclusão do Racha
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

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select m.profile_id, old.id, old.name, 'RACHA_DELETED'
    from public.member m
    where m.racha_id = old.id
      and m.is_active
      and m.profile_id is distinct from (select auth.uid());
  return old;
end $$;

-- E4: list_join_requests com a idade pela data de Brasília
create or replace function public.list_join_requests(p_racha_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  age int,
  plays_as public.plays_as,
  primary_position public.position,
  secondary_position public.position
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not coalesce(public.my_racha_role(p_racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  -- a idade sai daqui e só com o pedido pendente (4.2); a data nunca sai
  -- a data do Brasil, não a do servidor em UTC
  return query
    select jr.id, p.display_name, p.avatar_path,
      extract(year from pg_catalog.age((now() at time zone 'America/Sao_Paulo')::date, p.birth_date))::int,
      p.plays_as, p.primary_position, p.secondary_position
    from public.join_request jr
    join public.profile p on p.id = jr.profile_id
    where jr.racha_id = p_racha_id and jr.status = 'PENDING'
    order by jr.created_at;
end $$;

-- E4 e C1: idade pela data de Brasília e aceite dos Termos obrigatório
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_birth_date date := (new.raw_user_meta_data ->> 'birth_date')::date;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- regra 14.2: sem aceite dos Termos, não há conta
  if coalesce((new.raw_user_meta_data ->> 'terms_accepted')::boolean, false) is not true then
    raise exception 'terms_not_accepted';
  end if;

  if v_birth_date > v_today - interval '16 years' then
    raise exception 'under_minimum_age';
  end if;

  if v_birth_date < v_today - interval '90 years' then
    raise exception 'implausible_birth_date';
  end if;

  insert into public.profile (
    id, display_name, birth_date,
    plays_as, primary_position, secondary_position, terms_accepted_at
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    v_birth_date,
    (new.raw_user_meta_data ->> 'plays_as')::public.plays_as,
    (new.raw_user_meta_data ->> 'primary_position')::public.position,
    (new.raw_user_meta_data ->> 'secondary_position')::public.position,
    now()
  );

  return new;
end $$;

-- E8: recusar apaga (4.3); uma linha REJECTED prenderia o pedido novo no unique
delete from public.join_request where status = 'REJECTED';
