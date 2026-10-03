-- Fatia 5d: Presença, fila, Avulso, Mensalista, pagamento e Crédito mínimo.

create type public.attendance_status as enum (
  'confirmed', 'waitlisted', 'cancelled'
);

create table public.event_attendance (
  event_id uuid not null references public.event (id) on delete cascade,
  profile_id uuid not null references public.profile (id),
  status public.attendance_status not null,
  did_attend boolean not null default false,
  waitlisted_at timestamptz,
  primary key (event_id, profile_id),
  constraint attendance_waitlisted_at_matches_status check (
    (status = 'waitlisted' and waitlisted_at is not null)
    or (status <> 'waitlisted' and waitlisted_at is null)
  )
);

create table public.event_guest (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event (id) on delete cascade,
  display_name text not null,
  plays_as public.plays_as not null,
  primary_position public.position,
  secondary_position public.position,
  stars smallint,
  is_super_star boolean not null default false,
  did_attend boolean not null default false,
  is_paid boolean not null default false,
  constraint guest_display_name_is_reasonable check (
    char_length(display_name) between 2 and 40
    and display_name ~ '^[[:alpha:]][[:alpha:] ''.-]*$'
  ),
  constraint guest_stars_range check (stars is null or stars between 1 and 5),
  constraint guest_stars_match_plays_as check (
    case plays_as
      when 'GOALKEEPER' then stars is null and not is_super_star
      else stars is not null
    end
  ),
  constraint guest_position_matches_plays_as check (
    case plays_as
      when 'GOALKEEPER' then primary_position is null and secondary_position is null
      when 'OUTFIELD' then
        primary_position is not null
        and case
          when primary_position = 'ANY' then secondary_position is null
          else secondary_position is not null
               and secondary_position <> 'ANY'
               and secondary_position <> primary_position
        end
    end
  )
);

create table public.racha_monthly_pass (
  racha_id uuid not null references public.racha (id) on delete cascade,
  profile_id uuid not null references public.profile (id),
  year_month text not null,
  primary key (racha_id, profile_id, year_month),
  constraint monthly_pass_year_month_shape check (
    year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'
  )
);

create table public.event_payment_fact (
  event_id uuid not null,
  racha_id uuid not null references public.racha (id) on delete cascade,
  profile_id uuid not null references public.profile (id),
  event_year_month text not null,
  daily_amount_snapshot integer not null,
  cash_paid_amount integer not null default 0,
  credit_applied_amount integer not null default 0,
  monthly_coverage_month text,
  did_attend boolean not null default false,
  paid_marked_at timestamptz,
  cancelled_at timestamptz,
  primary key (event_id, profile_id),
  constraint payment_amounts_nonnegative check (
    daily_amount_snapshot >= 0
    and cash_paid_amount >= 0
    and credit_applied_amount >= 0
  )
);

