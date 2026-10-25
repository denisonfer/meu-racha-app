-- Reforço escolhido: o Condutor aponta quem entra, entre os ativos do Time doador.
-- Sem id de quem entra, o sorteio segue como antes.
drop function public.reinforce_event_match(uuid, uuid, uuid, uuid);

-- Corpo de 20261009100000_notifications.sql; entram p_entering_* e a escolha de v_src.
create function public.reinforce_event_match(
  p_match_id uuid,
  p_profile_id uuid default null,
  p_guest_id uuid default null,
  p_donor_team_id uuid default null,
  p_entering_profile_id uuid default null,
  p_entering_guest_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_person uuid;
  v_entering uuid := coalesce(p_entering_profile_id, p_entering_guest_id);
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

  -- Escolher quem entra exige o Time: sem ele não há de onde tirar a pessoa.
  if (p_entering_profile_id is not null and p_entering_guest_id is not null)
    or (v_entering is not null and p_donor_team_id is null) then
    raise exception 'not_allowed';
  end if;

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

  if v_entering is not null then
    select p.* into v_src
    from public.event_sort_team_player p
    where p.team_id = v_donor and p.left_at is null and p.person_id = v_entering;
    if not found then
      raise exception 'entering_not_active';
    end if;
  else
    select p.* into v_src
    from public.event_sort_team_player p
    where p.team_id = v_donor and p.left_at is null
    order by random()
    limit 1;
  end if;

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

revoke execute on function public.reinforce_event_match(uuid, uuid, uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.reinforce_event_match(uuid, uuid, uuid, uuid, uuid, uuid)
  to authenticated;

-- Corpo de 20261006120000_event_conduction_takeover.sql; só o bloco v_donors ganha outfield.
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
      'outfield_count', d.outfield_count,
      'outfield', d.outfield
    ) order by d.queue_order), '[]'::jsonb)
    into v_donors
    from (
      select t.id as team_id, t.team_number, t.queue_order,
        (t.queue_order - 2)::integer as queue_position,
        (select count(*) from public.event_sort_team_player p
         where p.team_id = t.id and p.left_at is null) as outfield_count,
        (select coalesce(jsonb_agg(jsonb_build_object(
           'person', private.event_match_person_json(p.profile_id, p.guest_id),
           'primary_position', p.primary_position_snapshot
         ) order by private.event_match_person_json(p.profile_id, p.guest_id) ->> 'display_name'),
         '[]'::jsonb)
         from public.event_sort_team_player p
         where p.team_id = t.id and p.left_at is null) as outfield
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
    'seq', greatest(
      coalesce(
        v_open.seq,
        (select m.seq from public.event_match m
         where m.event_id = p_event_id order by m.seq desc limit 1),
        0
      ),
      coalesce(v_event.conduction_seq, 0)
    ),
    'conductor_name', (
      select p.display_name from public.profile p where p.id = v_event.conductor_id
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
      'can_conduct', v_event.conductor_id is not distinct from v_uid,
      'can_assume', v_event.status = 'active'
        and v_event.conductor_id is distinct from v_uid
        and coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false)
    ),
    'reinforcement_donors', v_donors,
    'pending_reinforcements', v_pending,
    'events', v_events,
    'next_arrival', private.event_sort_arrival_destination(p_event_id)
  );
end $$;
