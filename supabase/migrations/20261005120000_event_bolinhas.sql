-- Bolinhas (regras v1.39): ajuste de Times acionado pelo Condutor. Registro por Evento,
-- regra de par única, RPC com sorteio no banco e leitura nos Times.

create type public.event_bolinhas_color as enum ('blue', 'red');

create table public.event_bolinhas (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  giver_team_id uuid not null,
  receiver_team_id uuid not null,
  all_move boolean not null,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  unique (id, event_id),
  constraint event_bolinhas_event_fk foreign key (event_id)
    references public.event (id) on delete cascade,
  constraint event_bolinhas_giver_fk foreign key (giver_team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_bolinhas_receiver_fk foreign key (receiver_team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_bolinhas_teams_differ check (giver_team_id <> receiver_team_id)
);
create index event_bolinhas_event on public.event_bolinhas (event_id, created_at desc);

-- draw_order é a ordem da animação no app.
create table public.event_bolinhas_ball (
  id uuid primary key default gen_random_uuid(),
  bolinhas_id uuid not null references public.event_bolinhas (id) on delete cascade,
  draw_order smallint not null,
  profile_id uuid references public.profile (id),
  guest_id uuid references public.event_guest (id),
  color public.event_bolinhas_color not null,
  unique (bolinhas_id, draw_order),
  constraint event_bolinhas_ball_person_xor check ((profile_id is null) <> (guest_id is null))
);

alter table public.event_bolinhas enable row level security;
alter table public.event_bolinhas_ball enable row level security;
revoke all on public.event_bolinhas from public, anon, authenticated;
revoke all on public.event_bolinhas_ball from public, anon, authenticated;

-- Regra única do par (RPC e leitura). Com Partida aberta, os Times 1 e 2 estão em campo.
create function private.event_bolinhas_can_pair(
  p_event_id uuid, p_giver uuid, p_receiver uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_giver <> p_receiver
    and g.id is not null and r.id is not null
    and g.queue_order is not null and r.queue_order is not null
    and not (
      exists (select 1 from public.event_match m where m.event_id = p_event_id and m.status = 'open')
      and (g.queue_order <= 2 or r.queue_order <= 2)
    )
    and (select count(*) from public.event_sort_team_player p
         where p.team_id = g.id and p.left_at is null) >= 1
    and (select count(*) from public.event_sort_team_player p
         where p.team_id = r.id and p.left_at is null) < e.outfield_per_team
  from public.event e
  left join public.event_sort_team g on g.id = p_giver and g.event_id = e.id
  left join public.event_sort_team r on r.id = p_receiver and r.event_id = e.id
  where e.id = p_event_id
$$;

create function private.event_bolinhas_availability(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.event_sort_team g, public.event_sort_team r
      where g.event_id = p_event_id and r.event_id = p_event_id
        and coalesce(private.event_bolinhas_can_pair(p_event_id, g.id, r.id), false)
    ) then 'ok'
    when exists (
      -- há quem receba se algum Time poderia receber de um doador qualquer, ignorando o doador
      select 1 from public.event_sort_team r
      join public.event e on e.id = r.event_id
      where r.event_id = p_event_id and r.queue_order is not null
        and not (
          exists (select 1 from public.event_match m where m.event_id = p_event_id and m.status = 'open')
          and r.queue_order <= 2
        )
        and (select count(*) from public.event_sort_team_player p
             where p.team_id = r.id and p.left_at is null) < e.outfield_per_team
    ) then 'no_giver'
    else 'no_receiver'
  end
$$;

create function public.draw_event_bolinhas(
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

  -- um sorteio só: a posição define a ordem da animação e a cor
  with shuffled as (
    select p.*, (row_number() over (order by random()))::smallint as rn
    from public.event_sort_team_player p
    where p.team_id = p_giver_team_id and p.left_at is null
  )
  insert into public.event_bolinhas_ball (bolinhas_id, draw_order, profile_id, guest_id, color)
  select v_id, s.rn, s.profile_id, s.guest_id,
    (case when s.rn <= v_blue then 'blue' else 'red' end)::public.event_bolinhas_color
  from shuffled s;

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

revoke execute on function
  private.event_bolinhas_can_pair(uuid, uuid, uuid),
  private.event_bolinhas_availability(uuid)
from public, anon, authenticated;
revoke execute on function public.draw_event_bolinhas(uuid, uuid, uuid) from public, anon;
grant execute on function public.draw_event_bolinhas(uuid, uuid, uuid) to authenticated;


-- Corpo de 20261005100000 + bolinhas_availability e last_bolinhas. state=none continua sem as chaves.
create or replace function private.event_sort_published_json(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_sort public.event_sort%rowtype;
  v_uid uuid := (select auth.uid());
  v_is_conductor boolean;
  v_my_status public.attendance_status;
  v_operable boolean;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  select * into v_sort from public.event_sort s
  where s.event_id = p_event_id and s.status = 'confirmed';
  if not found then
    return jsonb_build_object('state', 'none');
  end if;

  v_is_conductor := v_event.conductor_id is not distinct from v_uid;
  v_operable := v_event.status = 'active';
  select ea.status into v_my_status from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = v_uid;

  return jsonb_build_object(
    'state', 'published',
    'event_id', p_event_id,
    'event_status', v_event.status,
    'conductor_id', v_event.conductor_id,
    'is_conductor', v_is_conductor,
    'confirmed_at', v_sort.confirmed_at,
    'outfield_per_team', v_event.outfield_per_team,
    'mode', v_sort.mode,
    'balance', private.event_sort_balance_json(v_sort),
    'super_warning', v_sort.super_warning,
    'teams', private.event_sort_teams_json(p_event_id),
    'goalkeepers_per_team', v_sort.goalkeepers_per_team,
    'goalkeeper_queue', private.event_sort_goalkeeper_queue_json(p_event_id),
    'viewer', jsonb_build_object(
      'my_status', v_my_status,
      'can_include', v_is_conductor and v_operable,
      'can_return', v_is_conductor and v_operable,
      'can_leave_any', v_is_conductor and v_operable,
      'can_leave_self', coalesce(v_my_status = 'confirmed', false) and v_operable
    ),
    'waiting_for_inclusion', (
      select coalesce(jsonb_agg(w.obj order by w.grp, w.pos, w.name, w.id), '[]'::jsonb)
      from (
        select 0 as grp, private.my_waitlist_position(p_event_id, ea.profile_id) as pos,
          p.display_name as name, ea.profile_id as id,
          jsonb_build_object(
            'profile_id', ea.profile_id,
            'display_name', p.display_name,
            'avatar_path', p.avatar_path,
            'plays_as', m.plays_as,
            'queue_position', private.my_waitlist_position(p_event_id, ea.profile_id),
            'reason', 'waitlisted'
          ) as obj
        from public.event_attendance ea
        join public.profile p on p.id = ea.profile_id
        join public.member m
          on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
        where ea.event_id = p_event_id and ea.status = 'waitlisted'
        union all
        select 1, null::integer, p.display_name, ea.profile_id,
          jsonb_build_object(
            'profile_id', ea.profile_id,
            'display_name', p.display_name,
            'avatar_path', p.avatar_path,
            'plays_as', m.plays_as,
            'queue_position', null,
            'reason', 'not_attended'
          )
        from public.event_attendance ea
        join public.profile p on p.id = ea.profile_id
        join public.member m
          on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
        where ea.event_id = p_event_id and ea.status = 'confirmed'
          and not exists (
            select 1 from public.event_sort_team_player tp
            where tp.event_id = p_event_id and tp.person_id = ea.profile_id
          )
          and not exists (
            select 1 from public.event_sort_goalkeeper k
            where k.event_id = p_event_id and k.person_id = ea.profile_id
          )
      ) w
    ),
    'left', (
      select coalesce(jsonb_agg(x.obj order by x.name, x.id), '[]'::jsonb)
      from (
        select p.display_name as name, ea.profile_id as id,
          jsonb_build_object(
            'kind', 'member', 'profile_id', ea.profile_id, 'guest_id', null,
            'display_name', p.display_name, 'avatar_path', p.avatar_path,
            'plays_as', m.plays_as, 'did_attend', ea.did_attend
          ) as obj
        from public.event_attendance ea
        join public.profile p on p.id = ea.profile_id
        join public.member m
          on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
        where ea.event_id = p_event_id and ea.status = 'left'
        union all
        select g.display_name, g.id,
          jsonb_build_object(
            'kind', 'guest', 'profile_id', null, 'guest_id', g.id,
            'display_name', g.display_name, 'avatar_path', null,
            'plays_as', g.plays_as, 'did_attend', g.did_attend
          )
        from public.event_guest g
        where g.event_id = p_event_id and g.left_at is not null
      ) x
    ),
    'next_arrival', private.event_sort_arrival_destination(p_event_id),
    'bolinhas_availability', private.event_bolinhas_availability(p_event_id),
    -- a nota some quando uma Partida começa depois da Bolinhas
    'last_bolinhas', (
      select jsonb_build_object(
        'giver_team_number', gt.team_number,
        'receiver_team_number', rt.team_number,
        'all_move', lb.all_move,
        'created_at', lb.created_at,
        'moved', (
          select coalesce(jsonb_agg(
            private.event_match_person_json(b.profile_id, b.guest_id)
              || jsonb_build_object('from_team_number', gt.team_number)
            order by b.draw_order
          ), '[]'::jsonb)
          from public.event_bolinhas_ball b
          where b.bolinhas_id = lb.id and b.color = 'blue'
        )
      )
      from (
        select * from public.event_bolinhas x
        where x.event_id = p_event_id
        order by x.created_at desc, x.id desc limit 1
      ) lb
      join public.event_sort_team gt on gt.id = lb.giver_team_id
      join public.event_sort_team rt on rt.id = lb.receiver_team_id
      where lb.created_at > coalesce((
        select max(m.started_at) from public.event_match m where m.event_id = p_event_id
      ), '-infinity'::timestamptz)
    )
  );
end $$;

