-- Avisos: cópia do acontecimento na mesma transação, sem push.
-- Quem causou e quem não tem Perfil ficam de fora em private.notify.
-- racha_id, event_id e join_request_id não têm FK: o Aviso sobrevive
-- ao Racha excluído, ao Evento cancelado (a RPC apaga a linha) e à recusa
-- (que apaga a Solicitação).

alter table public.profile
  add column notifications_seen_at timestamptz;

comment on column public.profile.notifications_seen_at is
  'Nulo enquanto a pessoa nunca abriu a aba de Avisos.';

create table public.notification (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profile (id),
  kind text not null,
  racha_id uuid not null,
  racha_name text not null,
  event_id uuid,
  join_request_id uuid,
  actor_name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint notification_kind_check check (kind in (
    'join_request', 'join_approved', 'join_refused',
    'event_created', 'event_changed', 'event_cancelled',
    'sort_confirmed', 'team_changed', 'role_changed',
    'expelled', 'ownership_transferred', 'conduction_taken',
    'waitlist_promoted', 'credit_created'
  ))
);

create index notification_recipient_created_at
  on public.notification (recipient_id, created_at desc);

alter table public.notification enable row level security;
revoke all on public.notification from public, anon, authenticated;

-- Uma linha por destinatário distinto. Tira quem causou (quando há sessão
-- e p_exclude_actor) e quem não é Perfil (Avulso). O nome do Racha e o de
-- quem causou são cópia. O default true preserva as chamadas já existentes.
drop function if exists private.notify(uuid[], text, uuid, uuid, uuid, jsonb);

create function private.notify(
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
  v_actor_name text;
begin
  select r.name into v_racha_name from public.racha r where r.id = p_racha_id;
  if v_uid is not null then
    select p.display_name into v_actor_name from public.profile p where p.id = v_uid;
  end if;

  insert into public.notification (
    recipient_id, kind, racha_id, racha_name, event_id, join_request_id,
    actor_name, payload
  )
  select distinct r.recipient, p_kind, p_racha_id, v_racha_name, p_event_id,
    p_join_request_id, v_actor_name, coalesce(p_payload, '{}'::jsonb)
  from unnest(p_recipients) as r(recipient)
  where r.recipient is not null
    and (
      not p_exclude_actor
      or v_uid is null
      or r.recipient is distinct from v_uid
    )
    and exists (select 1 from public.profile p where p.id = r.recipient);
end $$;

revoke execute on function private.notify(uuid[], text, uuid, uuid, uuid, jsonb, boolean)
  from public, anon, authenticated;

-- Foto perfil → número do Time (linha ativa + gol com team_id). Sem número a
-- pessoa não entra: team_changed precisa do Time novo na frase.
drop function if exists private.profile_sort_team_number(uuid, uuid);

create or replace function private.sort_team_snapshot(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.profile_id::text, s.team_number), '{}'::jsonb)
  from (
    select distinct on (assigned.profile_id)
      assigned.profile_id, assigned.team_number
    from (
      select tp.profile_id, t.team_number
      from public.event_sort_team_player tp
      join public.event_sort_team t on t.id = tp.team_id
      where tp.event_id = p_event_id
        and tp.profile_id is not null
        and tp.left_at is null
      union all
      select k.profile_id, t.team_number
      from public.event_sort_goalkeeper k
      join public.event_sort_team t on t.id = k.team_id
      where k.event_id = p_event_id
        and k.profile_id is not null
        and k.team_id is not null
    ) assigned
    order by assigned.profile_id
  ) s
$$;

-- Um lugar só: quem ficou com número diferente da foto recebe team_changed.
-- Quem terminou sem Time (team_id nulo) não está na foto nova e não é avisado.
create or replace function private.notify_sort_team_changes(p_event_id uuid, p_before jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha_id uuid;
  v_profile uuid;
  v_team integer;
begin
  select e.racha_id into v_racha_id
  from public.event e
  where e.id = p_event_id;

  for v_profile, v_team in
    select key::uuid, value::integer
    from jsonb_each_text(private.sort_team_snapshot(p_event_id))
  loop
    if v_team is not null
       and v_team is distinct from nullif(p_before ->> v_profile::text, '')::integer then
      perform private.notify(
        array[v_profile],
        'team_changed',
        v_racha_id,
        p_event_id,
        null,
        jsonb_build_object('team', v_team)
      );
    end if;
  end loop;
end $$;

revoke execute on function
  private.sort_team_snapshot(uuid),
  private.notify_sort_team_changes(uuid, jsonb)
  from public, anon, authenticated;

-- O app insere a Solicitação direto. O aviso sai no mesmo insert, para Dono e Admins.
create function private.notify_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(
    (select coalesce(array_agg(m.profile_id), '{}'::uuid[])
     from public.member m
     where m.racha_id = new.racha_id
       and m.is_active
       and m.role in ('OWNER', 'ADMIN')),
    'join_request',
    new.racha_id,
    null,
    new.id,
    '{}'::jsonb
  );
  return new;
end $$;

revoke execute on function private.notify_join_request()
  from public, anon, authenticated;

create trigger notification_join_request
  after insert on public.join_request
  for each row execute function private.notify_join_request();


-- Veio de 20261003210000_position_detail.sql. Só entra a chamada a private.notify.
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
  select * into v_request from public.join_request jr where jr.id = p_request_id;
  if not found then
    raise exception 'already_resolved';
  end if;

  -- Racha primeiro, pedido depois: a ordem de expel_member, que apaga o pedido sob a mesma trava
  perform 1 from public.racha r where r.id = v_request.racha_id for update;

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
    stars, is_super_star, primary_position_detail, secondary_position_detail
  ) values (
    v_request.racha_id, v_request.profile_id, 'PLAYER', v_profile.plays_as,
    v_profile.primary_position, v_profile.secondary_position, v_stars, v_super_star,
    case when private.position_detail_fits(v_profile.primary_position, v_request.primary_position_detail)
      then v_request.primary_position_detail end,
    case when private.position_detail_fits(v_profile.secondary_position, v_request.secondary_position_detail)
      then v_request.secondary_position_detail end
  )
  on conflict (racha_id, profile_id) do update set
    is_active = true,
    role = 'PLAYER',
    plays_as = excluded.plays_as,
    primary_position = excluded.primary_position,
    secondary_position = excluded.secondary_position,
    stars = excluded.stars,
    is_super_star = excluded.is_super_star,
    primary_position_detail = excluded.primary_position_detail,
    secondary_position_detail = excluded.secondary_position_detail,
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

  perform private.notify(
    array[v_request.profile_id],
    'join_approved',
    v_request.racha_id,
    null,
    p_request_id,
    '{}'::jsonb
  );
