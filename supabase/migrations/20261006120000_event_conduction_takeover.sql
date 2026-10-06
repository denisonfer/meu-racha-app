-- Sobe na troca de condução para o cliente refazer o retrato mesmo sem
-- Partida aberta; sai da mesma sequence do seq das Partidas.
alter table public.event add column conduction_seq bigint;

-- Parte de 20261002000000_separate_event_conduction.sql.
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
end $$;

revoke execute on function public.assume_event_conduction(uuid) from public, anon;
grant execute on function public.assume_event_conduction(uuid) to authenticated;

-- Parte de 20261003230000_event_match_rpc.sql.
create or replace function private.event_match_notify(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq bigint;
begin
  select greatest(
    coalesce((select max(m.seq) from public.event_match m where m.event_id = p_event_id), 0),
    coalesce(e.conduction_seq, 0)
  ) into v_seq
  from public.event e where e.id = p_event_id;
  perform realtime.send(
    jsonb_build_object('seq', v_seq),
    'match_changed',
    'event:' || p_event_id::text,
    true
  );
end $$;

-- Parte de 20261006110000_yellow_card_mode.sql.
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
