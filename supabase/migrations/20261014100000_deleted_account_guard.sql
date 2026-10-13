-- Conta apagada com o JWT antigo (vale até jwt_expiry) não opera mais, e o nome de quem
-- apagou a conta não sobrevive nos Avisos dos outros. Também fecha duas validações
-- frouxas: token de push e caminho do avatar.

-- Fonte única de "quem sou eu": o auth.uid() só vale se o Perfil existe e não foi
-- anonimizado. Conta apagada recebe o mesmo que quem não está logado (NULL).
create function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profile p
  where p.id = (select auth.uid()) and p.anonymized_at is null;
$$;

revoke execute on function private.current_profile_id() from public, anon, authenticated;

-- Papel e pertencimento são a base das demais RPCs e policies: sem Membro ativo
-- para a conta apagada, elas passam a negar sem mudar uma linha cada.
create or replace function public.my_racha_role(p_racha_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.member m
  where m.racha_id = p_racha_id
    and m.profile_id = (select private.current_profile_id())
    and m.is_active;
$$;

create or replace function public.is_racha_member(p_racha_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member
    where racha_id = p_racha_id
      and profile_id = (select private.current_profile_id())
      and is_active
  );
$$;

-- As policies rodam como authenticated, que não enxerga o schema private: o guarda
-- entra inline (o Perfil próprio é legível pela policy de select).
drop policy "join_request: Perfil pede entrada" on public.join_request;
create policy "join_request: Perfil pede entrada"
  on public.join_request for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.profile p
      where p.id = (select auth.uid()) and p.anonymized_at is null
    )
    and status = 'PENDING'
    and not public.is_racha_member(racha_id)
  );

drop policy "profile: cada um edita o próprio" on public.profile;
create policy "profile: cada um edita o próprio"
  on public.profile for update
  to authenticated
  using (id = (select auth.uid()) and anonymized_at is null)
  with check (id = (select auth.uid()) and anonymized_at is null);

drop policy "profile: cada um troca a própria foto" on public.profile;
create policy "profile: cada um troca a própria foto"
  on public.profile for update
  to authenticated
  using (id = (select auth.uid()) and anonymized_at is null)
  with check (id = (select auth.uid()) and anonymized_at is null);

-- Corpo de 20261012100000_delete_account (e o de create_racha mais recente); muda só a
-- origem do v_uid.
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

-- Token de push: formato do Expo, tamanho limitado e, por perfil, no máximo 10
-- aparelhos (o mais antigo sai). NOT VALID: vale para as linhas novas.
alter table public.push_token add constraint push_token_expo_format check (
  token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' and length(token) <= 200
) not valid;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select private.current_profile_id());
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;

  insert into public.push_token (token, profile_id, platform)
  values (p_token, v_uid, p_platform)
  on conflict (token) do update
    set profile_id = v_uid,
      platform = excluded.platform,
      updated_at = now();

  -- O token recém-registrado nunca sai, mesmo com updated_at empatado na transação.
  delete from public.push_token t
  where t.token in (
    select t2.token from public.push_token t2
    where t2.profile_id = v_uid
    order by t2.token = p_token desc, t2.updated_at desc, t2.token
    offset 10
  );
end $$;

create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select private.current_profile_id());
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;

  delete from public.push_token t
  where t.token = p_token and t.profile_id = v_uid;
end $$;

create or replace function public.set_push_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select private.current_profile_id());
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;

  update public.profile set push_enabled = p_enabled where id = v_uid;
end $$;

-- Corpo de 20261013100000_report_and_block; muda só a origem do v_uid.
create or replace function public.report_content(
  p_kind text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select private.current_profile_id());
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;
  if p_kind = 'profile' then
    if p_target_id = v_uid then
      raise exception 'not_allowed';
    end if;
    if not exists (select 1 from public.profile p where p.id = p_target_id) then
      raise exception 'not_found';
    end if;
  elsif p_kind = 'racha' then
    if not exists (select 1 from public.racha r where r.id = p_target_id) then
      raise exception 'not_found';
    end if;
  else
    raise exception 'invalid_reason';
  end if;
  if not (
    (p_kind = 'profile' and p_reason in ('photo', 'name', 'harassment', 'spam_scam', 'other'))
    or (p_kind = 'racha' and p_reason in ('name', 'scam_charge', 'other'))
  ) then
    raise exception 'invalid_reason';
  end if;

  insert into public.report (reporter_id, target_kind, target_profile_id, target_racha_id, reason, details)
  values (
    v_uid,
    p_kind,
    case when p_kind = 'profile' then p_target_id end,
    case when p_kind = 'racha' then p_target_id end,
    p_reason,
    nullif(btrim(p_details), '')
  )
  on conflict (reporter_id, target_kind, coalesce(target_profile_id, target_racha_id))
    where status = 'open'
  do update set
    reason = excluded.reason,
    details = excluded.details,
    updated_at = now();
end $$;

create or replace function public.block_profile(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select private.current_profile_id());
begin
  if v_uid is null or p_id = v_uid then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_id) then
    raise exception 'not_found';
  end if;

  insert into public.profile_block (blocker_id, blocked_id)
  values (v_uid, p_id)
  on conflict do nothing;
end $$;

