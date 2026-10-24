-- Titular da chave PIX: o nome de quem recebe, que a chave nem sempre é do Dono. Vai na
-- tela Pagar e no campo 59 do QR. Anda junto da chave em todo lugar.

alter table private.racha_pix_key add column pix_key_holder text;
alter table public.event add column pix_key_holder text;

-- As chaves já salvas ficam com o nome do Dono, que é o que o QR já mostrava.
update private.racha_pix_key k
  set pix_key_holder = left(p.display_name, 60)
  from public.member m
  join public.profile p on p.id = m.profile_id
  where m.racha_id = k.racha_id and m.role = 'OWNER' and m.is_active;

update public.event e
  set pix_key_holder = left(p.display_name, 60)
  from public.member m
  join public.profile p on p.id = m.profile_id
  where e.pix_key is not null
    and m.racha_id = e.racha_id and m.role = 'OWNER' and m.is_active;

alter table private.racha_pix_key
  alter column pix_key_holder set not null,
  add constraint racha_pix_key_holder_length
    check (char_length(btrim(pix_key_holder)) between 2 and 60);

alter table public.event
  add constraint event_pix_key_holder_both
    check ((pix_key is null) = (pix_key_holder is null)),
  add constraint event_pix_key_holder_length
    check (char_length(btrim(pix_key_holder)) between 2 and 60);

-- Apara como normalize_pix_key; só é chamada quando há chave.
create function private.normalize_pix_key_holder(p_raw text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := regexp_replace(coalesce(p_raw, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if char_length(v_text) not between 2 and 60 then
    raise exception 'invalid_pix_key_holder';
  end if;
  return v_text;
end $$;

revoke execute on function private.normalize_pix_key_holder(text)
  from public, anon, authenticated;

create or replace function private.copy_racha_pix_key_to_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pix_key is null and (tg_op = 'INSERT' or (new.is_paid and not old.is_paid)) then
    select k.pix_key, k.pix_key_type, k.pix_key_holder
      into new.pix_key, new.pix_key_type, new.pix_key_holder
    from private.racha_pix_key k where k.racha_id = new.racha_id;
  end if;
  return new;
end $$;

drop function public.set_racha_pix_key(uuid, text);

create function public.set_racha_pix_key(p_racha_id uuid, p_key text, p_holder text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new record;
  v_holder text;
begin
  perform 1 from public.racha r where r.id = p_racha_id for update;
  perform private.assert_pix_key_owner(p_racha_id);
  select * into v_new from private.normalize_pix_key_or_null(p_key);

  if v_new.key is null then
    delete from private.racha_pix_key k where k.racha_id = p_racha_id;
  else
    v_holder := private.normalize_pix_key_holder(p_holder);
    insert into private.racha_pix_key (racha_id, pix_key, pix_key_type, pix_key_holder)
    values (p_racha_id, v_new.key, v_new.type, v_holder)
    on conflict (racha_id) do update
      set pix_key = excluded.pix_key,
        pix_key_type = excluded.pix_key_type,
        pix_key_holder = excluded.pix_key_holder;
  end if;

  -- Decisão 10: vale para todo Evento aberto, inclusive o que tinha chave própria.
  update public.event e
    set pix_key = v_new.key, pix_key_type = v_new.type, pix_key_holder = v_holder
    where e.racha_id = p_racha_id and e.status in ('upcoming', 'active');
end $$;

revoke execute on function public.set_racha_pix_key(uuid, text, text) from public, anon;
grant execute on function public.set_racha_pix_key(uuid, text, text) to authenticated;

drop function public.set_event_pix_key(uuid, text);

create function public.set_event_pix_key(p_event_id uuid, p_key text, p_holder text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_new record;
  v_holder text;
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
  if v_new.key is not null then
    v_holder := private.normalize_pix_key_holder(p_holder);
  end if;
  update public.event e
    set pix_key = v_new.key, pix_key_type = v_new.type, pix_key_holder = v_holder
    where e.id = p_event_id;
end $$;

revoke execute on function public.set_event_pix_key(uuid, text, text) from public, anon;
grant execute on function public.set_event_pix_key(uuid, text, text) to authenticated;

drop function public.get_racha_pix_key(uuid);

create function public.get_racha_pix_key(p_racha_id uuid)
returns table (
  pix_key text,
  pix_key_type text,
  pix_key_holder text,
  has_open_event_key boolean
)
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
    select k.pix_key, k.pix_key_type, k.pix_key_holder, exists (
      select 1 from public.event e
      where e.racha_id = p_racha_id
        and e.status in ('upcoming', 'active')
        and e.pix_key is not null
    )
    from (select 1) one
    left join private.racha_pix_key k on k.racha_id = p_racha_id;
end $$;

revoke execute on function public.get_racha_pix_key(uuid) from public, anon;
grant execute on function public.get_racha_pix_key(uuid) to authenticated;

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
  pix_key_type text,
  pix_key_holder text
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
      case when v_sees_key then e.pix_key_type end,
      case when v_sees_key then e.pix_key_holder end
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

-- Veio de 20261020100000_pix_audit_fixes.sql. Entra o titular na limpeza da chave.
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

-- Veio de 20261020100000_pix_audit_fixes.sql. Com chave, o recebedor é o titular; sem
-- chave a tela segue mostrando o Dono.
create or replace function public.get_payment(p_event_id uuid)
returns table (
  daily_price integer,
  credit_available integer,
  credit_balance integer,
  amount_due integer,
  is_paid boolean,
  is_waitlisted boolean,
  is_owner boolean,
  recipient_name text,
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
  v_event public.event%rowtype;
  v_status public.attendance_status;
  v_daily integer;
  v_credit integer;
  v_balance integer;
  v_shows_key boolean;
begin
  select * into v_event from public.event e where e.id = p_event_id;

  select ea.status into v_status from public.event_attendance ea
    where ea.event_id = p_event_id
      and ea.profile_id = v_uid
      and ea.status in ('confirmed', 'waitlisted');

  if v_status is null or public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_in_event';
  end if;

  -- Evento grátis tem price nulo, e least() ignora nulo: sem o coalesce o Crédito viraria o saldo.
  v_daily := case when v_event.is_paid then coalesce(v_event.price, 0) else 0 end;
  v_balance := private.credit_balance(v_event.racha_id, v_uid);
  v_credit := least(v_balance, v_daily);
  v_shows_key := v_event.is_paid and v_event.status <> 'finished' and v_event.pix_key is not null;

  return query
    select
      v_daily,
      v_credit,
      v_balance,
      v_daily - v_credit,
      (
        private.member_has_event_monthly_pass(p_event_id, v_uid)
        or coalesce(f.paid_marked_at is not null, false)
        or coalesce(f.monthly_coverage_month
          = private.event_civil_year_month(v_event.starts_on, v_event.starts_at), false)
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false)
      ),
      v_status = 'waitlisted',
      public.my_racha_role(v_event.racha_id) = 'OWNER',
      case when v_shows_key then v_event.pix_key_holder
      else (select p.display_name from public.member m
            join public.profile p on p.id = m.profile_id
            where m.racha_id = v_event.racha_id and m.role = 'OWNER' and m.is_active)
      end,
      case when v_shows_key then v_event.pix_key end,
      case when v_shows_key then v_event.pix_key_type end
    from (select 1) one
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = v_uid;
end $$;
