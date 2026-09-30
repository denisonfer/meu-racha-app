-- trava a linha do alvo: duas edições do mesmo Membro não se sobrescrevem às cegas
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