create table public.racha_credit_entry (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.racha (id) on delete cascade,
  profile_id uuid not null references public.profile (id),
  source_event_id uuid not null,
  operation_key text not null unique,
  entry_kind text not null check (
    entry_kind in ('cancel_daily', 'apply', 'restore')
  ),
  amount_delta integer not null check (amount_delta <> 0),
  source_grant_id uuid references public.racha_credit_entry (id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.event_attendance enable row level security;
alter table public.event_guest enable row level security;
alter table public.racha_monthly_pass enable row level security;
alter table public.event_payment_fact enable row level security;
alter table public.racha_credit_entry enable row level security;

revoke all on public.event_attendance, public.event_guest, public.racha_monthly_pass,
  public.event_payment_fact, public.racha_credit_entry
  from public, anon, authenticated;

-- --- helpers internos ---

create function private.event_civil_year_month(p_starts_on date, p_starts_at time)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(
    ((p_starts_on + p_starts_at) at time zone 'America/Sao_Paulo')::date,
    'YYYY-MM'
  );
$$;

revoke execute on function private.event_civil_year_month(date, time)
  from public, anon, authenticated;

create function private.event_confirmed_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.event_attendance ea
  where ea.event_id = p_event_id and ea.status = 'confirmed';
$$;

revoke execute on function private.event_confirmed_count(uuid)
  from public, anon, authenticated;

create function private.event_occupancy(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.event_confirmed_count(p_event_id)
    + (select count(*)::integer from public.event_guest g where g.event_id = p_event_id);
$$;

revoke execute on function private.event_occupancy(uuid)
  from public, anon, authenticated;

create function private.event_has_waitlist(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_attendance ea
    where ea.event_id = p_event_id and ea.status = 'waitlisted'
  );
$$;

revoke execute on function private.event_has_waitlist(uuid)
  from public, anon, authenticated;

create function private.member_has_event_monthly_pass(p_event_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event e
    join public.racha_monthly_pass mp
      on mp.racha_id = e.racha_id
     and mp.profile_id = p_profile_id
     and mp.year_month = private.event_civil_year_month(e.starts_on, e.starts_at)
    where e.id = p_event_id
  );
$$;

revoke execute on function private.member_has_event_monthly_pass(uuid, uuid)
  from public, anon, authenticated;

create function private.grant_remaining(p_grant_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    g.amount_delta
    + coalesce((
      select sum(c.amount_delta)
      from public.racha_credit_entry c
      where c.source_grant_id = g.id
    ), 0)
  )::integer
  from public.racha_credit_entry g
  where g.id = p_grant_id
    and g.entry_kind = 'cancel_daily';
$$;

revoke execute on function private.grant_remaining(uuid)
  from public, anon, authenticated;

create function private.credit_balance(p_racha_id uuid, p_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(private.grant_remaining(g.id)), 0)::integer
  from public.racha_credit_entry g
  where g.racha_id = p_racha_id
    and g.profile_id = p_profile_id
    and g.entry_kind = 'cancel_daily'
    and (g.expires_at is null or g.expires_at > now())
    and private.grant_remaining(g.id) > 0;
$$;

revoke execute on function private.credit_balance(uuid, uuid)
  from public, anon, authenticated;

create function private.lock_credit_balance(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serializa o saldo Membro×Racha contra double-spend concorrente.
  perform 1
  from public.member m
  where m.racha_id = p_racha_id and m.profile_id = p_profile_id
  for update;

  perform 1
  from public.racha_credit_entry c
  where c.racha_id = p_racha_id and c.profile_id = p_profile_id
  for update;
end $$;

revoke execute on function private.lock_credit_balance(uuid, uuid)
  from public, anon, authenticated;

create function private.sync_monthly_coverage_for_member(p_event_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_year_month text;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  -- Cobertura de Evento liquidado/finished fica congelada.
  if not found or not v_event.is_paid or v_event.status not in ('upcoming', 'active') then
    return;
  end if;

  v_year_month := private.event_civil_year_month(v_event.starts_on, v_event.starts_at);

  if not private.member_has_event_monthly_pass(p_event_id, p_profile_id) then
    -- Desmarcar passe: limpa cobertura nos abertos sem sobrescrever diária já paga.
    update public.event_payment_fact f set
      monthly_coverage_month = null
    where f.event_id = p_event_id
      and f.profile_id = p_profile_id
      and f.cash_paid_amount = 0
      and f.credit_applied_amount = 0
      and f.paid_marked_at is null;

    -- Remove fato que só existia pela cobertura mensal (preserva did_attend).
    delete from public.event_payment_fact f
    where f.event_id = p_event_id
      and f.profile_id = p_profile_id
      and f.cash_paid_amount = 0
      and f.credit_applied_amount = 0
      and f.paid_marked_at is null
      and f.monthly_coverage_month is null
      and f.cancelled_at is null
      and not f.did_attend;

    return;
  end if;

  insert into public.event_payment_fact (
    event_id, racha_id, profile_id, event_year_month, daily_amount_snapshot,
    monthly_coverage_month, did_attend
  )
  select
    p_event_id, v_event.racha_id, p_profile_id, v_year_month, v_event.price,
    v_year_month, coalesce(ea.did_attend, false)
  from public.event_attendance ea
  where ea.event_id = p_event_id
    and ea.profile_id = p_profile_id
    and ea.status = 'confirmed'
  on conflict (event_id, profile_id) do update set
    monthly_coverage_month = excluded.monthly_coverage_month,
    daily_amount_snapshot = excluded.daily_amount_snapshot
  where public.event_payment_fact.cash_paid_amount = 0
    and public.event_payment_fact.credit_applied_amount = 0
    and public.event_payment_fact.paid_marked_at is null;
end $$;

revoke execute on function private.sync_monthly_coverage_for_member(uuid, uuid)
  from public, anon, authenticated;

create function private.promote_waitlist_for_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_slots integer;
  v_profile_id uuid;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    return;
  end if;

  loop
    if v_event.spot_limit is not null then
      v_slots := v_event.spot_limit - private.event_occupancy(p_event_id);
      if v_slots <= 0 then
        exit;
      end if;
    end if;

    select ea.profile_id into v_profile_id
    from public.event_attendance ea
    where ea.event_id = p_event_id and ea.status = 'waitlisted'
    order by
      case when private.member_has_event_monthly_pass(p_event_id, ea.profile_id) then 0 else 1 end,
      ea.waitlisted_at,
      ea.profile_id
    limit 1
    for update of ea;

    if not found then
      exit;
    end if;

    update public.event_attendance ea set
      status = 'confirmed',
      waitlisted_at = null
    where ea.event_id = p_event_id and ea.profile_id = v_profile_id;

    perform private.sync_monthly_coverage_for_member(p_event_id, v_profile_id);
  end loop;
end $$;

revoke execute on function private.promote_waitlist_for_event(uuid)
  from public, anon, authenticated;

create function private.lock_event_for_attendance(p_event_id uuid)
returns public.event
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.racha r where r.id = v_event.racha_id for update;

  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  return v_event;
end $$;

revoke execute on function private.lock_event_for_attendance(uuid)
  from public, anon, authenticated;

create function private.assert_open_attendance_event(p_event public.event)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event.status not in ('upcoming', 'active') then
    raise exception 'not_allowed';
  end if;
end $$;

revoke execute on function private.assert_open_attendance_event(public.event)
  from public, anon, authenticated;

create function private.try_confirm_member(p_event_id uuid, p_profile_id uuid)
returns public.attendance_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_has_slot boolean;
begin
  select * into v_event from public.event e where e.id = p_event_id;

  perform private.promote_waitlist_for_event(p_event_id);

  v_has_slot := v_event.spot_limit is null
    or private.event_occupancy(p_event_id) < v_event.spot_limit;

  if v_has_slot then
    insert into public.event_attendance (event_id, profile_id, status)
    values (p_event_id, p_profile_id, 'confirmed')
    on conflict (event_id, profile_id) do update set
      status = 'confirmed',
      waitlisted_at = null;
    perform private.sync_monthly_coverage_for_member(p_event_id, p_profile_id);
    return 'confirmed'::public.attendance_status;
  end if;

  insert into public.event_attendance (event_id, profile_id, status, waitlisted_at)
  values (p_event_id, p_profile_id, 'waitlisted', now())
  on conflict (event_id, profile_id) do update set
    status = 'waitlisted',
    waitlisted_at = coalesce(event_attendance.waitlisted_at, now());

  return 'waitlisted'::public.attendance_status;
end $$;

revoke execute on function private.try_confirm_member(uuid, uuid)
  from public, anon, authenticated;

create function private.insert_credit_entry(
  p_racha_id uuid,
  p_profile_id uuid,
  p_source_event_id uuid,
  p_operation_key text,
  p_entry_kind text,
  p_amount_delta integer,
  p_expires_at timestamptz default null,
  p_source_grant_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.racha_credit_entry (
    racha_id, profile_id, source_event_id, operation_key, entry_kind,
    amount_delta, expires_at, source_grant_id
  ) values (
    p_racha_id, p_profile_id, p_source_event_id, p_operation_key, p_entry_kind,
    p_amount_delta, p_expires_at, p_source_grant_id
  )
  on conflict (operation_key) do nothing;
end $$;

revoke execute on function private.insert_credit_entry(
  uuid, uuid, uuid, text, text, integer, timestamptz, uuid
) from public, anon, authenticated;

-- Consome concessões FIFO, uma linha apply por parcela, com source_grant_id.
-- Só conta o que de fato entrou (ou já existia) — ON CONFLICT não infla v_applied.
create function private.apply_credit_fifo(
  p_racha_id uuid,
  p_profile_id uuid,
  p_source_event_id uuid,
  p_operation_prefix text,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_needed integer := p_amount;
  v_grant record;
  v_remaining integer;
  v_take integer;
  v_applied integer := 0;
  v_op_key text;
  v_got integer;
begin
  if p_amount <= 0 then
    return 0;
  end if;

  perform private.lock_credit_balance(p_racha_id, p_profile_id);

  for v_grant in
    select g.id, g.expires_at
    from public.racha_credit_entry g
    where g.racha_id = p_racha_id
      and g.profile_id = p_profile_id
      and g.entry_kind = 'cancel_daily'
      and (g.expires_at is null or g.expires_at > now())
    order by g.created_at, g.id
    for update of g
  loop
    exit when v_needed <= 0;

    v_remaining := private.grant_remaining(v_grant.id);
    if v_remaining <= 0 then
      continue;
    end if;

    v_take := least(v_remaining, v_needed);
    v_op_key := format('%s:%s', p_operation_prefix, v_grant.id);

    insert into public.racha_credit_entry (
      racha_id, profile_id, source_event_id, operation_key, entry_kind,
      amount_delta, expires_at, source_grant_id
    ) values (
      p_racha_id, p_profile_id, p_source_event_id, v_op_key, 'apply',
      -v_take, null, v_grant.id
    )
    on conflict (operation_key) do nothing
    returning abs(amount_delta) into v_got;

    if v_got is null then
      -- Retry idempotente: a apply já existe e ainda consome o saldo.
      select abs(c.amount_delta) into v_got
      from public.racha_credit_entry c
      where c.operation_key = v_op_key and c.entry_kind = 'apply';
    end if;

    if v_got is null then
      continue;
    end if;

    v_applied := v_applied + v_got;
    v_needed := v_needed - v_got;
  end loop;

  return v_applied;
end $$;

revoke execute on function private.apply_credit_fifo(uuid, uuid, uuid, text, integer)
  from public, anon, authenticated;

-- Restaura exatamente as parcelas apply deste Evento×Membro (idempotente por operation_key).
create function private.restore_credit_applies(
  p_racha_id uuid,
  p_profile_id uuid,
  p_source_event_id uuid,
  p_operation_prefix text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_apply record;
  v_restored integer := 0;
begin
  perform private.lock_credit_balance(p_racha_id, p_profile_id);

  for v_apply in
    select c.id, c.amount_delta, c.source_grant_id
    from public.racha_credit_entry c
    where c.racha_id = p_racha_id
      and c.profile_id = p_profile_id
      and c.source_event_id = p_source_event_id
      and c.entry_kind = 'apply'
      and c.source_grant_id is not null
    order by c.created_at, c.id
    for update of c
  loop
    perform private.insert_credit_entry(
      p_racha_id,
      p_profile_id,
      p_source_event_id,
      format('%s:%s', p_operation_prefix, v_apply.source_grant_id),
      'restore',
      -v_apply.amount_delta,
      null,
      v_apply.source_grant_id
    );
    v_restored := v_restored + (-v_apply.amount_delta);
  end loop;

  return v_restored;
end $$;

revoke execute on function private.restore_credit_applies(uuid, uuid, uuid, text)
  from public, anon, authenticated;

create function private.process_event_cancellation_credits(p_event_id uuid, p_racha_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fact record;
begin
  for v_fact in
    select f.*
    from public.event_payment_fact f
    where f.event_id = p_event_id and f.cancelled_at is null
    for update
  loop
    if v_fact.cash_paid_amount > 0 then
      perform private.insert_credit_entry(
        p_racha_id,
        v_fact.profile_id,
        p_event_id,
        format('cancel_event:%s:grant:%s', p_event_id, v_fact.profile_id),
        'cancel_daily',
        v_fact.cash_paid_amount,
        now() + interval '6 months',
        null
      );
    end if;

    if v_fact.credit_applied_amount > 0 then
      perform private.restore_credit_applies(
        p_racha_id,
        v_fact.profile_id,
        p_event_id,
        format('cancel_event:%s:restore:%s', p_event_id, v_fact.profile_id)
      );
    end if;

    update public.event_payment_fact f set cancelled_at = now()
    where f.event_id = p_event_id and f.profile_id = v_fact.profile_id;
  end loop;
end $$;

revoke execute on function private.process_event_cancellation_credits(uuid, uuid)
  from public, anon, authenticated;

create function private.cleanup_member_attendance(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_was_confirmed boolean;
begin
  for v_event_id in
    select e.id
    from public.event e
    where e.racha_id = p_racha_id and e.status in ('upcoming', 'active')
  loop
    select exists (
      select 1 from public.event_attendance ea
      where ea.event_id = v_event_id
        and ea.profile_id = p_profile_id
        and ea.status = 'confirmed'
    ) into v_was_confirmed;

    delete from public.event_attendance ea
    where ea.event_id = v_event_id and ea.profile_id = p_profile_id;

    if v_was_confirmed then
      perform private.promote_waitlist_for_event(v_event_id);
    end if;
  end loop;
end $$;

revoke execute on function private.cleanup_member_attendance(uuid, uuid)
  from public, anon, authenticated;

create function private.my_waitlist_position(p_event_id uuid, p_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select q.pos::integer
  from (
    select ea.profile_id,
      row_number() over (
        order by
          case when private.member_has_event_monthly_pass(p_event_id, ea.profile_id) then 0 else 1 end,
          ea.waitlisted_at,
          ea.profile_id
      ) as pos
    from public.event_attendance ea
    where ea.event_id = p_event_id and ea.status = 'waitlisted'
  ) q
  where q.profile_id = p_profile_id;
$$;

revoke execute on function private.my_waitlist_position(uuid, uuid)
  from public, anon, authenticated;

-- --- leitura ampliada ---

drop function if exists public.list_open_events(uuid);

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
  outfield_per_team smallint,
  conductor_id uuid,
  conductor_name text,
  confirmed_count integer,
  my_status text,
  my_queue_position integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if public.my_racha_role(p_racha_id) is null then
    raise exception 'not_member';
  end if;

  return query
    select e.id, e.status, e.starts_on, e.starts_at, e.place, e.is_paid, e.price,
      e.spot_limit, e.outfield_per_team, e.conductor_id, p.display_name,
      -- confirmed_count = vagas ocupadas (membros confirmed + Avulsos).
      private.event_occupancy(e.id),
      ea.status::text,
      case when ea.status = 'waitlisted' then private.my_waitlist_position(e.id, v_uid) else null end
    from public.event e
    left join public.profile p on p.id = e.conductor_id
    left join public.event_attendance ea
      on ea.event_id = e.id and ea.profile_id = v_uid
    where e.racha_id = p_racha_id
      and e.status in ('upcoming'::public.event_status, 'active'::public.event_status)
    order by e.starts_on, e.starts_at, e.id;
end $$;

revoke execute on function public.list_open_events(uuid) from public, anon;
grant execute on function public.list_open_events(uuid) to authenticated;

drop function if exists public.list_my_racha_events();

create function public.list_my_racha_events()
returns table (
  racha_id uuid,
  id uuid,
  status public.event_status,
  starts_on date,
  starts_at time,
  place text,
  confirmed_count integer,
  my_status text,
  my_queue_position integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.racha_id, selected.id, selected.status, selected.starts_on,
    selected.starts_at, selected.place,
    -- confirmed_count = vagas ocupadas (membros confirmed + Avulsos).
    private.event_occupancy(selected.id),
    ea.status::text,
    case when ea.status = 'waitlisted'
      then private.my_waitlist_position(selected.id, m.profile_id)
      else null
    end
  from public.member m
  join lateral (
    select e.id, e.status, e.starts_on, e.starts_at, e.place
    from public.event e
    where e.racha_id = m.racha_id
      and e.status in ('active'::public.event_status, 'upcoming'::public.event_status)
    order by case when e.status = 'active' then 0 else 1 end,
      e.starts_on, e.starts_at, e.id
    limit 1
  ) selected on true
  left join public.event_attendance ea
    on ea.event_id = selected.id and ea.profile_id = m.profile_id
  where m.profile_id = (select auth.uid())
    and m.is_active;
$$;

revoke execute on function public.list_my_racha_events() from public, anon;
grant execute on function public.list_my_racha_events() to authenticated;

create function public.list_event_attendance(p_event_id uuid)
returns table (
  kind text,
  profile_id uuid,
  guest_id uuid,
  status public.attendance_status,
  queue_position integer,
  display_name text,
  did_attend boolean,
  is_paid_effective boolean,
  is_monthly_pass boolean,
  cash_paid_amount integer,
  credit_applied_amount integer,
  plays_as public.plays_as,
  stars smallint,
  is_super_star boolean,
  avatar_path text,
  primary_position public.position,
  secondary_position public.position,
  role public.member_role
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_role public.member_role;
  v_year_month text;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  if public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_member';
  end if;

  v_role := public.my_racha_role(v_event.racha_id);
  v_year_month := private.event_civil_year_month(v_event.starts_on, v_event.starts_at);

  return query
    select
      'member'::text,
      ea.profile_id,
      null::uuid,
      ea.status,
      case when ea.status = 'waitlisted'
        then private.my_waitlist_position(p_event_id, ea.profile_id)
        else null
      end,
      p.display_name,
      ea.did_attend,
      (
        private.member_has_event_monthly_pass(p_event_id, ea.profile_id)
        or coalesce(f.paid_marked_at is not null, false)
        or coalesce(f.monthly_coverage_month = v_year_month, false)
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false)
      ),
      private.member_has_event_monthly_pass(p_event_id, ea.profile_id),
      f.cash_paid_amount,
      f.credit_applied_amount,
      m.plays_as,
      m.stars,
      m.is_super_star,
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role
    from public.event_attendance ea
    join public.profile p on p.id = ea.profile_id
    join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = ea.profile_id
    where ea.event_id = p_event_id
      and ea.status in ('confirmed', 'waitlisted')
    union all
    select
      'member'::text,
      ea.profile_id,
      null::uuid,
      ea.status,
      null::integer,
      p.display_name,
      ea.did_attend,
      coalesce(f.paid_marked_at is not null, false)
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false),
      false,
      f.cash_paid_amount,
      f.credit_applied_amount,
      m.plays_as,
      m.stars,
      m.is_super_star,
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role
    from public.event_attendance ea
    join public.profile p on p.id = ea.profile_id
    join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = ea.profile_id
    where ea.event_id = p_event_id
      and ea.status = 'cancelled'
      and coalesce(v_role in ('OWNER', 'ADMIN'), false)
    union all
    select
      'guest'::text,
      null::uuid,
      g.id,
      'confirmed'::public.attendance_status,
      null::integer,
      g.display_name,
      g.did_attend,
      g.is_paid,
      false,
      case when g.is_paid then v_event.price else null end,
      null::integer,
      g.plays_as,
      g.stars,
      g.is_super_star,
      null::text,
      g.primary_position,
      g.secondary_position,
      null::public.member_role
    from public.event_guest g
    where g.event_id = p_event_id
    order by 1, 4, 5 nulls last, 6;
end $$;

revoke execute on function public.list_event_attendance(uuid) from public, anon;
grant execute on function public.list_event_attendance(uuid) to authenticated;

-- --- escrita: presença ---

create function public.confirm_attendance(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_uid uuid := (select auth.uid());
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_member';
  end if;

  perform private.try_confirm_member(p_event_id, v_uid);
end $$;

revoke execute on function public.confirm_attendance(uuid) from public, anon;
grant execute on function public.confirm_attendance(uuid) to authenticated;

create function public.cancel_attendance(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_uid uuid := (select auth.uid());
  v_row public.event_attendance%rowtype;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_member';
  end if;

  select * into v_row from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = v_uid
  for update;

  if not found or v_row.status not in ('confirmed', 'waitlisted') then
    raise exception 'not_allowed';
  end if;

  update public.event_attendance ea set
    status = 'cancelled',
    waitlisted_at = null
  where ea.event_id = p_event_id and ea.profile_id = v_uid;

  if v_row.status = 'confirmed' then
    perform private.promote_waitlist_for_event(p_event_id);
  end if;
end $$;

revoke execute on function public.cancel_attendance(uuid) from public, anon;
grant execute on function public.cancel_attendance(uuid) to authenticated;

create function public.set_attendance_for_member(
  p_event_id uuid,
  p_profile_id uuid,
  p_status public.attendance_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_was_confirmed boolean;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if not exists (
    select 1 from public.member m
    where m.racha_id = v_event.racha_id and m.profile_id = p_profile_id and m.is_active
  ) then
    raise exception 'not_member';
  end if;

  if p_status = 'confirmed' then
    perform private.try_confirm_member(p_event_id, p_profile_id);
  elsif p_status = 'cancelled' then
    select exists (
      select 1 from public.event_attendance ea
      where ea.event_id = p_event_id
        and ea.profile_id = p_profile_id
        and ea.status = 'confirmed'
    ) into v_was_confirmed;

    update public.event_attendance ea set
      status = 'cancelled',
      waitlisted_at = null
    where ea.event_id = p_event_id and ea.profile_id = p_profile_id
      and ea.status in ('confirmed', 'waitlisted');

    if v_was_confirmed then
      perform private.promote_waitlist_for_event(p_event_id);
    end if;
  else
    raise exception 'not_allowed';
  end if;
end $$;

revoke execute on function public.set_attendance_for_member(uuid, uuid, public.attendance_status)
  from public, anon;
grant execute on function public.set_attendance_for_member(uuid, uuid, public.attendance_status)
  to authenticated;

create function public.set_attendance_attended(
  p_event_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_did_attend boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_attendance public.event_attendance%rowtype;
begin
  if (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if p_guest_id is not null then
    update public.event_guest g set did_attend = p_did_attend where g.id = p_guest_id and g.event_id = p_event_id;
    if not found then
      raise exception 'not_allowed';
    end if;
    return;
  end if;

  select * into v_attendance from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id;

  if p_did_attend and (not found or v_attendance.status <> 'confirmed') then
    raise exception 'not_confirmed';
  end if;

  update public.event_attendance ea set did_attend = p_did_attend
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id;

  update public.event_payment_fact f set did_attend = p_did_attend
  where f.event_id = p_event_id and f.profile_id = p_profile_id;
end $$;

revoke execute on function public.set_attendance_attended(uuid, uuid, uuid, boolean)
  from public, anon;
grant execute on function public.set_attendance_attended(uuid, uuid, uuid, boolean)
  to authenticated;

create function public.set_attendance_paid(
  p_event_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_paid boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_attendance public.event_attendance%rowtype;
  v_fact public.event_payment_fact%rowtype;
  v_year_month text;
  v_apply integer;
  v_cash integer;
begin
  if (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if not v_event.is_paid or v_event.price is null then
    raise exception 'not_allowed';
  end if;

  v_year_month := private.event_civil_year_month(v_event.starts_on, v_event.starts_at);

  if p_guest_id is not null then
    update public.event_guest g set is_paid = p_paid
    where g.id = p_guest_id and g.event_id = p_event_id;
    if not found then
      raise exception 'not_allowed';
    end if;
    return;
  end if;

  select * into v_attendance from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id;
  if not found then
    raise exception 'not_confirmed';
  end if;

  if v_attendance.status = 'waitlisted' then
    raise exception 'waitlisted_unpaid';
  end if;

  if v_attendance.status <> 'confirmed' then
    raise exception 'not_confirmed';
  end if;

  select * into v_fact from public.event_payment_fact f
  where f.event_id = p_event_id and f.profile_id = p_profile_id;

  if private.member_has_event_monthly_pass(p_event_id, p_profile_id)
     or coalesce(v_fact.monthly_coverage_month = v_year_month, false) then
    if not p_paid then
      raise exception 'mensalista_paid';
    end if;
    return;
  end if;

  if not p_paid then
    -- Desmarcar pago: remove applies deste Evento×Membro para o saldo voltar
    -- e o rematch poder reaplicar com a mesma operation_key (restore fica no cancel_event).
    if coalesce(v_fact.credit_applied_amount, 0) > 0 then
      perform private.lock_credit_balance(v_event.racha_id, p_profile_id);
      delete from public.racha_credit_entry c
      where c.racha_id = v_event.racha_id
        and c.profile_id = p_profile_id
        and c.source_event_id = p_event_id
        and c.entry_kind = 'apply';
    end if;

    delete from public.event_payment_fact f
    where f.event_id = p_event_id and f.profile_id = p_profile_id
      and f.paid_marked_at is not null;

    return;
  end if;

  -- Evita reaplicar crédito se o fato já está marcado como pago.
  if v_fact.paid_marked_at is not null then
    return;
  end if;

  v_apply := private.apply_credit_fifo(
    v_event.racha_id,
    p_profile_id,
    p_event_id,
    format('mark_paid:%s:apply:%s', p_event_id, p_profile_id),
    v_event.price
  );
  v_cash := v_event.price - v_apply;

  insert into public.event_payment_fact (
    event_id, racha_id, profile_id, event_year_month, daily_amount_snapshot,
    cash_paid_amount, credit_applied_amount, did_attend, paid_marked_at
  ) values (
    p_event_id, v_event.racha_id, p_profile_id, v_year_month, v_event.price,
    v_cash, v_apply, v_attendance.did_attend, now()
  )
  on conflict (event_id, profile_id) do update set
    daily_amount_snapshot = excluded.daily_amount_snapshot,
    cash_paid_amount = excluded.cash_paid_amount,
    credit_applied_amount = excluded.credit_applied_amount,
    did_attend = excluded.did_attend,
    paid_marked_at = excluded.paid_marked_at;
end $$;

revoke execute on function public.set_attendance_paid(uuid, uuid, uuid, boolean)
  from public, anon;
grant execute on function public.set_attendance_paid(uuid, uuid, uuid, boolean)
  to authenticated;

create function public.add_guest(
  p_event_id uuid,
  p_display_name text,
  p_plays_as public.plays_as,
  p_primary_position public.position,
  p_secondary_position public.position,
  p_stars smallint,
  p_is_super_star boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_guest_id uuid;
  v_stars smallint;
  v_super boolean;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  perform private.promote_waitlist_for_event(p_event_id);

  if private.event_has_waitlist(p_event_id) then
    raise exception 'spot_limit';
  end if;

  if v_event.spot_limit is not null
     and private.event_occupancy(p_event_id) >= v_event.spot_limit then
    raise exception 'spot_limit';
  end if;

  if p_plays_as = 'GOALKEEPER' then
    v_stars := null;
    v_super := false;
  else
    v_stars := p_stars;
    v_super := coalesce(p_is_super_star, false);
  end if;

  insert into public.event_guest (
    event_id, display_name, plays_as, primary_position, secondary_position, stars, is_super_star
  ) values (
    p_event_id, btrim(p_display_name), p_plays_as, p_primary_position, p_secondary_position,
    v_stars, v_super
  ) returning id into v_guest_id;

  return v_guest_id;
end $$;

revoke execute on function public.add_guest(uuid, text, public.plays_as, public.position, public.position, smallint, boolean)
  from public, anon;
grant execute on function public.add_guest(uuid, text, public.plays_as, public.position, public.position, smallint, boolean)
  to authenticated;

create function public.remove_guest(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.event_guest%rowtype;
  v_event public.event;
begin
  select * into v_guest from public.event_guest g where g.id = p_guest_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(v_guest.event_id);
  perform private.assert_open_attendance_event(v_event);

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  delete from public.event_guest g where g.id = p_guest_id;
  perform private.promote_waitlist_for_event(v_guest.event_id);
end $$;

revoke execute on function public.remove_guest(uuid) from public, anon;
grant execute on function public.remove_guest(uuid) to authenticated;

create function public.set_monthly_pass(
  p_racha_id uuid,
  p_profile_id uuid,
  p_year_month text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha public.racha%rowtype;
  v_event record;
begin
  select * into v_racha from public.racha r where r.id = p_racha_id for update;
  if not found then
    raise exception 'not_allowed';
  end if;

  if not coalesce(public.my_racha_role(p_racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if v_racha.monthly_price is null then
    raise exception 'monthly_price_required';
  end if;

  if p_year_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'not_allowed';
  end if;

  if not exists (
    select 1 from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
  ) then
    raise exception 'not_member';
  end if;

  if p_enabled then
    insert into public.racha_monthly_pass (racha_id, profile_id, year_month)
    values (p_racha_id, p_profile_id, p_year_month)
    on conflict do nothing;
  else
    delete from public.racha_monthly_pass mp
    where mp.racha_id = p_racha_id
      and mp.profile_id = p_profile_id
      and mp.year_month = p_year_month;
  end if;

  for v_event in
    select e.id
    from public.event e
    where e.racha_id = p_racha_id
      and e.status in ('upcoming', 'active')
      and private.event_civil_year_month(e.starts_on, e.starts_at) = p_year_month
  loop
    perform private.sync_monthly_coverage_for_member(v_event.id, p_profile_id);
  end loop;
end $$;

revoke execute on function public.set_monthly_pass(uuid, uuid, text, boolean)
  from public, anon;
grant execute on function public.set_monthly_pass(uuid, uuid, text, boolean)
  to authenticated;

-- --- evento, saída e relógio ---

create or replace function public.update_event(
  p_event_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_place text,
  p_is_paid boolean,
  p_price integer,
  p_spot_limit smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.event%rowtype;
  v_role public.member_role;
  v_old_month text;
  v_new_month text;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.racha r where r.id = v_event.racha_id for update;

  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  v_role := public.my_racha_role(v_event.racha_id);

  if v_event.status = 'upcoming' then
    if not coalesce(v_role in ('OWNER', 'ADMIN'), false) then
      raise exception 'not_allowed';
    end if;
  elsif v_event.status = 'active' then
    if v_event.conductor_id is distinct from v_uid then
      raise exception 'not_allowed';
    end if;
  else
    raise exception 'not_allowed';
  end if;

  if (v_event.status = 'upcoming' and p_starts_on + p_starts_at <= (now() at time zone 'America/Sao_Paulo'))
    or (v_event.status = 'active' and p_starts_on < (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'past_date';
  end if;

  v_old_month := private.event_civil_year_month(v_event.starts_on, v_event.starts_at);
  v_new_month := private.event_civil_year_month(p_starts_on, p_starts_at);

  if v_old_month <> v_new_month and exists (
    select 1 from public.event_payment_fact f
    where f.event_id = p_event_id
      and (
        f.paid_marked_at is not null
        or f.cash_paid_amount > 0
        or f.credit_applied_amount > 0
        or f.monthly_coverage_month is not null
      )
  ) then
    raise exception 'event_month_locked';
  end if;

  if p_spot_limit is not null and p_spot_limit < private.event_occupancy(p_event_id) then
    raise exception 'spot_limit_below_occupancy';
  end if;

  update public.event e set
    starts_on = p_starts_on,
    starts_at = p_starts_at,
    place = btrim(p_place),
    is_paid = p_is_paid,
    price = p_price,
    spot_limit = p_spot_limit
  where e.id = p_event_id;

  perform private.promote_waitlist_for_event(p_event_id);
end $$;

create or replace function public.cancel_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.racha r where r.id = v_event.racha_id for update;
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false)
    or v_event.status is distinct from 'upcoming' then
    raise exception 'not_allowed';
  end if;

  perform private.process_event_cancellation_credits(p_event_id, v_event.racha_id);

  delete from public.event e where e.id = p_event_id;
  perform private.create_next_recurring_event(
    v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, now()
  );
end $$;

create or replace function private.process_overdue_events(p_as_of timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_event public.event%rowtype;
begin
  for v_candidate in
    select e.id, e.racha_id
    from public.event e
    where e.status in ('upcoming', 'active')
      and ((e.starts_on + e.starts_at) at time zone 'America/Sao_Paulo')
        + interval '12 hours' <= p_as_of
    order by e.racha_id, e.starts_on, e.starts_at, e.id
    limit 500
  loop
    perform 1 from public.racha r where r.id = v_candidate.racha_id for update skip locked;
    if not found then
      continue;
    end if;

    select * into v_event from public.event e where e.id = v_candidate.id;
    if not found or v_event.status not in ('upcoming', 'active')
      or ((v_event.starts_on + v_event.starts_at) at time zone 'America/Sao_Paulo')
        + interval '12 hours' > p_as_of then
      continue;
    end if;

    if v_event.status = 'upcoming' then
      perform private.process_event_cancellation_credits(v_event.id, v_event.racha_id);
      delete from public.event e where e.id = v_event.id;
    else
      update public.event e set
        status = 'finished',
        ended_at = p_as_of,
        ended_by = null,
        ended_by_system = true
      where e.id = v_event.id;
    end if;

    perform private.create_next_recurring_event(
      v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, p_as_of
    );
  end loop;
end $$;

create or replace function public.leave_racha(p_racha_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role;
begin
  perform 1 from public.racha r where r.id = p_racha_id for update;

  v_my_role := public.my_racha_role(p_racha_id);
  if v_my_role is null then
    raise exception 'not_member';
  end if;
  if v_my_role = 'OWNER' then
    raise exception 'owner_cannot_leave';
  end if;
  if exists (
    select 1 from public.event e
    where e.racha_id = p_racha_id
      and e.status = 'active'
      and e.conductor_id = (select auth.uid())
  ) then
    raise exception 'conductor';
  end if;

  perform private.cleanup_member_attendance(p_racha_id, (select auth.uid()));

  update public.member m set is_active = false
    where m.racha_id = p_racha_id and m.profile_id = (select auth.uid());

  delete from public.join_request jr
    where jr.racha_id = p_racha_id and jr.profile_id = (select auth.uid());
end $$;

create or replace function public.expel_member(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role;
  v_target public.member%rowtype;
begin
  perform 1 from public.racha r where r.id = p_racha_id for update;
  v_my_role := public.my_racha_role(p_racha_id);
  if v_my_role is null or v_my_role = 'PLAYER' or p_profile_id = (select auth.uid()) then
    raise exception 'not_allowed';
  end if;

  select * into v_target from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
    for update;
  if not found then
    raise exception 'not_member';
  end if;

  if v_target.role = 'OWNER' or (v_my_role = 'ADMIN' and v_target.role <> 'PLAYER') then
    raise exception 'not_allowed';
  end if;

  perform private.cleanup_member_attendance(p_racha_id, p_profile_id);

  update public.member m set is_active = false where m.id = v_target.id;

  delete from public.join_request jr
    where jr.racha_id = p_racha_id and jr.profile_id = p_profile_id;

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select p_profile_id, r.id, r.name, 'REMOVED'
    from public.racha r where r.id = p_racha_id;
end $$;