-- Conta apagada vê o Convite como código inexistente: nenhuma linha.
create or replace function public.get_invite(p_code text)
returns table (
  racha_id uuid,
  name text,
  member_count integer,
  owner_name text,
  min_age smallint,
  my_status text,
  outfield_per_team smallint
)
language sql
stable
security definer
set search_path = ''
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
              and jr.profile_id = (select private.current_profile_id())
              and jr.status <> 'APPROVED')
    end,
    r.outfield_per_team
  from public.racha r
  where r.invite_code = upper(trim(p_code))
    and (select private.current_profile_id()) is not null;
$$;

-- Avatar: só <id>/<arquivo simples de até 100 caracteres>, sem ".." (o app grava
-- <id>/<epoch>.jpg).
alter table public.profile drop constraint avatar_path_in_own_folder;
alter table public.profile add constraint avatar_path_in_own_folder check (
  avatar_path is null
  or (
    avatar_path ~ ('^' || id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and avatar_path !~ '\.\.'
  )
) not valid;

-- O aviso guarda quem o causou: ao apagar a conta, o nome some dos Avisos dos outros.
alter table public.notification
  add column actor_id uuid references public.profile (id) on delete set null;

-- Corpo de 20261009100000_notifications; grava o actor_id e não notifica conta apagada.
create or replace function private.notify(
  p_recipients uuid[],
  p_kind text,
  p_racha_id uuid,
  p_event_id uuid,
  p_join_request_id uuid,
  p_payload jsonb,
  p_exclude_actor boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_racha_name text;
  v_actor_id uuid;
  v_actor_name text;
begin
  select r.name into v_racha_name from public.racha r where r.id = p_racha_id;
  if v_uid is not null then
    select p.id, p.display_name into v_actor_id, v_actor_name
    from public.profile p where p.id = v_uid;
  end if;

  insert into public.notification (
    recipient_id, kind, racha_id, racha_name, event_id, join_request_id,
    actor_id, actor_name, payload
  )
  select distinct r.recipient, p_kind, p_racha_id, v_racha_name, p_event_id,
    p_join_request_id, v_actor_id, v_actor_name, coalesce(p_payload, '{}'::jsonb)
  from unnest(p_recipients) as r(recipient)
  where r.recipient is not null
    and (
      not p_exclude_actor
      or v_uid is null
      or r.recipient is distinct from v_uid
    )
    and exists (
      select 1 from public.profile p
      where p.id = r.recipient and p.anonymized_at is null
    );
end $$;

-- Corpo de 20261012100000_delete_account; acrescenta o apagamento do nome nos Avisos
-- dos outros. O app lança erro com actor_name/by_name nulos, então o texto vira o
-- mesmo "Conta apagada" do Perfil.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select private.current_profile_id());
  v_racha_id uuid;
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;

  -- Mesma trava do leave_racha, em ordem fixa para não cruzar com outra transação.
  perform 1 from public.racha r
    where r.id in (
      select m.racha_id from public.member m where m.profile_id = v_uid and m.is_active
    )
    order by r.id
    for update;

  if exists (
    select 1 from public.member m
    where m.profile_id = v_uid and m.is_active and m.role = 'OWNER'
  ) or exists (
    select 1 from public.event e where e.status = 'active' and e.conductor_id = v_uid
  ) then
    raise exception 'account_deletion_blocked';
  end if;

  -- Antes do leave_racha_effects, que apaga as Solicitações. O join_request de um
  -- Aviso é sempre do próprio pedinte, o que atribui também os Avisos anteriores ao
  -- actor_id.
  update public.notification n
    set actor_name = 'Conta apagada', actor_id = null
    where n.actor_id = v_uid
      or (n.kind = 'join_request' and n.join_request_id in (
        select jr.id from public.join_request jr where jr.profile_id = v_uid
      ));

  -- Quem recusou ficou no retrato da resolução (refuse_join_request).
  update public.notification n
    set payload = jsonb_set(
      n.payload, '{resolution}',
      (n.payload -> 'resolution') - 'by_id' || jsonb_build_object('by_name', 'Conta apagada')
    )
    where n.payload #>> '{resolution,by_id}' = v_uid::text;

  for v_racha_id in
    select m.racha_id from public.member m
    where m.profile_id = v_uid and m.is_active
    order by m.racha_id
  loop
    perform private.leave_racha_effects(v_racha_id, v_uid);
  end loop;

  delete from public.join_request jr where jr.profile_id = v_uid;
  delete from public.push_token t where t.profile_id = v_uid;
  delete from public.notification n where n.recipient_id = v_uid;
  delete from public.racha_notice rn where rn.profile_id = v_uid;

  update public.profile set
    display_name = 'Conta apagada',
    avatar_path = null,
    birth_date = null,
    primary_position = null,
    secondary_position = null,
    anonymized_at = now()
  where id = v_uid;

  -- Sessões e identidades caem em cascata; o e-mail fica livre.
  delete from auth.users u where u.id = v_uid;
end $$;

-- Corpo de 20261013100000_report_and_block. O limite de 40 dos campos de nome é do CHECK;
-- texto acima dele não passa pelo unaccent/regex (1 MB custava ~2 s, inclusive para
-- anon em name_allowed) e segue para o CHECK, que o rejeita com o erro de sempre.
-- O btrim antes do corte mantém o resultado de quem manda espaços nas pontas.
create or replace function private.name_is_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with n as (
    select case
      when char_length(p_name) > 40 then btrim(p_name)
      else coalesce(p_name, '')
    end as v
  )
  select char_length(n.v) > 40 or not exists (
    select 1
    from private.blocked_word w
    where translate(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, n.v)),
        '43015@',
        'aeoisa'
      ) ~ ('\m' || w.word || '\M')
  )
  from n;
$$;
