-- Fatia 3a: Idade mínima do Racha (regra 7.0) e Solicitação (regras 4.1, 4.3, 4.6).

-- Idade mínima: informativa, não barra ninguém. null = sem Idade mínima.
-- Faixa espelha MIN_AGE_MIN/MIN_AGE_MAX do domínio.
alter table public.racha
  add column min_age smallint default 30,
  add constraint min_age_range check (min_age is null or min_age between 16 and 90);

-- create_racha ganha p_min_age: trocar a assinatura exige drop, senão o
-- Postgres cria uma segunda função sobrecarregada
drop function public.create_racha(text, smallint, public.game_mode, smallint, public.tie_rule, public.tie_return_order, boolean, smallint);

create function public.create_racha(
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
    racha_id, profile_id, role, plays_as, primary_position, secondary_position
  ) values (
    v_racha_id, v_uid, 'OWNER', v_profile.plays_as,
    v_profile.primary_position, v_profile.secondary_position
  );

  return query select v_racha_id, v_code;
end $$;

revoke execute on function public.create_racha(text, smallint, public.game_mode, smallint, public.tie_rule, public.tie_return_order, boolean, smallint, smallint) from public, anon;
grant execute on function public.create_racha(text, smallint, public.game_mode, smallint, public.tie_rule, public.tie_return_order, boolean, smallint, smallint) to authenticated;

create type public.join_request_status as enum ('PENDING', 'APPROVED', 'REJECTED');

create table public.join_request (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.racha (id) on delete cascade,
  -- o default é quem está logado: o app só manda o racha_id
  profile_id uuid not null default auth.uid() references public.profile (id) on delete cascade,
  status public.join_request_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  -- no máximo uma vigente por par (4.1); a rejeitada também segura o par
  -- até o Desbloqueio (4.3)
  unique (racha_id, profile_id)
);

alter table public.join_request enable row level security;

-- Dono/Admin lendo e revisando os pedidos do Racha é a fatia 3b
create policy "join_request: Perfil lê os próprios" on public.join_request for select
  to authenticated using (profile_id = (select auth.uid()));

-- Membro ativo não pede; quem saiu (inativo) pode pedir de novo (4.4)
create policy "join_request: Perfil pede entrada" on public.join_request for insert
  to authenticated with check (
    profile_id = (select auth.uid())
    and status = 'PENDING'
    and not public.is_racha_member(racha_id)
  );

-- cancelar apaga; a rejeitada não se apaga por aqui, só pelo Desbloqueio (3b)
create policy "join_request: Perfil cancela a pendente" on public.join_request for delete
  to authenticated using (profile_id = (select auth.uid()) and status = 'PENDING');

-- o Supabase concede escrita em tabela nova por padrão; aqui só o racha_id
-- entra pelo cliente — status e profile_id ficam nos defaults
revoke insert, update, delete on public.join_request from anon, authenticated;
grant insert (racha_id) on public.join_request to authenticated;
grant delete on public.join_request to authenticated;

-- Quem ainda não é Membro não enxerga o Racha pela RLS: o convite sai por
-- aqui, só com o que a tela 5 mostra (nada do motor, nem o invite_code)
create function public.get_invite(p_code text)
returns table (
  racha_id uuid,
  name text,
  member_count int,
  owner_name text,
  min_age smallint,
  my_status text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    r.id,
    r.name,
    (select count(*)::int from public.member m
      where m.racha_id = r.id and m.is_active),
    (select p.display_name from public.member m
      join public.profile p on p.id = m.profile_id
      where m.racha_id = r.id and m.role = 'OWNER' and m.is_active),
    r.min_age,
    case
      when public.is_racha_member(r.id) then 'MEMBER'
      -- aprovada sem Membro ativo não acontece: sair apaga a Solicitação (4.4)
      else (select jr.status::text from public.join_request jr
            where jr.racha_id = r.id
              and jr.profile_id = (select auth.uid())
              and jr.status <> 'APPROVED')
    end
  from public.racha r
  where r.invite_code = upper(trim(p_code));
$$;

revoke execute on function public.get_invite(text) from public, anon;
grant execute on function public.get_invite(text) to authenticated;

-- O cartão "aguardando" precisa do nome do Racha, que a RLS esconde de quem
-- ainda não é Membro
create function public.list_my_join_requests()
returns table (racha_id uuid, racha_name text)
language sql
security definer
set search_path = ''
stable
as $$
  select r.id, r.name
  from public.join_request jr
  join public.racha r on r.id = jr.racha_id
  where jr.profile_id = (select auth.uid()) and jr.status = 'PENDING'
  order by jr.created_at;
$$;

revoke execute on function public.list_my_join_requests() from public, anon;
grant execute on function public.list_my_join_requests() to authenticated;
