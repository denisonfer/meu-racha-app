-- Fatia 3b: Estrelas e Super Estrela no Membro (regras 8.1, 4.2), aprovar e
-- recusar Solicitação (4.2, 4.3 — recusar apaga e não bloqueia), lista de Membros.

-- Estrelas: 1–5, só de quem joga na Linha; espelham STARS_MIN/STARS_MAX do domínio
alter table public.member
  add column stars smallint,
  add column is_super_star boolean not null default false;

-- Dono nasce com 3 Estrelas (5.1); até aqui só existem Donos
update public.member set stars = 3 where plays_as = 'OUTFIELD' and stars is null;

alter table public.member
  add constraint member_stars_range check (stars between 1 and 5),
  -- Goleiro não tem Estrelas nem Super Estrela (8.3); Linha sempre tem
  add constraint member_stars_match_plays_as check (
    case plays_as
      when 'GOALKEEPER' then stars is null and not is_super_star
      else stars is not null
    end
  );

-- a Solicitação aprovada continua existindo (4.2): guarda quem aprovou e quando.
-- REJECTED fica sem uso — recusar apaga (4.3); tirar valor de enum exige recriar o tipo
alter table public.join_request
  add column reviewed_by uuid references public.profile (id),
  add column reviewed_at timestamptz;

-- Cargo de quem chama no Racha (null se não é Membro ativo). security definer:
-- consultar member de dentro de uma policy de member entraria em recursão
create function public.my_racha_role(p_racha_id uuid)
returns public.member_role
language sql
security definer
set search_path = ''
stable
as $$
  select m.role from public.member m
  where m.racha_id = p_racha_id
    and m.profile_id = (select auth.uid())
    and m.is_active;
$$;

revoke execute on function public.my_racha_role(uuid) from public, anon;
grant execute on function public.my_racha_role(uuid) to authenticated;

-- é o que faz a contagem de pedidos (embed) aparecer só pra quem aprova
create policy "join_request: Dono/Admin leem os do Racha" on public.join_request for select
  to authenticated using (public.my_racha_role(racha_id) in ('OWNER', 'ADMIN'));

-- create_racha passa a gravar as Estrelas do Dono: mesma assinatura da
-- 20260929135718_join_request.sql (create or replace mantém as grants),
-- corpo idêntico + stars no insert do Dono.
create or replace function public.create_racha(
  p_name text,
  p_outfield_per_team smallint,
  p_game_mode public.game_mode,
  p_max_consecutive_wins smallint,
  p_tie_rule public.tie_rule,
  p_tie_return_order public.tie_return_order,
  p_consider_position boolean,

  p_match_duration_min smallint default null,
  p_min_age smallint default null
)
returns table (id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profile%rowtype;
  v_racha_id uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext('create_racha:' || v_uid::text));

  if exists (
    select 1 from public.member
    where profile_id = v_uid and role = 'OWNER' and is_active
  ) then
    raise exception 'plan_owner_limit';
  end if;

  select * into v_profile from public.profile where profile.id = v_uid;

  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.racha r where r.invite_code = v_code);
  end loop;

  insert into public.racha (
    name, invite_code, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min, min_age
  ) values (
    trim(p_name), v_code, p_outfield_per_team, p_game_mode, p_max_consecutive_wins,
    p_tie_rule, p_tie_return_order, p_consider_position, p_match_duration_min, p_min_age
  ) returning racha.id into v_racha_id;

  insert into public.season (racha_id, number, starts_on, ends_on)
  values (v_racha_id, 1, current_date, (current_date + interval '1 year')::date);

  insert into public.member (
    racha_id, profile_id, role, plays_as, primary_position, secondary_position, stars
  ) values (
    v_racha_id, v_uid, 'OWNER', v_profile.plays_as,
    v_profile.primary_position, v_profile.secondary_position,
    case when v_profile.plays_as = 'OUTFIELD' then 3 end
  );

  return query select v_racha_id, v_code;
end $$;

create function public.list_join_requests(p_racha_id uuid)
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
  return query
    select jr.id, p.display_name, p.avatar_path,
      extract(year from pg_catalog.age(p.birth_date))::int,
      p.plays_as, p.primary_position, p.secondary_position
    from public.join_request jr
    join public.profile p on p.id = jr.profile_id
    where jr.racha_id = p_racha_id and jr.status = 'PENDING'
    order by jr.created_at;
end $$;

create function public.approve_join_request(
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
end $$;

-- recusar apaga e não bloqueia: a pessoa pode pedir de novo (4.3)
create function public.refuse_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha_id uuid;
begin
  select jr.racha_id into v_racha_id from public.join_request jr where jr.id = p_request_id;
  if v_racha_id is null then
    raise exception 'already_resolved';
  end if;
  if not coalesce(public.my_racha_role(v_racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  delete from public.join_request jr where jr.id = p_request_id and jr.status = 'PENDING';
  if not found then
    raise exception 'already_resolved';
  end if;
end $$;

-- a RLS de profile só mostra o próprio Perfil: nome e foto dos outros saem
-- daqui, só pra Membro do Racha, e nunca a idade
create function public.list_racha_members(p_racha_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_path text,
  role public.member_role,
  plays_as public.plays_as,
  primary_position public.position,
  secondary_position public.position,
  stars smallint,
  is_super_star boolean
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_racha_member(p_racha_id) then
    raise exception 'not_allowed';
  end if;

  return query
    select m.profile_id, p.display_name, p.avatar_path, m.role, m.plays_as,
      m.primary_position, m.secondary_position, m.stars, m.is_super_star
    from public.member m
    join public.profile p on p.id = m.profile_id
    where m.racha_id = p_racha_id and m.is_active;
end $$;

revoke execute on function public.list_join_requests(uuid) from public, anon;
grant execute on function public.list_join_requests(uuid) to authenticated;

revoke execute on function public.approve_join_request(uuid, smallint, boolean) from public, anon;
grant execute on function public.approve_join_request(uuid, smallint, boolean) to authenticated;

revoke execute on function public.refuse_join_request(uuid) from public, anon;
grant execute on function public.refuse_join_request(uuid) to authenticated;

revoke execute on function public.list_racha_members(uuid) from public, anon;
grant execute on function public.list_racha_members(uuid) to authenticated;