end $$;

-- Veio de 20260930024629_approve_join_request.sql. Só entra a chamada a private.notify e o snapshot da recusa.
create or replace function public.refuse_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha_id uuid;
  v_profile_id uuid;
  v_by_id uuid := (select auth.uid());
  v_by_name text;
begin
  select jr.racha_id, jr.profile_id into v_racha_id, v_profile_id
    from public.join_request jr where jr.id = p_request_id;
  if v_racha_id is null then
    raise exception 'already_resolved';
  end if;
  if not coalesce(public.my_racha_role(v_racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  -- A recusa apaga a Solicitação; sem este retrato a leitura não saberia quem recusou.
  select p.display_name into v_by_name from public.profile p where p.id = v_by_id;
  update public.notification n
    set payload = n.payload || jsonb_build_object(
      'resolution', jsonb_build_object(
        'status', 'refused',
        'by_id', v_by_id,
        'by_name', v_by_name
      )
    )
    where n.kind = 'join_request' and n.join_request_id = p_request_id;

  perform private.notify(
    array[v_profile_id],
    'join_refused',
    v_racha_id,
    null,
    p_request_id,
    '{}'::jsonb
  );

  delete from public.join_request jr where jr.id = p_request_id and jr.status = 'PENDING';
  if not found then
    raise exception 'already_resolved';
  end if;
end $$;

-- Veio de 20261006110000_yellow_card_mode.sql. Só entra a chamada a private.notify.
create or replace function public.create_event(
  p_racha_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_place text,
  p_is_paid boolean,
  p_price integer,
  p_spot_limit smallint,
  p_payer_target integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha public.racha%rowtype;
  v_event_id uuid;
  v_target integer;
begin
  select * into v_racha from public.racha r where r.id = p_racha_id for update;
  if not found then
    raise exception 'not_allowed';
  end if;

  if not coalesce(public.my_racha_role(p_racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if exists (
    select 1 from public.event e
    where e.racha_id = p_racha_id and e.status = 'upcoming'
  ) then
    raise exception 'event_exists';
  end if;

  if p_starts_on + p_starts_at <= (now() at time zone 'America/Sao_Paulo') then
    raise exception 'past_date';
  end if;

  v_target := coalesce(p_payer_target, v_racha.payer_target);
  perform private.assert_payer_target(p_is_paid, v_target);

  insert into public.event (
    racha_id, starts_on, starts_at, place, is_paid, price, spot_limit, payer_target,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min,
    yellow_card_mode, yellow_out_min
  ) values (
    p_racha_id, p_starts_on, p_starts_at, btrim(p_place), p_is_paid,
    case when p_is_paid then p_price else null end, p_spot_limit,
    case when p_is_paid then v_target else null end,
    v_racha.reminder_lead_hours, v_racha.outfield_per_team, v_racha.game_mode,
    v_racha.max_consecutive_wins, v_racha.tie_rule, v_racha.tie_return_order,
    v_racha.consider_position, v_racha.match_duration_min,
    v_racha.yellow_card_mode, v_racha.yellow_out_min
  ) returning id into v_event_id;

  perform private.notify(
    (select coalesce(array_agg(m.profile_id), '{}'::uuid[])
     from public.member m
     where m.racha_id = p_racha_id and m.is_active),
    'event_created',
    p_racha_id,
    v_event_id,
    null,
    jsonb_build_object(
      'event_date', to_char(p_starts_on, 'YYYY-MM-DD'),
      'event_time', to_char(p_starts_at, 'HH24:MI'),
      'place', btrim(p_place)
    )
  );

  return v_event_id;
end $$;

-- Veio de 20261006110000_yellow_card_mode.sql. Só entra a chamada a private.notify.
create or replace function private.create_next_recurring_event(
  p_racha_id uuid,
  p_source_event_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_as_of timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_racha public.racha%rowtype;
  v_after timestamptz;
  v_next_date date;
  v_next_id uuid;
begin
  select * into v_racha from public.racha r where r.id = p_racha_id for update;
  if not found or v_racha.weekday is null then
    return null;
  end if;

  if exists (
    select 1 from public.event e
    where e.racha_id = p_racha_id and e.status = 'upcoming'
  ) then
    return null;
  end if;

  if v_racha.place = 'A definir' then
    insert into private.event_recurring_issue (racha_id, source_event_id, reason)
    values (p_racha_id, p_source_event_id, 'missing_place')
    on conflict do nothing;
    return null;
  end if;

  v_after := greatest(
    (p_starts_on + p_starts_at) at time zone 'America/Sao_Paulo',
    p_as_of
  );
  v_next_date := (v_after at time zone 'America/Sao_Paulo')::date;
  v_next_date := v_next_date
    + ((v_racha.weekday - extract(isodow from v_next_date)::integer + 7) % 7);

  if (v_next_date + v_racha.kickoff_time) at time zone 'America/Sao_Paulo' <= v_after then
    v_next_date := v_next_date + 7;
  end if;

  insert into public.event (
    racha_id, starts_on, starts_at, place, is_paid, price, spot_limit, payer_target,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min,
    yellow_card_mode, yellow_out_min
  ) values (
    p_racha_id, v_next_date, v_racha.kickoff_time, v_racha.place,
    v_racha.is_paid, v_racha.price, v_racha.spot_limit,
    case when v_racha.is_paid then v_racha.payer_target else null end,
    v_racha.reminder_lead_hours, v_racha.outfield_per_team, v_racha.game_mode,
    v_racha.max_consecutive_wins, v_racha.tie_rule, v_racha.tie_return_order,
    v_racha.consider_position, v_racha.match_duration_min,
    v_racha.yellow_card_mode, v_racha.yellow_out_min
  ) returning id into v_next_id;

  perform private.notify(
    (select coalesce(array_agg(m.profile_id), '{}'::uuid[])
     from public.member m
     where m.racha_id = p_racha_id and m.is_active),
    'event_created',
    p_racha_id,
    v_next_id,
    null,
    jsonb_build_object(
      'event_date', to_char(v_next_date, 'YYYY-MM-DD'),
      'event_time', to_char(v_racha.kickoff_time, 'HH24:MI'),
      'place', v_racha.place
    ),
    false
  );

  return v_next_id;
end $$;

-- Veio de 20261003110000_paid_to_free.sql. Só entra a chamada a private.notify.
create or replace function public.update_event(
  p_event_id uuid,
  p_starts_on date,
  p_starts_at time,
  p_place text,
  p_is_paid boolean,
  p_price integer,
  p_spot_limit smallint,
  p_payer_target integer
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
  v_profile_id uuid;
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

  perform private.assert_payer_target(p_is_paid, p_payer_target);

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

  if v_event.is_paid and not p_is_paid then
    perform private.clear_event_payment_for_free(p_event_id, v_event.racha_id);
  end if;

  update public.event e set
    starts_on = p_starts_on,
    starts_at = p_starts_at,
    place = btrim(p_place),
    is_paid = p_is_paid,
    price = case when p_is_paid then p_price else null end,
    spot_limit = p_spot_limit,
    payer_target = case when p_is_paid then p_payer_target else null end
  where e.id = p_event_id;

  -- Ao religar Pago, quem já confirmou e tem passe do mês recebe cobertura do dia.
  if not v_event.is_paid and p_is_paid then
    for v_profile_id in
      select ea.profile_id from public.event_attendance ea
      where ea.event_id = p_event_id and ea.status = 'confirmed'
    loop
      perform private.sync_monthly_coverage_for_member(p_event_id, v_profile_id);
    end loop;
  end if;

  perform private.promote_waitlist_for_event(p_event_id);

  -- v_event ainda é o retrato de antes do update. event_date é a data que a
  -- pessoa já conhecia; change leva só o valor novo do que mudou.
  if v_event.starts_on is distinct from p_starts_on
     or v_event.starts_at is distinct from p_starts_at
     or v_event.place is distinct from btrim(p_place) then
    perform private.notify(
      (select coalesce(array_agg(m.profile_id), '{}'::uuid[])
       from public.member m
       where m.racha_id = v_event.racha_id and m.is_active),
      'event_changed',
      v_event.racha_id,
      p_event_id,
      null,
      jsonb_build_object(
        'event_date', to_char(v_event.starts_on, 'YYYY-MM-DD'),
        'event_time', to_char(p_starts_at, 'HH24:MI'),
        'place', btrim(p_place),
        'change', jsonb_strip_nulls(jsonb_build_object(
          'date', case
            when v_event.starts_on is distinct from p_starts_on
              then to_char(p_starts_on, 'YYYY-MM-DD')
          end,
          'time', case
            when v_event.starts_at is distinct from p_starts_at
              then to_char(p_starts_at, 'HH24:MI')
          end,
          'place', case
            when v_event.place is distinct from btrim(p_place) then btrim(p_place)
          end
        ))
      )
    );
  end if;
end $$;

-- Veio de 20261002171527_event_attendance.sql. Só entra a chamada a private.notify.
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

  perform private.notify(
    (select coalesce(array_agg(ea.profile_id), '{}'::uuid[])
     from public.event_attendance ea
     where ea.event_id = p_event_id and ea.status = 'confirmed'),
    'event_cancelled',
    v_event.racha_id,
    v_event.id,
    null,
    jsonb_build_object('event_date', to_char(v_event.starts_on, 'YYYY-MM-DD'))
  );

  delete from public.event e where e.id = p_event_id;
  perform private.create_next_recurring_event(
    v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, now()
  );
end $$;

-- Veio de 20261003240000_event_match_integration.sql. Só entra a chamada a private.notify.
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
      perform private.notify(
        (select coalesce(array_agg(ea.profile_id), '{}'::uuid[])
         from public.event_attendance ea
         where ea.event_id = v_event.id and ea.status = 'confirmed'),
        'event_cancelled',
        v_event.racha_id,
        v_event.id,
        null,
        jsonb_build_object('event_date', to_char(v_event.starts_on, 'YYYY-MM-DD'))
      );
      delete from public.event e where e.id = v_event.id;
    else
      perform private.event_match_discard_open(v_event.id);
      update public.event e set
        status = 'finished',
        ended_at = p_as_of,
        ended_by = null,
        ended_by_system = true
      where e.id = v_event.id;
      perform private.settle_event_credits(v_event.id);
    end if;

    perform private.create_next_recurring_event(
      v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, p_as_of
    );
  end loop;
end $$;

-- Veio de 20261003210000_position_detail.sql. Só entra a chamada a private.notify.
create or replace function public.confirm_event_sort(p_event_id uuid, p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_sort public.event_sort%rowtype;
  v_roster jsonb;
  v_team record;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);

  select * into v_sort from public.event_sort s where s.event_id = p_event_id;
  if found and v_sort.status = 'confirmed' then
    raise exception 'already_confirmed';
  end if;
  if v_event.status <> 'upcoming' then
    raise exception 'event_not_upcoming';
  end if;
  if not found
     or (select count(*) from public.event_sort_team t where t.event_id = p_event_id) < 2 then
    raise exception 'no_proposal';
  end if;
  v_roster := private.event_sort_roster(p_event_id);
  perform private.assert_no_position_detail_pending(p_event_id, v_roster);
  if v_sort.signature <> private.event_sort_signature(p_event_id, v_roster) then
    raise exception 'roster_changed';
  end if;
  if v_sort.version is distinct from p_version then
    raise exception 'proposal_outdated';
  end if;

  update public.event_sort s set
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = (select auth.uid())
  where s.event_id = p_event_id;

  update public.event e set status = 'active' where e.id = p_event_id;

  for v_team in
    select assigned.team_number, array_agg(assigned.profile_id) as recipients
    from (
      select t.team_number, tp.profile_id
      from public.event_sort_team_player tp
      join public.event_sort_team t on t.id = tp.team_id
      where tp.event_id = p_event_id and tp.left_at is null and tp.profile_id is not null
      union all
      select t.team_number, k.profile_id
      from public.event_sort_goalkeeper k
      join public.event_sort_team t on t.id = k.team_id
      where k.event_id = p_event_id and k.profile_id is not null
    ) assigned
    group by assigned.team_number
  loop
    perform private.notify(
      v_team.recipients,
      'sort_confirmed',
      v_event.racha_id,
      p_event_id,
      null,
      jsonb_build_object('team', v_team.team_number)
    );
  end loop;

  return private.event_sort_published_json(p_event_id);
end $$;

-- Veio de 20261005100000_event_match_reinforcement.sql. Só entra a chamada a private.notify.
create or replace function public.include_event_sort_member(p_event_id uuid, p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_member public.member%rowtype;
  v_att public.event_attendance%rowtype;
  v_holds_spot boolean := false;
  v_teams_before jsonb;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

  select * into v_member from public.member m
  where m.racha_id = v_event.racha_id and m.profile_id = p_profile_id and m.is_active;
  if not found then
    raise exception 'not_member';
  end if;

  select * into v_att from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id
  for update;
  if found and v_att.status = 'left' then
    raise exception 'use_return';
  end if;
  if found and v_att.status = 'confirmed' then
    if exists (
      select 1 from public.event_sort_team_player tp
      where tp.event_id = p_event_id and tp.person_id = p_profile_id
    ) or exists (
      select 1 from public.event_sort_goalkeeper k
      where k.event_id = p_event_id and k.person_id = p_profile_id
    ) then
      raise exception 'already_participating';
    end if;
    v_holds_spot := true;
  end if;

  perform private.assert_no_position_detail_pending(p_event_id, jsonb_build_array(jsonb_build_object(
    'kind', 'member', 'id', v_member.profile_id, 'plays_as', v_member.plays_as,
    'main', v_member.primary_position, 'main_detail', v_member.primary_position_detail
  )));

  if not v_holds_spot then
    if v_event.spot_limit is not null
       and private.event_occupancy(p_event_id) >= v_event.spot_limit then
      raise exception 'spot_limit';
    end if;

    insert into public.event_attendance (event_id, profile_id, status)
    values (p_event_id, p_profile_id, 'confirmed')
    on conflict (event_id, profile_id) do update set status = 'confirmed', waitlisted_at = null;
    perform private.sync_monthly_coverage_for_member(p_event_id, p_profile_id);
    perform private.mark_paid_fact_had_slot(p_event_id, p_profile_id);
  end if;

  perform private.set_member_attended(p_event_id, p_profile_id, true);

  -- Antes de colocar: o rebalanceio do gol pode mudar o Time de outra pessoa.
  v_teams_before := private.sort_team_snapshot(p_event_id);
  perform private.event_sort_place_player(
    p_event_id, p_profile_id, null, v_member.plays_as, v_member.stars,
    v_member.is_super_star, v_member.primary_position, v_member.secondary_position,
    'inclusion'
  );
  perform private.notify_sort_team_changes(p_event_id, v_teams_before);

  return private.event_sort_published_json(p_event_id);
end $$;

-- Veio de 20261005100000_event_match_reinforcement.sql. Só entra a chamada a private.notify.
create or replace function public.return_event_sort_player(
  p_event_id uuid,
  p_profile_id uuid default null,
  p_guest_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_member public.member%rowtype;
  v_att public.event_attendance%rowtype;
  v_guest public.event_guest%rowtype;
  v_teams_before jsonb;
begin
  if (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

  if p_profile_id is not null then
    select * into v_att from public.event_attendance ea
    where ea.event_id = p_event_id and ea.profile_id = p_profile_id
    for update;
    if not found or v_att.status <> 'left' then
      raise exception 'not_left';
    end if;
    select * into v_member from public.member m
    where m.racha_id = v_event.racha_id and m.profile_id = p_profile_id and m.is_active;
    if not found then
      raise exception 'not_member';
    end if;
    if v_member.plays_as = 'OUTFIELD' and not exists (
      select 1 from public.event_sort_team_player p
      where p.event_id = p_event_id and p.person_id = p_profile_id
    ) then
      raise exception 'not_left';
    end if;
  else
    select * into v_guest from public.event_guest g
    where g.id = p_guest_id and g.event_id = p_event_id
    for update;
    if not found or v_guest.left_at is null then
      raise exception 'not_left';
    end if;
  end if;

  if v_event.spot_limit is not null
     and private.event_occupancy(p_event_id) >= v_event.spot_limit then
    raise exception 'spot_limit';
  end if;

  -- A volta de Avulso também rebalanceia o gol; a foto pega os dois caminhos.
  v_teams_before := private.sort_team_snapshot(p_event_id);
  if p_profile_id is not null then
    update public.event_attendance ea set status = 'confirmed', waitlisted_at = null
    where ea.event_id = p_event_id and ea.profile_id = p_profile_id;
    perform private.sync_monthly_coverage_for_member(p_event_id, p_profile_id);
    perform private.mark_paid_fact_had_slot(p_event_id, p_profile_id);
    perform private.event_sort_place_player(
      p_event_id, p_profile_id, null, v_member.plays_as, v_member.stars,
      v_member.is_super_star, v_member.primary_position, v_member.secondary_position,
      'return'
    );
  else
    update public.event_guest g set left_at = null where g.id = p_guest_id;
    perform private.event_sort_place_player(
      p_event_id, null, p_guest_id, v_guest.plays_as, v_guest.stars,
      v_guest.is_super_star, v_guest.primary_position, v_guest.secondary_position,
      'return'
    );
  end if;
  perform private.notify_sort_team_changes(p_event_id, v_teams_before);

  return private.event_sort_published_json(p_event_id);
end $$;

-- Veio de 20261005100000_event_match_reinforcement.sql. Só entra a chamada a private.notify.
create or replace function public.reinforce_event_match(
  p_match_id uuid,
  p_profile_id uuid default null,
  p_guest_id uuid default null,
  p_donor_team_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_person uuid;
  v_active boolean;
  v_left boolean;
  v_donor uuid;
  v_src public.event_sort_team_player;
  v_to_team uuid;
  v_teams_before jsonb;
begin
  v_match := private.lock_event_match(p_match_id);
  if v_match.status <> 'open' then
    raise exception 'no_open_match';
  end if;
  if (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;
  v_person := coalesce(p_profile_id, p_guest_id);

  if exists (
    select 1 from public.event_match_reinforcement r
    where r.match_id = p_match_id
      and (
        (p_profile_id is not null and r.left_profile_id = p_profile_id)
        or (p_guest_id is not null and r.left_guest_id = p_guest_id)
      )
  ) then
    raise exception 'already_reinforced';
  end if;

  select exists (
    select 1 from public.event_match_lineup l
    where l.match_id = p_match_id and l.person_id = v_person
      and l.left_at is null and l.role = 'OUTFIELD'
      and l.team_id in (v_match.home_team_id, v_match.away_team_id)
  ) into v_active;

  select exists (
    select 1 from public.event_match_lineup l
    where l.match_id = p_match_id and l.person_id = v_person
      and l.left_at is not null and l.role = 'OUTFIELD'
      and l.team_id in (v_match.home_team_id, v_match.away_team_id)
  ) into v_left;

  -- Foto antes de fechar quem saiu: esse fechamento já rebalanceia o gol.
  v_teams_before := private.sort_team_snapshot(v_match.event_id);

  if v_active then
    if p_profile_id is not null then
      update public.event_attendance ea
      set status = 'left', waitlisted_at = null
      where ea.event_id = v_match.event_id and ea.profile_id = p_profile_id
        and ea.status = 'confirmed';
      perform private.event_sort_close_player(v_match.event_id, p_profile_id, null, false);
    else
      update public.event_guest g set left_at = now()
      where g.id = p_guest_id and g.left_at is null;
      perform private.event_sort_close_player(v_match.event_id, null, p_guest_id, false);
    end if;
  elsif v_left then
    null;
  else
    raise exception 'not_on_field';
  end if;

  select l.team_id into v_to_team
  from public.event_match_lineup l
  where l.match_id = p_match_id and l.person_id = v_person
    and l.role = 'OUTFIELD' and l.left_at is not null
    and l.team_id in (v_match.home_team_id, v_match.away_team_id)
  order by l.left_at desc, l.id desc
  limit 1;

  if p_donor_team_id is not null then
    if not exists (
      select 1 from public.event_sort_team t
      where t.id = p_donor_team_id and t.event_id = v_match.event_id
        and t.queue_order >= 3
        and exists (
          select 1 from public.event_sort_team_player p
          where p.team_id = t.id and p.left_at is null
        )
    ) then
      raise exception 'invalid_donor';
    end if;
    v_donor := p_donor_team_id;
  else
    select t.id into v_donor
    from public.event_sort_team t
    where t.event_id = v_match.event_id and t.queue_order >= 3
      and exists (
        select 1 from public.event_sort_team_player p
        where p.team_id = t.id and p.left_at is null
      )
    order by random()
    limit 1;
    if v_donor is null then
      raise exception 'no_donor';
    end if;
  end if;

  select p.* into v_src
  from public.event_sort_team_player p
  where p.team_id = v_donor and p.left_at is null
  order by random()
  limit 1;

  -- fecha origem antes de inserir: unique de pessoa ativa no Evento
  update public.event_sort_team_player p set left_at = now() where p.id = v_src.id;

  insert into public.event_sort_team_player (
    event_id, team_id, profile_id, guest_id, stars_snapshot,
    is_super_star_snapshot, primary_position_snapshot, secondary_position_snapshot,
    primary_position_detail_snapshot, secondary_position_detail_snapshot
  ) values (
    v_match.event_id, v_to_team, v_src.profile_id, v_src.guest_id, v_src.stars_snapshot,
    v_src.is_super_star_snapshot, v_src.primary_position_snapshot,
    v_src.secondary_position_snapshot, v_src.primary_position_detail_snapshot,
    v_src.secondary_position_detail_snapshot
  );

  insert into public.event_match_lineup (
    event_id, match_id, team_id, profile_id, guest_id, role, entry_kind
  ) values (
    v_match.event_id, p_match_id, v_to_team, v_src.profile_id, v_src.guest_id,
    'OUTFIELD', 'reinforcement'
  );

  insert into public.event_match_reinforcement (
    event_id, match_id, left_profile_id, left_guest_id,
    entered_profile_id, entered_guest_id, from_team_id, to_team_id, team_drawn
  ) values (
    v_match.event_id, p_match_id, p_profile_id, p_guest_id,
    v_src.profile_id, v_src.guest_id, v_donor, v_to_team, p_donor_team_id is null
  );

  if not exists (
    select 1 from public.event_sort_team_player p
    where p.team_id = v_donor and p.left_at is null
  ) then
    update public.event_sort_team t set queue_order = null where t.id = v_donor;
    perform private.event_sort_compact_queue(v_match.event_id);
  end if;

  perform private.event_sort_rebalance_goalkeepers(v_match.event_id);
  perform private.notify_sort_team_changes(v_match.event_id, v_teams_before);

  perform private.event_match_touch(p_match_id);
  return private.event_match_json(v_match.event_id);
end $$;

-- Veio de 20261005130000_bolinhas_reveal_order.sql. Só entra a chamada a private.notify.
create or replace function public.draw_event_bolinhas(
  p_event_id uuid,
  p_giver_team_id uuid,
  p_receiver_team_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_active integer;
  v_slots integer;
  v_blue integer;
  v_all_move boolean;
  v_id uuid;
  v_order jsonb;
  v_teams_before jsonb;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

  if not coalesce(private.event_bolinhas_can_pair(p_event_id, p_giver_team_id, p_receiver_team_id), false) then
    raise exception 'invalid_pair';
  end if;

  select count(*) into v_active from public.event_sort_team_player p
  where p.team_id = p_giver_team_id and p.left_at is null;
  select v_event.outfield_per_team - count(*) into v_slots from public.event_sort_team_player p
  where p.team_id = p_receiver_team_id and p.left_at is null;
  v_blue := least(v_slots, v_active);
  v_all_move := v_active <= v_slots;

  insert into public.event_bolinhas (event_id, giver_team_id, receiver_team_id, all_move, created_by)
  values (p_event_id, p_giver_team_id, p_receiver_team_id, v_all_move, (select auth.uid()))
  returning id into v_id;

  -- dois sorteios independentes: um escolhe quem é azul, outro a ordem de saída do saco;
  -- com um só, as azuis saíam sempre primeiro e a revelação perdia o suspense
  with colored as (
    select p.profile_id, p.guest_id,
      row_number() over (order by random()) <= v_blue as is_blue
    from public.event_sort_team_player p
    where p.team_id = p_giver_team_id and p.left_at is null
  )
  insert into public.event_bolinhas_ball (bolinhas_id, draw_order, profile_id, guest_id, color)
  select v_id, (row_number() over (order by random()))::smallint, c.profile_id, c.guest_id,
    (case when c.is_blue then 'blue' else 'red' end)::public.event_bolinhas_color
  from colored c;

  -- Foto antes das azuis: o rebalanceio do gol pode mudar outro Perfil no mesmo sorteio.
  v_teams_before := private.sort_team_snapshot(p_event_id);

  -- fecha a origem antes de inserir (unique de pessoa ativa no Evento) e copia os snapshots
  with closed as (
    update public.event_sort_team_player p set left_at = now()
    from public.event_bolinhas_ball b
    where b.bolinhas_id = v_id and b.color = 'blue'
      and p.team_id = p_giver_team_id and p.left_at is null
      and p.person_id = coalesce(b.profile_id, b.guest_id)
    returning p.*
  )
  insert into public.event_sort_team_player (
    event_id, team_id, profile_id, guest_id, stars_snapshot,
    is_super_star_snapshot, primary_position_snapshot, secondary_position_snapshot,
    primary_position_detail_snapshot, secondary_position_detail_snapshot
  )
  select c.event_id, p_receiver_team_id, c.profile_id, c.guest_id, c.stars_snapshot,
    c.is_super_star_snapshot, c.primary_position_snapshot, c.secondary_position_snapshot,
    c.primary_position_detail_snapshot, c.secondary_position_detail_snapshot
  from closed c;

  if not exists (
    select 1 from public.event_sort_team_player p
    where p.team_id = p_giver_team_id and p.left_at is null
  ) then
    update public.event_sort_team t set queue_order = null where t.id = p_giver_team_id;
    perform private.event_sort_compact_queue(p_event_id);
  end if;

  perform private.event_sort_rebalance_goalkeepers(p_event_id);
  perform private.notify_sort_team_changes(p_event_id, v_teams_before);

  select coalesce(jsonb_agg(
    private.event_match_person_json(b.profile_id, b.guest_id)
      || jsonb_build_object('color', b.color) order by b.draw_order
  ), '[]'::jsonb) into v_order
  from public.event_bolinhas_ball b where b.bolinhas_id = v_id;

  perform private.event_match_notify(p_event_id);
  return jsonb_build_object(
    'bolinhas_id', v_id,
    'all_move', v_all_move,
    'order', v_order,
    'published', private.event_sort_published_json(p_event_id)
  );
end $$;

-- Veio de 20260930223227_ownership_and_flow_fixes.sql. Só entra a chamada a private.notify.
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

-- Veio de 20261002171527_event_attendance.sql. Só entra a chamada a private.notify.
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

  perform private.notify(
    array[p_profile_id],
    'expelled',
    p_racha_id,
    null,
    null,
    '{}'::jsonb
  );
end $$;

-- Veio de 20261002000000_separate_event_conduction.sql. Só entra a chamada a private.notify.
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

-- Veio de 20261006120000_event_conduction_takeover.sql. Só entra a chamada a private.notify.
create or replace function public.assume_event_conduction(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.event%rowtype;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  -- A mesma trava das alterações de membros e evento serializa duas tentativas
  -- de assumir, uma saída/expulsão e a futura confirmação do sorteio.
  perform 1 from public.racha r where r.id = v_event.racha_id for update;

  select * into v_event from public.event e where e.id = p_event_id;
  if not found or v_event.status not in ('upcoming', 'active') then
    raise exception 'not_allowed';
  end if;
  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  -- Sem event_match_touch: a Partida não mudou, só quem a conduz.
  update public.event e
  set conductor_id = v_uid,
    conduction_seq = nextval('private.event_match_seq')
  where e.id = p_event_id;
  perform private.event_match_notify(p_event_id);

  if v_event.conductor_id is not null and v_event.conductor_id is distinct from v_uid then
    perform private.notify(
      array[v_event.conductor_id],
      'conduction_taken',
      v_event.racha_id,
      p_event_id,
      null,
      '{}'::jsonb
    );
  end if;
end $$;

-- Veio de 20261003170000_event_sort_after.sql. Só entra a chamada a private.notify.
create or replace function private.promote_waitlist_for_event(p_event_id uuid)
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
  if not found or private.event_sort_confirmed(p_event_id) then
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
    perform private.mark_paid_fact_had_slot(p_event_id, v_profile_id);

    perform private.notify(
      array[v_profile_id],
      'waitlist_promoted',
      v_event.racha_id,
      p_event_id,
      null,
      jsonb_build_object('event_date', to_char(v_event.starts_on, 'YYYY-MM-DD'))
    );
  end loop;
end $$;

-- Veio de 20261002171527_event_attendance.sql. Só entra a chamada a private.notify.
create or replace function private.insert_credit_entry(
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
declare
  v_inserted integer;
begin
  insert into public.racha_credit_entry (
    racha_id, profile_id, source_event_id, operation_key, entry_kind,
    amount_delta, expires_at, source_grant_id
  ) values (
    p_racha_id, p_profile_id, p_source_event_id, p_operation_key, p_entry_kind,
    p_amount_delta, p_expires_at, p_source_grant_id
  )
  on conflict (operation_key) do nothing;

  -- ON CONFLICT DO NOTHING não conta como linha nova: não avisa de novo.
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 and p_entry_kind in ('absence_daily', 'waitlist_daily') then
    perform private.notify(
      array[p_profile_id],
      'credit_created',
      p_racha_id,
      p_source_event_id,
      null,
      jsonb_build_object(
        'amount_cents', p_amount_delta,
        'valid_until', to_char(p_expires_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
      )
    );
  end if;
end $$;


-- Leitura calculada na hora: resolução da Solicitação e se o assunto ainda existe.
create or replace function public.get_notifications()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_seen timestamptz;
  v_rows jsonb;
begin
  if v_uid is null or not exists (select 1 from public.profile p where p.id = v_uid) then
    raise exception 'not_allowed';
  end if;

  select p.notifications_seen_at into v_seen from public.profile p where p.id = v_uid;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'kind', n.kind,
      'racha_id', n.racha_id,
      'racha_name', n.racha_name,
      'event_id', n.event_id,
      'actor_name', n.actor_name,
      'payload', n.payload,
      'created_at', n.created_at,
      'is_new', n.created_at > coalesce(v_seen, '-infinity'::timestamptz),
      'resolution', case
        when n.kind is distinct from 'join_request' then null
        when jr.id is not null and jr.status = 'PENDING' then null
        when jr.id is not null and jr.status = 'APPROVED' then jsonb_build_object(
          'status', 'approved',
          'by_name', (select rp.display_name from public.profile rp where rp.id = jr.reviewed_by),
          'by_me', jr.reviewed_by is not distinct from v_uid
        )
        when jr.id is not null and jr.status = 'REJECTED' then jsonb_build_object(
          'status', 'refused',
          'by_name', (select rp.display_name from public.profile rp where rp.id = jr.reviewed_by),
          'by_me', jr.reviewed_by is not distinct from v_uid
        )
        when n.payload ? 'resolution' then jsonb_build_object(
          'status', n.payload #>> '{resolution,status}',
          'by_name', n.payload #>> '{resolution,by_name}',
          'by_me', (n.payload #>> '{resolution,by_id}')::uuid is not distinct from v_uid
        )
        else null
      end,
      'target', case
        when not exists (select 1 from public.racha r where r.id = n.racha_id) then 'racha_deleted'
        when n.kind in ('expelled', 'join_refused') then 'available'
        when not exists (
          select 1 from public.member m
          where m.racha_id = n.racha_id and m.profile_id = v_uid and m.is_active
        ) then 'not_member'
        when n.kind in ('sort_confirmed', 'team_changed', 'conduction_taken')
          and n.event_id is not null
          and not exists (select 1 from public.event e where e.id = n.event_id)
          then 'event_cancelled'
        when n.kind in ('sort_confirmed', 'team_changed', 'conduction_taken')
          and exists (
            select 1 from public.event e
            where e.id = n.event_id and e.status = 'finished'
          )
          then 'event_finished'
        else 'available'
      end
    )
    order by n.created_at desc, n.id desc
  ), '[]'::jsonb)
  into v_rows
  from public.notification n
  left join public.join_request jr on jr.id = n.join_request_id
  where n.recipient_id = v_uid
    and n.created_at > now() - interval '60 days';

  return v_rows;
end $$;

revoke execute on function public.get_notifications() from public, anon;
grant execute on function public.get_notifications() to authenticated;

create function public.get_unseen_notifications_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.profile p where p.id = v_uid) then
    raise exception 'not_allowed';
  end if;

  return (
    select count(*)::integer
    from public.notification n
    join public.profile p on p.id = v_uid
    where n.recipient_id = v_uid
      and n.created_at > coalesce(p.notifications_seen_at, '-infinity'::timestamptz)
      and n.created_at > now() - interval '60 days'
  );
end $$;

revoke execute on function public.get_unseen_notifications_count() from public, anon;
grant execute on function public.get_unseen_notifications_count() to authenticated;

create function public.mark_notifications_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;

  update public.profile p
    set notifications_seen_at = now()
    where p.id = v_uid;
  if not found then
    raise exception 'not_allowed';
  end if;
end $$;

revoke execute on function public.mark_notifications_seen() from public, anon;
grant execute on function public.mark_notifications_seen() to authenticated;

select cron.schedule(
  'purge-old-notifications',
  '15 4 * * *',
  $$delete from public.notification where created_at < now() - interval '60 days'$$
);
