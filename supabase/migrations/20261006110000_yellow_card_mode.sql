-- Amarelo configurável: o efeito do amarelo vira chave do motor do Racha.
-- timed: sai pelo relógio da Partida por yellow_out_min minutos. mark: continua em campo, marcado.
-- O Evento copia as duas colunas do Racha; a Partida lê só do Evento.

create type public.yellow_card_mode as enum ('timed', 'mark');

alter table public.racha
  add column yellow_card_mode public.yellow_card_mode not null default 'timed',
  add column yellow_out_min smallint not null default 2
    constraint racha_yellow_out_min_range check (yellow_out_min between 1 and 90),
  add constraint racha_yellow_shorter_than_match check (
    yellow_card_mode = 'mark'
    or match_duration_min is null
    or yellow_out_min < match_duration_min
  );

alter table public.event
  add column yellow_card_mode public.yellow_card_mode not null default 'timed',
  add column yellow_out_min smallint not null default 2
    constraint event_yellow_out_min_range check (yellow_out_min between 1 and 90),
  add constraint event_yellow_shorter_than_match check (
    yellow_card_mode = 'mark'
    or match_duration_min is null
    or yellow_out_min < match_duration_min
  );

grant update (yellow_card_mode, yellow_out_min) on public.racha to authenticated;

-- Corpo de 20261001190331. Mesma lista de colunas do motor, com as duas novas.
create or replace function public.guard_racha_motor_while_event_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.racha_has_active_event(old.id)
     and (
       new.outfield_per_team is distinct from old.outfield_per_team
       or new.game_mode is distinct from old.game_mode
       or new.max_consecutive_wins is distinct from old.max_consecutive_wins
       or new.tie_rule is distinct from old.tie_rule
       or new.tie_return_order is distinct from old.tie_return_order
       or new.consider_position is distinct from old.consider_position
       or new.match_duration_min is distinct from old.match_duration_min
       or new.yellow_card_mode is distinct from old.yellow_card_mode
       or new.yellow_out_min is distinct from old.yellow_out_min
     )
  then
    raise exception 'event_active';
  end if;
  return new;
end $$;

-- Corpo de 20261001131237, com o modo e os minutos do amarelo.
drop function public.create_racha(
  text, smallint, public.game_mode, smallint,
  public.tie_rule, public.tie_return_order, boolean, text, smallint, smallint
);

