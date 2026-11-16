-- Plano Pro: a validade da assinatura, gravada só pela Edge Function revenuecat-sync,
-- decide os tetos de Rachas e de Admins. Sem linha ou com validade passada, é Free.

create table public.subscription (
  profile_id uuid primary key references public.profile (id) on delete cascade,
  expires_at timestamptz not null,
  product_id text not null,
  store text not null,
  is_trial boolean not null,
  will_renew boolean not null,
  billing_issue_at timestamptz,
  is_sandbox boolean not null,
  synced_at timestamptz not null default now(),
  sync_source text not null
);

-- Como push_token: só a chave de serviço escreve; o app lê pelas funções abaixo.
alter table public.subscription enable row level security;
revoke all on public.subscription from public, anon, authenticated;

create index subscription_expires_at_idx on public.subscription (expires_at);

create function private.is_pro(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscription s
    where s.profile_id = p_profile_id and s.expires_at > now()
  );
$$;

-- Dono inativo não conta: o Racha sem Dono ativo fica no teto do Free.
create function private.racha_owner_is_pro(p_racha_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member m
    where m.racha_id = p_racha_id and m.role = 'OWNER' and m.is_active
      and private.is_pro(m.profile_id)
  );
$$;

-- Único lugar com o número do Free; nulo é sem teto.
create function private.admin_limit(p_racha_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.racha_owner_is_pro(p_racha_id) then null else 2 end;
$$;

revoke execute on function private.is_pro(uuid) from public, anon, authenticated;
revoke execute on function private.racha_owner_is_pro(uuid) from public, anon, authenticated;
revoke execute on function private.admin_limit(uuid) from public, anon, authenticated;

-- Campo calculado do select do Racha. Fora do Racha devolve nulo, para não revelar
-- o Plano do Dono de outro Racha.
create function public.admin_limit(r public.racha)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_racha_member(r.id) then private.admin_limit(r.id) end;
$$;

revoke execute on function public.admin_limit(public.racha) from public, anon;
grant execute on function public.admin_limit(public.racha) to authenticated;

create function public.get_my_plan()
returns table (
  is_pro boolean,
  expires_at timestamptz,
  is_trial boolean,
  will_renew boolean,
  billing_issue_at timestamptz,
  product_id text,
  owned_racha_count integer,
  can_create_racha boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.is_pro, s.expires_at, s.is_trial, s.will_renew, s.billing_issue_at, s.product_id,
    o.n, p.is_pro or o.n = 0
  from (select private.current_profile_id() as uid) me
  cross join lateral (select private.is_pro(me.uid) as is_pro) p
  left join public.subscription s on s.profile_id = me.uid
  cross join lateral (
    select count(*)::integer as n from public.member m
    where m.profile_id = me.uid and m.role = 'OWNER' and m.is_active
  ) o;
$$;

revoke execute on function public.get_my_plan() from public, anon;
grant execute on function public.get_my_plan() to authenticated;

-- Corpo de 20261014100000_deleted_account_guard; muda só o teto.
create or replace function public.create_racha(
  p_name text,
  p_outfield_per_team smallint,
  p_game_mode public.game_mode,
  p_max_consecutive_wins smallint,
  p_tie_rule public.tie_rule,
  p_tie_return_order public.tie_return_order,
  p_consider_position boolean,
  p_place text,
  p_match_duration_min smallint default null,
  p_min_age smallint default null,
  p_yellow_card_mode public.yellow_card_mode default 'timed',
  p_yellow_out_min smallint default 2
)
returns table (id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select private.current_profile_id());
  v_profile public.profile%rowtype;
  v_racha_id uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext('create_racha:' || v_uid::text));

  if not private.is_pro(v_uid) and exists (
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
    tie_rule, tie_return_order, consider_position, match_duration_min, min_age,
    place, yellow_card_mode, yellow_out_min
  ) values (
    trim(p_name), v_code, p_outfield_per_team, p_game_mode, p_max_consecutive_wins,
    p_tie_rule, p_tie_return_order, p_consider_position, p_match_duration_min, p_min_age,
    btrim(p_place), coalesce(p_yellow_card_mode, 'timed'), coalesce(p_yellow_out_min, 2)
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

-- Corpo de 20261022100000_pix_key_holder; muda só o teto.
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

  perform pg_advisory_xact_lock(hashtext('create_racha:' || p_profile_id::text));

  select * into v_target from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
    for update;
  if not found then
    raise exception 'not_member';
  end if;

  if not private.is_pro(p_profile_id) and exists (
    select 1 from public.member m
    where m.profile_id = p_profile_id and m.role = 'OWNER' and m.is_active
  ) then
    raise exception 'plan_owner_limit';
  end if;

  update public.member m set role = 'ADMIN'
    where m.racha_id = p_racha_id and m.profile_id = v_uid;
  update public.member m set role = 'OWNER' where m.id = v_target.id;

  update public.event e
    set conductor_id = p_profile_id
    where e.racha_id = p_racha_id
      and e.status in ('upcoming', 'active')
      and e.conductor_id = v_uid;

  delete from private.racha_pix_key k where k.racha_id = p_racha_id;
  update public.event e
    set pix_key = null, pix_key_type = null, pix_key_holder = null
    where e.racha_id = p_racha_id
      and e.pix_key is not null;

  delete from public.racha_notice n
    where n.profile_id = (select auth.uid())
      and n.racha_id = p_racha_id
      and n.kind = 'OWNERSHIP_RECEIVED';

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select p_profile_id, r.id, r.name, 'OWNERSHIP_RECEIVED'
    from public.racha r where r.id = p_racha_id;

  perform private.notify(
    array[p_profile_id],
    'ownership_transferred',
    p_racha_id,
    null,
    null,
    '{}'::jsonb
  );
end $$;

-- Corpo de 20261009100000_notifications; muda só o teto.
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
  v_limit integer := private.admin_limit(p_racha_id);
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
    -- teto do Dono Free (5.2); nulo quando o Dono é Pro
    if p_role = 'ADMIN' and v_limit is not null and (
      select count(*) from public.member m
      where m.racha_id = p_racha_id and m.role = 'ADMIN' and m.is_active
    ) >= v_limit then
      raise exception 'admin_limit';
    end if;
  end if;

  update public.member m
    set stars = v_stars, is_super_star = v_super_star, role = coalesce(p_role, v_target.role)
    where m.id = v_target.id;

  if p_role is not null and p_role is distinct from v_target.role then
    perform private.notify(
      array[p_profile_id],
      'role_changed',
      p_racha_id,
      null,
      null,
      jsonb_build_object('role', p_role)
    );
  end if;
end $$;

-- De hora em hora a Edge Function relê as assinaturas que deviam ter renovado: cobre
-- o evento de renovação que se perdeu. Sem os segredos no Vault, não chama nada.
-- Volátil, ao contrário das outras: põe um pedido na fila do pg_net.
create function private.request_subscription_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select s.decrypted_secret into v_url
  from vault.decrypted_secrets s
  where s.name = 'revenuecat_sync_url';
  select s.decrypted_secret into v_secret
  from vault.decrypted_secrets s
  where s.name = 'revenuecat_sync_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-sync-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function private.request_subscription_sync() from public, anon, authenticated;

select cron.schedule(
  'sync-renewing-subscriptions',
  '7 * * * *',
  'select private.request_subscription_sync()'
);
