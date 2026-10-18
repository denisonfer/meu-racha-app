-- Chave PIX do Racha e do Evento. Só o Dono com e-mail confirmado grava; Dono e Admin
-- leem. A do Racha fica em private porque public.racha tem a política "Membro lê".

create table private.racha_pix_key (
  racha_id uuid primary key references public.racha (id) on delete cascade,
  pix_key text not null,
  pix_key_type text not null
    check (pix_key_type in ('cpf', 'cnpj', 'email', 'phone', 'random'))
);

revoke all on private.racha_pix_key from public, anon, authenticated;

alter table public.event
  add column pix_key text,
  add column pix_key_type text
    check (pix_key_type in ('cpf', 'cnpj', 'email', 'phone', 'random')),
  add constraint event_pix_key_both check ((pix_key is null) = (pix_key_type is null));

-- Dígitos verificadores de CPF/CNPJ (módulo 11), como hasValidCheckDigits do domínio.
create function private.pix_check_digits_ok(p_digits text, p_weights integer[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select bool_and(
    substr(p_digits, k.n, 1)::integer = case when k.s % 11 < 2 then 0 else 11 - k.s % 11 end
  )
  from (
    select n, (
      select sum(substr(p_digits, i, 1)::integer * w.weights[i])
      from generate_subscripts(w.weights, 1) i
    ) s
    from (values
      (cardinality(p_weights), p_weights[2:]),
      (cardinality(p_weights) + 1, p_weights)
    ) w(n, weights)
  ) k
$$;

-- Mesmas regras de normalizePixKey (packages/domain/src/pix/pix-key.ts).
create function private.normalize_pix_key(p_raw text, out key text, out type text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := regexp_replace(coalesce(p_raw, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_lower text := lower(v_text);
  v_digits text;
  v_national text;
begin
  if v_text = '' then
    raise exception 'invalid_pix_key';
  end if;

  if strpos(v_text, '@') > 0 then
    if char_length(v_lower) <= 77 and v_lower ~ '^[!-~]+@[!-~]+\.[!-~]+$' then
      key := v_lower;
      type := 'email';
      return;
    end if;
    raise exception 'invalid_pix_key';
  end if;

  if v_lower ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    key := v_lower;
    type := 'random';
    return;
  end if;

  if v_text !~ '^[0-9[:space:]().+/-]+$' then
    raise exception 'invalid_pix_key';
  end if;
  v_digits := regexp_replace(v_text, '[^0-9]', '', 'g');

  -- Com +55 ou máscara de telefone a intenção é celular, mesmo que os dígitos formem um CPF.
  if left(v_text, 1) = '+' then
    v_national := case when left(v_digits, 2) = '55' then substr(v_digits, 3) end;
  elsif v_text ~ '[()[:space:]]' and char_length(v_digits) = 11 then
    v_national := v_digits;
  elsif v_digits ~ '^[0-9]{11}$' and v_digits !~ '^([0-9])\1+$'
    and private.pix_check_digits_ok(v_digits, '{11,10,9,8,7,6,5,4,3,2}') then
    key := v_digits;
    type := 'cpf';
    return;
  elsif v_digits ~ '^[0-9]{14}$' and v_digits !~ '^([0-9])\1+$'
    and private.pix_check_digits_ok(v_digits, '{6,5,4,3,2,9,8,7,6,5,4,3,2}') then
    key := v_digits;
    type := 'cnpj';
    return;
  elsif v_text ~ '^[0-9]{11}$' then
    v_national := v_digits;
  end if;

  if v_national ~ '^[1-9]{2}9[0-9]{8}$' then
    key := '+55' || v_national;
    type := 'phone';
    return;
  end if;
  raise exception 'invalid_pix_key';
end $$;

-- Todo caminho que cria Evento (create_event, a recorrência e o que vier) nasce com a
-- chave do Racha; Evento que vira pago sem chave também pega a do Racha.
create function private.copy_racha_pix_key_to_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pix_key is null and (tg_op = 'INSERT' or (new.is_paid and not old.is_paid)) then
    select k.pix_key, k.pix_key_type into new.pix_key, new.pix_key_type
    from private.racha_pix_key k where k.racha_id = new.racha_id;
  end if;
  return new;
end $$;

create trigger event_copy_racha_pix_key
  before insert or update of is_paid on public.event
  for each row execute function private.copy_racha_pix_key_to_event();

-- As mesmas travas para as duas RPCs; quem chama já travou o Racha.
create function private.assert_pix_key_owner(p_racha_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.my_racha_role(p_racha_id) is distinct from 'OWNER' then
    raise exception 'not_owner';
  end if;

  if not exists (
    select 1 from public.profile p
    where p.id = (select private.current_profile_id()) and p.email_verified_at is not null
  ) then
    raise exception 'email_not_verified';
  end if;
end $$;

-- Chave nula ou só espaços apaga; o resto passa pela normalização.
create function private.normalize_pix_key_or_null(p_raw text, out key text, out type text)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if coalesce(p_raw, '') !~ '[^[:space:]]' then
    return;
  end if;
  select n.key, n.type into key, type from private.normalize_pix_key(p_raw) n;
end $$;

create function public.set_racha_pix_key(p_racha_id uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new record;
begin
  perform 1 from public.racha r where r.id = p_racha_id for update;
  perform private.assert_pix_key_owner(p_racha_id);
  select * into v_new from private.normalize_pix_key_or_null(p_key);

  if v_new.key is null then
    delete from private.racha_pix_key k where k.racha_id = p_racha_id;
  else
    insert into private.racha_pix_key (racha_id, pix_key, pix_key_type)
    values (p_racha_id, v_new.key, v_new.type)
    on conflict (racha_id) do update
      set pix_key = excluded.pix_key, pix_key_type = excluded.pix_key_type;
  end if;

  -- Decisão 10: vale para todo Evento aberto, inclusive o que tinha chave própria.
  update public.event e
    set pix_key = v_new.key, pix_key_type = v_new.type
    where e.racha_id = p_racha_id and e.status in ('upcoming', 'active');
end $$;

create function public.set_event_pix_key(p_event_id uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_new record;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.racha r where r.id = v_event.racha_id for update;
  perform private.assert_pix_key_owner(v_event.racha_id);

  select * into v_event from public.event e where e.id = p_event_id;
  if v_event.status not in ('upcoming', 'active') then
    raise exception 'event_closed';
  end if;

  select * into v_new from private.normalize_pix_key_or_null(p_key);
  update public.event e
    set pix_key = v_new.key, pix_key_type = v_new.type
    where e.id = p_event_id;
end $$;

-- has_open_event_key alimenta o aviso da Passagem.
create function public.get_racha_pix_key(p_racha_id uuid)
returns table (pix_key text, pix_key_type text, has_open_event_key boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.my_racha_role(p_racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  return query
    select k.pix_key, k.pix_key_type, exists (
      select 1 from public.event e
      where e.racha_id = p_racha_id
        and e.status in ('upcoming', 'active')
        and e.pix_key is not null
    )
    from (select 1) one
    left join private.racha_pix_key k on k.racha_id = p_racha_id;
end $$;

revoke execute on function public.set_racha_pix_key(uuid, text) from public, anon;
grant execute on function public.set_racha_pix_key(uuid, text) to authenticated;
revoke execute on function public.set_event_pix_key(uuid, text) from public, anon;
grant execute on function public.set_event_pix_key(uuid, text) to authenticated;
revoke execute on function public.get_racha_pix_key(uuid) from public, anon;
grant execute on function public.get_racha_pix_key(uuid) to authenticated;

-- Veio de 20261003240000_event_match_integration.sql. Entram pix_key e pix_key_type,
-- só para Dono e Admin (o formulário do Evento lê daqui).
drop function public.list_open_events(uuid);

create function public.list_open_events(p_racha_id uuid)
returns table (
  id uuid,
  status public.event_status,
  starts_on date,
  starts_at time,
  place text,
  is_paid boolean,
  price integer,
  spot_limit smallint,
  payer_target integer,
  outfield_per_team smallint,
  conductor_id uuid,
  conductor_name text,
  confirmed_count integer,
  my_status text,
  my_queue_position integer,
  sort_confirmed boolean,
  match_state text,
  match_home_score integer,
  match_away_score integer,
  next_home_team_number integer,
  next_away_team_number integer,
  pix_key text,
  pix_key_type text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.member_role := public.my_racha_role(p_racha_id);
  v_sees_key boolean := coalesce(v_role in ('OWNER', 'ADMIN'), false);
begin
  if v_role is null then
    raise exception 'not_member';
  end if;

  return query
    select e.id, e.status, e.starts_on, e.starts_at, e.place, e.is_paid, e.price,
      e.spot_limit, e.payer_target, e.outfield_per_team, e.conductor_id, p.display_name,
      private.event_occupancy(e.id),
      ea.status::text,
      case when ea.status = 'waitlisted' then private.my_waitlist_position(e.id, v_uid) else null end,
      private.event_sort_confirmed(e.id),
      card.match_state, card.match_home_score, card.match_away_score,
      card.next_home_team_number, card.next_away_team_number,
      case when v_sees_key then e.pix_key end,
      case when v_sees_key then e.pix_key_type end
    from public.event e
    left join public.profile p on p.id = e.conductor_id
    left join public.event_attendance ea
      on ea.event_id = e.id and ea.profile_id = v_uid
    left join lateral private.event_match_list_fields(e.id) card on true
    where e.racha_id = p_racha_id
      and e.status in ('upcoming', 'active')
    order by
      case e.status when 'active' then 0 else 1 end,
      e.starts_on,
      e.starts_at,
      e.id;
end $$;

revoke execute on function public.list_open_events(uuid) from public, anon;
grant execute on function public.list_open_events(uuid) to authenticated;

-- Veio de 20261009100000_notifications.sql. Entra só a limpeza da chave: ela é do Dono
-- que sai, e o novo cadastra a dele.
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

  if exists (
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
    set pix_key = null, pix_key_type = null
    where e.racha_id = p_racha_id
      and e.status in ('upcoming', 'active')
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

revoke execute on function private.pix_check_digits_ok(text, integer[])
  from public, anon, authenticated;
revoke execute on function private.normalize_pix_key(text)
  from public, anon, authenticated;
revoke execute on function private.copy_racha_pix_key_to_event()
  from public, anon, authenticated;
revoke execute on function private.assert_pix_key_owner(uuid)
  from public, anon, authenticated;
revoke execute on function private.normalize_pix_key_or_null(text)
  from public, anon, authenticated;