create function public.create_racha(
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

revoke execute on function public.create_racha(
  text, smallint, public.game_mode, smallint,
  public.tie_rule, public.tie_return_order, boolean, text, smallint, smallint,
  public.yellow_card_mode, smallint
) from public, anon;
grant execute on function public.create_racha(
  text, smallint, public.game_mode, smallint,
  public.tie_rule, public.tie_return_order, boolean, text, smallint, smallint,
  public.yellow_card_mode, smallint
) to authenticated;

-- Corpo de 20261003110000. O Evento copia modo e minutos do amarelo do Racha.
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

  return v_event_id;
end $$;

-- Corpo de 20261003022422. O Evento recorrente também copia modo e minutos do amarelo.
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

  return v_next_id;
end $$;

-- Corpo de 20261006100000. O goleiro de amarelo só fica sem o gol sofrido em timed, durante yellow_out_min do Evento.
create or replace function public.add_event_match_goal(
  p_match_id uuid,
  p_request_key text,
  p_team_id uuid,
  p_scorer uuid default null,
  p_assist uuid default null,
  p_own_goal boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_scoring uuid;
  v_other uuid;
  v_scorer public.event_match_lineup;
  v_assist public.event_match_lineup;
  v_conceded public.event_match_lineup;
  v_own boolean := coalesce(p_own_goal, false);
  v_keeper boolean;
  v_event public.event;
begin
  v_match := private.lock_event_match(p_match_id);
  select * into v_event from public.event e where e.id = v_match.event_id;

  if exists (
    select 1 from public.event_match_goal g
    where g.match_id = p_match_id and g.request_key = p_request_key
  ) then
    return private.event_match_json(v_match.event_id);
  end if;

  if v_match.status <> 'open' then
    raise exception 'no_open_match';
  end if;
  if p_team_id is null or p_team_id not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception 'invalid_team';
  end if;

  -- gol contra: p_team_id tocou; o ponto vai para o adversário, sem autor
  v_scoring := case
    when not v_own then p_team_id
    when p_team_id = v_match.home_team_id then v_match.away_team_id
    else v_match.home_team_id
  end;
  v_other := case
    when v_scoring = v_match.home_team_id then v_match.away_team_id
    else v_match.home_team_id
  end;

  if v_own then
    if p_scorer is not null or p_assist is not null then
      raise exception 'invalid_scorer';
    end if;
  else
    select * into v_scorer from public.event_match_lineup l
    where l.match_id = p_match_id and l.team_id = v_scoring
      and l.person_id = p_scorer and l.left_at is null;
    if p_scorer is null or not found then
      raise exception 'invalid_scorer';
    end if;
    if p_assist is not null then
      select * into v_assist from public.event_match_lineup l
      where l.match_id = p_match_id and l.team_id = v_scoring
        and l.person_id = p_assist and l.left_at is null;
      if not found or p_assist = p_scorer then
        raise exception 'invalid_scorer';
      end if;
    end if;
  end if;

  select * into v_conceded from public.event_match_lineup l
  where l.match_id = p_match_id and l.team_id = v_other
    and l.role = 'GOALKEEPER' and l.left_at is null;
  v_keeper := found;

  -- yellow_out_min do Evento em segundos de relógio da Partida. No instante exato o amarelo já acabou.
  -- Em mark o amarelo não tira ninguém do gol. IF aninhado: sem goleiro ativo o registro nem foi preenchido.
  if v_keeper then
    if exists (
      select 1 from public.event_match_card c
      where c.match_id = p_match_id
        and c.person_id = v_conceded.person_id
        and c.color = 'yellow'
        and v_event.yellow_card_mode = 'timed'
        and c.match_second + v_event.yellow_out_min * 60 > private.event_match_second(p_match_id)
    ) then
      v_conceded.profile_id := null;
      v_conceded.guest_id := null;
    end if;
  end if;

  insert into public.event_match_goal (
    event_id, match_id, request_key, team_id, is_own_goal,
    scorer_profile_id, scorer_guest_id, assist_profile_id, assist_guest_id,
    conceded_profile_id, conceded_guest_id
  ) values (
    v_match.event_id, p_match_id, p_request_key, v_scoring, v_own,
    v_scorer.profile_id, v_scorer.guest_id, v_assist.profile_id, v_assist.guest_id,
    v_conceded.profile_id, v_conceded.guest_id
  );

  perform private.event_match_touch(p_match_id);
  return private.event_match_json(v_match.event_id);
end $$;

-- Corpo de 20261006100000. Expõe modo e minutos do amarelo do Evento.
create or replace function private.event_match_json(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_uid uuid := (select auth.uid());
  v_open public.event_match;
  v_last public.event_match;
  v_t1 public.event_sort_team;
  v_t2 public.event_sort_team;
  v_next jsonb := null;
  v_challenger uuid;
  v_rematch boolean := false;
  v_donors jsonb := '[]'::jsonb;
  v_pending jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
begin
  select * into v_event from public.event e where e.id = p_event_id;

  select * into v_open
  from public.event_match m
  where m.event_id = p_event_id and m.status = 'open';

  select * into v_t1 from public.event_sort_team t
  where t.event_id = p_event_id and t.queue_order = 1;
  select * into v_t2 from public.event_sort_team t
  where t.event_id = p_event_id and t.queue_order = 2;

  if v_open.id is null and v_t1.id is not null and v_t2.id is not null then
    select * into v_last from public.event_match m
    where m.event_id = p_event_id and m.status = 'finished'
    order by m.number desc
    limit 1;
    if found then
      if v_last.next_challenger_team_id in (v_t1.id, v_t2.id) then
        v_challenger := v_last.next_challenger_team_id;
      end if;
      v_rematch := v_last.next_is_rematch
        and v_last.home_team_id in (v_t1.id, v_t2.id)
        and v_last.away_team_id in (v_t1.id, v_t2.id);
    end if;
    v_next := jsonb_build_object(
      'home', private.event_match_next_side_json(p_event_id, v_t1.id),
      'away', private.event_match_next_side_json(p_event_id, v_t2.id),
      'challenger_team_id', v_challenger,
      'is_rematch', v_rematch
    );
  end if;

  if v_open.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'team_id', d.team_id,
      'team_number', d.team_number,
      'queue_position', d.queue_position,
      'outfield_count', d.outfield_count
    ) order by d.queue_order), '[]'::jsonb)
    into v_donors
    from (
      select t.id as team_id, t.team_number, t.queue_order,
        (t.queue_order - 2)::integer as queue_position,
        (select count(*) from public.event_sort_team_player p
         where p.team_id = t.id and p.left_at is null) as outfield_count
      from public.event_sort_team t
      where t.event_id = p_event_id and t.queue_order >= 3
        and exists (
          select 1 from public.event_sort_team_player p
          where p.team_id = t.id and p.left_at is null
        )
    ) d;

    select coalesce(jsonb_agg(jsonb_build_object(
      'person', private.event_match_person_json(l.profile_id, l.guest_id),
      'team_id', l.team_id,
      'team_number', t.team_number,
      'left_at', l.left_at
    ) order by l.left_at, l.id), '[]'::jsonb)
    into v_pending
    from public.event_match_lineup l
    join public.event_sort_team t on t.id = l.team_id
    where l.match_id = v_open.id
      and l.role = 'OUTFIELD'
      and l.left_at is not null
      and l.left_by_self
      and not l.left_by_red
      and l.team_id in (v_open.home_team_id, v_open.away_team_id)
      and not exists (
        select 1 from public.event_match_reinforcement r
        where r.match_id = l.match_id
          and (
            (l.profile_id is not null and r.left_profile_id = l.profile_id)
            or (l.guest_id is not null and r.left_guest_id = l.guest_id)
          )
      )
      and (select count(*) from public.event_sort_team_player p
           where p.team_id = l.team_id and p.left_at is null) < v_event.outfield_per_team;

    v_events := private.event_match_events_json(v_open.id);
  end if;

  return jsonb_build_object(
    'event_id', p_event_id,
    'event_status', v_event.status,
    'state', case when v_open.id is not null then 'open' else 'ready' end,
    'server_now', now(),
    'duration_min', v_event.match_duration_min,
    'yellow_card_mode', v_event.yellow_card_mode,
    'yellow_out_min', v_event.yellow_out_min,
    'started_at', v_open.started_at,
    'paused_at', v_open.paused_at,
    'paused_seconds', v_open.paused_seconds,
    'seq', coalesce(
      v_open.seq,
      (select m.seq from public.event_match m
       where m.event_id = p_event_id order by m.seq desc limit 1),
      0
    ),
    'match', case when v_open.id is not null then private.event_match_item_json(v_open.id) end,
    'next_match', v_next,
    'teams', private.event_match_teams_queue_json(p_event_id),
    'goalkeeper_queue', private.event_match_goalkeeper_queue_json(p_event_id),
    'finished_matches', (
      select coalesce(jsonb_agg(private.event_match_item_json(m.id) order by m.number desc), '[]'::jsonb)
      from public.event_match m
      where m.event_id = p_event_id and m.status = 'finished'
    ),
    'viewer', jsonb_build_object(
      'can_conduct', v_event.conductor_id is not distinct from v_uid
    ),
    'reinforcement_donors', v_donors,
    'pending_reinforcements', v_pending,
    'events', v_events,
    'next_arrival', private.event_sort_arrival_destination(p_event_id)
  );
end $$;
