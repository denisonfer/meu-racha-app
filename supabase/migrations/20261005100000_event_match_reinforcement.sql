-- Reforço e entrada em campo, etapa 1: origem no elenco, tabela Reforço, destino
-- da chegada, place_player em campo, RPC, restauro do descarte e leitura.
-- Funções redefinidas partem da última migration citada no comentário de cada uma.

create type public.event_match_lineup_entry_kind as enum (
  'start', 'reinforcement', 'inclusion', 'return', 'goalkeeper'
);

alter table public.event_match_lineup
  add column entry_kind public.event_match_lineup_entry_kind not null default 'start',
  add column left_by_self boolean not null default false;

-- Quem saiu, quem entrou, de qual Time para qual, e se o Time foi sorteado.
-- Motivo fica fora deste corte. Único por Partida e pessoa que saiu: NULL não colide.
create table public.event_match_reinforcement (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  match_id uuid not null,
  left_profile_id uuid references public.profile (id),
  left_guest_id uuid references public.event_guest (id),
  entered_profile_id uuid references public.profile (id),
  entered_guest_id uuid references public.event_guest (id),
  from_team_id uuid not null,
  to_team_id uuid not null,
  team_drawn boolean not null,
  created_at timestamptz not null default now(),
  unique (id, event_id),
  constraint event_match_reinforcement_match_fk foreign key (match_id, event_id)
    references public.event_match (id, event_id) on delete cascade,
  constraint event_match_reinforcement_from_fk foreign key (from_team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_match_reinforcement_to_fk foreign key (to_team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_match_reinforcement_left_xor
    check ((left_profile_id is null) <> (left_guest_id is null)),
  constraint event_match_reinforcement_entered_xor
    check ((entered_profile_id is null) <> (entered_guest_id is null)),
  constraint event_match_reinforcement_teams_differ check (from_team_id <> to_team_id)
);

create unique index event_match_reinforcement_left_profile
  on public.event_match_reinforcement (match_id, left_profile_id)
  where left_profile_id is not null;
create unique index event_match_reinforcement_left_guest
  on public.event_match_reinforcement (match_id, left_guest_id)
  where left_guest_id is not null;
create index event_match_reinforcement_match
  on public.event_match_reinforcement (match_id);

alter table public.event_match_reinforcement enable row level security;
revoke all on public.event_match_reinforcement from public, anon, authenticated;

-- Corpo de 20261003250000. left_by_self: parâmetro no fim (default deriva);
-- substituto no gol grava entry_kind = goalkeeper.
drop function private.event_sort_close_player(uuid, uuid, uuid);

create function private.event_sort_close_player(
  p_event_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_left_by_self boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_person uuid := coalesce(p_profile_id, p_guest_id);
  v_match_id uuid;
  v_home uuid;
  v_away uuid;
  v_lineup_team uuid;
  v_lineup_role public.event_match_role;
  v_next public.event_sort_goalkeeper;
  v_uid uuid := (select auth.uid());
  v_conductor uuid;
  v_left_by_self boolean;
begin
  select e.conductor_id into v_conductor from public.event e where e.id = p_event_id;
  -- leave_racha/cleanup passam true; Reforço passa false; senão: própria Saída
  -- só quando o chamador é a pessoa e não é o Condutor.
  v_left_by_self := coalesce(
    p_left_by_self,
    p_profile_id is not distinct from v_uid and v_uid is distinct from v_conductor
  );

  select m.id, m.home_team_id, m.away_team_id
    into v_match_id, v_home, v_away
  from public.event_match m
  where m.event_id = p_event_id and m.status = 'open';

  if v_match_id is not null then
    select l.team_id, l.role into v_lineup_team, v_lineup_role
    from public.event_match_lineup l
    where l.match_id = v_match_id and l.person_id = v_person and l.left_at is null;

    if v_lineup_team is not null then
      update public.event_match_lineup l
      set left_at = now(), left_by_self = v_left_by_self
      where l.match_id = v_match_id and l.person_id = v_person and l.left_at is null;
    end if;
  end if;

  update public.event_sort_team_player p set left_at = now()
  where p.event_id = p_event_id and p.person_id = v_person
    and p.left_at is null
  returning p.team_id into v_team_id;

  delete from public.event_sort_goalkeeper k
  where k.event_id = p_event_id and k.person_id = v_person;

  -- §8.3: machucou ou foi embora no gol — entra o primeiro da fila; sem fila, gol vazio
  if v_match_id is not null and v_lineup_role = 'GOALKEEPER' and v_lineup_team is not null then
    select * into v_next
    from public.event_sort_goalkeeper k
    where k.event_id = p_event_id and k.team_id is null
    order by k.queue_order, k.id
    limit 1;
    if found then
      update public.event_sort_goalkeeper k
      set team_id = v_lineup_team, queue_order = null
      where k.id = v_next.id;
      perform private.event_match_compact_goalkeeper_queue(p_event_id);
      insert into public.event_match_lineup (
        event_id, match_id, team_id, profile_id, guest_id, role, entry_kind
      ) values (
        p_event_id, v_match_id, v_lineup_team, v_next.profile_id, v_next.guest_id,
        'GOALKEEPER', 'goalkeeper'
      );
    end if;
  end if;

  if v_team_id is not null and not exists (
    select 1 from public.event_sort_team_player p where p.team_id = v_team_id and p.left_at is null
  ) then
    -- Time em campo fica até o apito; fora da Partida, vazio continua saindo
    if v_match_id is null or v_team_id not in (v_home, v_away) then
      update public.event_sort_team t set queue_order = null where t.id = v_team_id;
      perform private.event_sort_compact_queue(p_event_id);
    end if;
  end if;

  perform private.event_sort_rebalance_goalkeepers(p_event_id);

  if v_match_id is not null then
    perform private.event_match_touch(v_match_id);
  end if;
end $$;

-- Uma só regra para a prévia (leitura) e para place_player. Goleiro não conta.
create function private.event_sort_arrival_destination(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_capacity smallint;
  v_match_open boolean;
  v_t1 uuid;
  v_n1 smallint;
  v_c1 integer := 0;
  v_t2 uuid;
  v_n2 smallint;
  v_c2 integer := 0;
  v_team uuid;
  v_number smallint;
begin
  select e.outfield_per_team into v_capacity from public.event e where e.id = p_event_id;

  v_match_open := exists (
    select 1 from public.event_match m
    where m.event_id = p_event_id and m.status = 'open'
  );

  if v_match_open then
    select t.id, t.team_number,
      (select count(*) from public.event_sort_team_player p
       where p.team_id = t.id and p.left_at is null)
    into v_t1, v_n1, v_c1
    from public.event_sort_team t
    where t.event_id = p_event_id and t.queue_order = 1;

    select t.id, t.team_number,
      (select count(*) from public.event_sort_team_player p
       where p.team_id = t.id and p.left_at is null)
    into v_t2, v_n2, v_c2
    from public.event_sort_team t
    where t.event_id = p_event_id and t.queue_order = 2;

    if v_t1 is not null and v_t2 is not null
       and v_c1 < v_capacity and v_c2 < v_capacity and v_c1 = v_c2 then
      return jsonb_build_object(
        'kind', 'field_draw', 'team_id', null, 'team_number', null
      );
    end if;
    if v_t1 is not null and v_c1 < v_capacity
       and (v_t2 is null or v_c2 >= v_capacity or v_c1 < v_c2) then
      return jsonb_build_object(
        'kind', 'field', 'team_id', v_t1, 'team_number', v_n1
      );
    end if;
    if v_t2 is not null and v_c2 < v_capacity then
      return jsonb_build_object(
        'kind', 'field', 'team_id', v_t2, 'team_number', v_n2
      );
    end if;
  end if;

  select t.id, t.team_number into v_team, v_number
  from public.event_sort_team t
  where t.event_id = p_event_id
    and t.queue_order is not null
    and (not v_match_open or t.queue_order not in (1, 2))
    and (select count(*) from public.event_sort_team_player p
         where p.team_id = t.id and p.left_at is null) < v_capacity
  order by t.queue_order
  limit 1;

  if v_team is not null then
    return jsonb_build_object(
      'kind', 'queue', 'team_id', v_team, 'team_number', v_number
    );
  end if;

  select coalesce(max(t.team_number), 0) + 1 into v_number
  from public.event_sort_team t where t.event_id = p_event_id;

  return jsonb_build_object(
    'kind', 'new_team', 'team_id', null, 'team_number', v_number
  );
end $$;

-- Corpo de 20261003250000. Destino pela função única; em campo também entra no elenco.
-- p_entry com default para a chamada de 8 argumentos que o teste da Partida ainda faz.
drop function private.event_sort_place_player(
  uuid, uuid, uuid, public.plays_as, smallint, boolean, public.position, public.position
);

create function private.event_sort_place_player(
  p_event_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_plays_as public.plays_as,
  p_stars smallint,
  p_super boolean,
  p_main public.position,
  p_sec public.position,
  p_entry public.event_match_lineup_entry_kind default 'inclusion'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_main_detail public.position_detail;
  v_sec_detail public.position_detail;
  v_dest jsonb;
  v_on_field boolean := false;
  v_match_id uuid;
begin
  if p_plays_as = 'GOALKEEPER' then
    insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id, guest_id)
    values (
      p_event_id,
      (select coalesce(max(k.queue_order), 0) + 1 from public.event_sort_goalkeeper k where k.event_id = p_event_id),
      p_profile_id, p_guest_id
    );
  else
    if p_profile_id is not null then
      select m.primary_position_detail, m.secondary_position_detail into v_main_detail, v_sec_detail
      from public.member m
      join public.event e on e.racha_id = m.racha_id
      where e.id = p_event_id and m.profile_id = p_profile_id;
    else
      select g.primary_position_detail, g.secondary_position_detail into v_main_detail, v_sec_detail
      from public.event_guest g where g.id = p_guest_id;
    end if;

    select m.id into v_match_id
    from public.event_match m
    where m.event_id = p_event_id and m.status = 'open';

    v_dest := private.event_sort_arrival_destination(p_event_id);

    if v_dest ->> 'kind' = 'field_draw' then
      select t.id into v_team_id
      from public.event_sort_team t
      where t.event_id = p_event_id and t.queue_order in (1, 2)
      order by random()
      limit 1;
      v_on_field := true;
    elsif v_dest ->> 'kind' = 'field' then
      v_team_id := (v_dest ->> 'team_id')::uuid;
      v_on_field := true;
    elsif v_dest ->> 'kind' = 'queue' then
      v_team_id := (v_dest ->> 'team_id')::uuid;
    else
      insert into public.event_sort_team (event_id, team_number, queue_order)
      select p_event_id, coalesce(max(t.team_number), 0) + 1, coalesce(max(t.queue_order), 0) + 1
      from public.event_sort_team t where t.event_id = p_event_id
      returning id into v_team_id;
    end if;

    insert into public.event_sort_team_player (
      event_id, team_id, profile_id, guest_id, stars_snapshot,
      is_super_star_snapshot, primary_position_snapshot, secondary_position_snapshot,
      primary_position_detail_snapshot, secondary_position_detail_snapshot
    ) values (
      p_event_id, v_team_id, p_profile_id, p_guest_id, p_stars, p_super, p_main, p_sec,
      v_main_detail, v_sec_detail
    );

    -- só quem entra num Time em campo soma elenco da Partida (e Partida jogada)
    if v_on_field and v_match_id is not null then
      insert into public.event_match_lineup (
        event_id, match_id, team_id, profile_id, guest_id, role, entry_kind
      ) values (
        p_event_id, v_match_id, v_team_id, p_profile_id, p_guest_id, 'OUTFIELD', p_entry
      );
    end if;
  end if;

  perform private.event_sort_rebalance_goalkeepers(p_event_id);

  perform private.event_match_touch(m.id)
  from public.event_match m
  where m.event_id = p_event_id and m.status = 'open';
end $$;

-- Corpo de 20261003210000; só passa p_entry = inclusion.
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

  perform private.event_sort_place_player(
    p_event_id, p_profile_id, null, v_member.plays_as, v_member.stars,
    v_member.is_super_star, v_member.primary_position, v_member.secondary_position,
    'inclusion'
  );

  return private.event_sort_published_json(p_event_id);
end $$;

-- Corpo de 20261003210000; só passa p_entry = inclusion.
create or replace function public.include_event_sort_guest(
  p_event_id uuid,
  p_display_name text,
  p_plays_as public.plays_as,
  p_primary_position public."position",
  p_secondary_position public."position",
  p_stars smallint,
  p_is_super_star boolean,
  p_primary_position_detail public.position_detail default null,
  p_secondary_position_detail public.position_detail default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_guest public.event_guest%rowtype;
  v_stars smallint;
  v_super boolean;
  v_primary_detail public.position_detail;
  v_secondary_detail public.position_detail;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

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

  if p_plays_as = 'OUTFIELD' and v_event.outfield_per_team >= 8 then
    if (p_primary_position in ('DEFENDER', 'MIDFIELDER') and p_primary_position_detail is null)
       or (p_secondary_position in ('DEFENDER', 'MIDFIELDER') and p_secondary_position_detail is null) then
      raise exception 'position_detail_required';
    end if;
    if not (private.position_detail_fits(p_primary_position, p_primary_position_detail)
            and private.position_detail_fits(p_secondary_position, p_secondary_position_detail)) then
      raise exception 'position_detail_mismatch';
    end if;
    v_primary_detail := p_primary_position_detail;
    v_secondary_detail := p_secondary_position_detail;
  end if;

  insert into public.event_guest (
    event_id, display_name, plays_as, primary_position, secondary_position, stars, is_super_star,
    did_attend, primary_position_detail, secondary_position_detail
  ) values (
    p_event_id, btrim(p_display_name), p_plays_as, p_primary_position, p_secondary_position,
    v_stars, v_super, true, v_primary_detail, v_secondary_detail
  ) returning * into v_guest;

  perform private.assert_no_position_detail_pending(p_event_id, jsonb_build_array(jsonb_build_object(
    'kind', 'guest', 'id', v_guest.id, 'plays_as', v_guest.plays_as,
    'main', v_guest.primary_position, 'main_detail', v_guest.primary_position_detail
  )));

  perform private.event_sort_place_player(
    p_event_id, null, v_guest.id, v_guest.plays_as, v_guest.stars,
    v_guest.is_super_star, v_guest.primary_position, v_guest.secondary_position,
    'inclusion'
  );

  return private.event_sort_published_json(p_event_id);
end $$;

-- Corpo de 20261003170000; as duas calls passam p_entry = return.
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

  return private.event_sort_published_json(p_event_id);
end $$;

-- Corpo de 20261003170000. Deixar o Racha é Saída própria, mesmo se for o Condutor.
create or replace function private.cleanup_member_attendance(p_racha_id uuid, p_profile_id uuid)
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

    if private.event_sort_confirmed(v_event_id) then
      perform private.event_sort_close_player(v_event_id, p_profile_id, null, true);
    end if;

    delete from public.event_attendance ea
    where ea.event_id = v_event_id and ea.profile_id = p_profile_id;

    if v_was_confirmed then
      perform private.promote_waitlist_for_event(v_event_id);
    end if;
  end loop;
end $$;

-- Corpo de 20261003240000. Depois do retrato: vazio sai; criado na Partida entra no fim.
create or replace function private.event_match_discard_open(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_ended timestamptz;
begin
  select * into v_match
  from public.event_match m
  where m.event_id = p_event_id and m.status = 'open'
  for update;
  if not found then
    return;
  end if;

  v_ended := now();
  update public.event_match m
  set status = 'discarded', ended_at = v_ended, paused_at = null
  where m.id = v_match.id;

  update public.event_match_lineup l
  set left_at = v_ended
  where l.match_id = v_match.id and l.left_at is null;

  update public.event_sort_team t
  set queue_order = null
  where t.event_id = p_event_id;

  update public.event_sort_team t
  set queue_order = (x ->> 'queue_order')::smallint,
      win_streak = coalesce((x ->> 'win_streak')::smallint, 0)
  from jsonb_array_elements(v_match.queue_before -> 'teams') x
  where t.id = (x ->> 'id')::uuid;

  -- Time sem linha ativa não volta, mesmo que estivesse no retrato
  update public.event_sort_team t
  set queue_order = null
  where t.event_id = p_event_id
    and not exists (
      select 1 from public.event_sort_team_player p
      where p.team_id = t.id and p.left_at is null
    );

  -- criado durante a Partida, ou arquivado no retrato, e agora tem linha: fim da fila
  update public.event_sort_team t
  set queue_order = 10000 + x.n
  from (
    select t2.id, row_number() over (order by t2.team_number)::integer as n
    from public.event_sort_team t2
    where t2.event_id = p_event_id
      and exists (
        select 1 from public.event_sort_team_player p
        where p.team_id = t2.id and p.left_at is null
      )
      and (
        not exists (
          select 1 from jsonb_array_elements(v_match.queue_before -> 'teams') z
          where (z ->> 'id')::uuid = t2.id
        )
        or exists (
          select 1 from jsonb_array_elements(v_match.queue_before -> 'teams') z
          where (z ->> 'id')::uuid = t2.id and z ->> 'queue_order' is null
        )
      )
  ) x
  where t.id = x.id;

  perform private.event_sort_compact_queue(p_event_id);

  update public.event_sort_goalkeeper k
  set team_id = null, queue_order = 10000 + r.n
  from (
    select x.id, row_number() over (order by x.id)::integer as n
    from public.event_sort_goalkeeper x
    where x.event_id = p_event_id
  ) r
  where k.id = r.id;

  update public.event_sort_goalkeeper k
  set team_id = (s ->> 'team_id')::uuid,
      queue_order = (s ->> 'queue_order')::smallint
  from jsonb_array_elements(v_match.queue_before -> 'goalkeepers') s
  where k.event_id = p_event_id
    and k.person_id = (s ->> 'person_id')::uuid;

  perform private.event_match_touch(v_match.id);
end $$;

-- Corpo de 20261003230000 + outfield_count, capacity e linha ativa (R6).
create or replace function private.event_match_side_json(p_match_id uuid, p_team_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'team_id', t.id,
    'team_number', t.team_number,
    'win_streak', t.win_streak,
    'score', (
      select count(*) from public.event_match_goal g
      where g.match_id = m.id and g.team_id = t.id
    ),
    'goalkeeper', (
      select private.event_match_person_json(l.profile_id, l.guest_id)
      from public.event_match_lineup l
      where l.match_id = m.id and l.team_id = t.id and l.role = 'GOALKEEPER'
        and (l.left_at is null or l.left_at = m.ended_at)
      order by l.entered_at desc, l.id
      limit 1
    ),
    'is_complete', (
      select count(*) from public.event_sort_team_player p
      where p.team_id = t.id and p.left_at is null
    ) = e.outfield_per_team,
    'outfield_count', (
      select count(*) from public.event_sort_team_player p
      where p.team_id = t.id and p.left_at is null
    ),
    'capacity', e.outfield_per_team,
    'lineup', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'team_id', l.team_id,
        'role', l.role,
        'person', private.event_match_person_json(l.profile_id, l.guest_id),
        'entered_at', l.entered_at,
        'left_at', l.left_at,
        'entry_kind', l.entry_kind,
        'left_by_self', l.left_by_self
      ) order by l.entered_at, l.id), '[]'::jsonb)
      from public.event_match_lineup l
      where l.match_id = m.id and l.team_id = t.id
        and l.role = 'OUTFIELD' and l.left_at is null
    )
  )
  from public.event_match m
  join public.event e on e.id = m.event_id
  join public.event_sort_team t on t.id = p_team_id
  where m.id = p_match_id;
$$;

-- Corpo de 20261003230000 + entry_kind e left_by_self no elenco completo.
create or replace function private.event_match_item_json(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m public.event_match;
begin
  select * into v_m from public.event_match m where m.id = p_match_id;
  return jsonb_build_object(
    'id', v_m.id,
    'number', v_m.number,
    'status', v_m.status,
    'home', private.event_match_side_json(v_m.id, v_m.home_team_id),
    'away', private.event_match_side_json(v_m.id, v_m.away_team_id),
    'challenger_team_id', v_m.challenger_team_id,
    'is_rematch', v_m.is_rematch,
    'started_at', v_m.started_at,
    'paused_at', v_m.paused_at,
    'paused_seconds', v_m.paused_seconds,
    'ended_at', v_m.ended_at,
    'winner_team_id', v_m.winner_team_id,
    'decided_by_penalties', v_m.decided_by_penalties,
    'seq', v_m.seq,
    'goals', private.event_match_goal_json(v_m.id),
    'lineup', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'team_id', l.team_id,
        'role', l.role,
        'person', private.event_match_person_json(l.profile_id, l.guest_id),
        'entered_at', l.entered_at,
        'left_at', l.left_at,
        'entry_kind', l.entry_kind,
        'left_by_self', l.left_by_self
      ) order by l.team_id, l.role desc, l.entered_at, l.id), '[]'::jsonb)
      from public.event_match_lineup l
      where l.match_id = v_m.id
    )
  );
end $$;

-- Últimos lances da Partida aberta. Empate de created_at: Reforço antes da Saída
-- do mesmo instante, para a folha R3 achar o lance no primeiro item.
create function private.event_match_events_json(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(e.obj order by e.created_at desc, e.rank, e.id desc), '[]'::jsonb)
  from (
    select g.id, g.created_at, 1 as rank, jsonb_build_object(
      'kind', 'goal',
      'id', g.id,
      'request_key', g.request_key,
      'team_id', g.team_id,
      'team_number', t.team_number,
      'is_own_goal', g.is_own_goal,
      'scorer', private.event_match_person_json(g.scorer_profile_id, g.scorer_guest_id),
      'assist', private.event_match_person_json(g.assist_profile_id, g.assist_guest_id),
      'conceded_goalkeeper', private.event_match_person_json(g.conceded_profile_id, g.conceded_guest_id),
      'created_at', g.created_at
    ) as obj
    from public.event_match_goal g
    join public.event_sort_team t on t.id = g.team_id
    where g.match_id = p_match_id

    union all

    select l.id, l.left_at, 2, jsonb_build_object(
      'kind', 'leave',
      'id', l.id,
      'person', private.event_match_person_json(l.profile_id, l.guest_id),
      'team_id', l.team_id,
      'team_number', t.team_number,
      'by_self', l.left_by_self,
      'reinforced', exists (
        select 1 from public.event_match_reinforcement r
        where r.match_id = l.match_id
          and (
            (l.profile_id is not null and r.left_profile_id = l.profile_id)
            or (l.guest_id is not null and r.left_guest_id = l.guest_id)
          )
      ),
      'outfield_count', (
        select count(*)::integer
        from public.event_match_lineup x
        where x.match_id = l.match_id and x.team_id = l.team_id and x.role = 'OUTFIELD'
          and (x.entered_at < l.left_at
            or (x.entered_at = l.left_at and x.entry_kind is distinct from 'reinforcement'))
          and (x.left_at is null or x.left_at > l.left_at)
      ),
      'capacity', e.outfield_per_team,
      'created_at', l.left_at
    )
    from public.event_match_lineup l
    join public.event_match m on m.id = l.match_id
    join public.event e on e.id = m.event_id
    join public.event_sort_team t on t.id = l.team_id
    where l.match_id = p_match_id
      and l.role = 'OUTFIELD'
      and l.left_at is not null
      and l.left_at >= m.started_at
      and l.team_id in (m.home_team_id, m.away_team_id)

    union all

    select r.id, r.created_at, 0, jsonb_build_object(
      'kind', 'reinforcement',
      'id', r.id,
      'entered', private.event_match_person_json(r.entered_profile_id, r.entered_guest_id),
      'left', private.event_match_person_json(r.left_profile_id, r.left_guest_id),
      'from_team_id', r.from_team_id,
      'from_team_number', ft.team_number,
      'to_team_id', r.to_team_id,
      'to_team_number', tt.team_number,
      'team_drawn', r.team_drawn,
      'created_at', r.created_at
    )
    from public.event_match_reinforcement r
    join public.event_sort_team ft on ft.id = r.from_team_id
    join public.event_sort_team tt on tt.id = r.to_team_id
    where r.match_id = p_match_id

    union all

    select l.id, l.entered_at, 1, jsonb_build_object(
      'kind', l.entry_kind,
      'id', l.id,
      'person', private.event_match_person_json(l.profile_id, l.guest_id),
      'team_id', l.team_id,
      'team_number', t.team_number,
      'created_at', l.entered_at
    )
    from public.event_match_lineup l
    join public.event_match m on m.id = l.match_id
    join public.event_sort_team t on t.id = l.team_id
    where l.match_id = p_match_id
      and l.role = 'OUTFIELD'
      and l.entry_kind in ('inclusion', 'return')
      and l.team_id in (m.home_team_id, m.away_team_id)
  ) e;
$$;

-- Corpo de 20261003230000 + donors, pending, events, next_arrival.
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

-- Corpo de 20261003190000 + next_arrival. state=none continua sem a chave.
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
    'next_arrival', private.event_sort_arrival_destination(p_event_id)
  );
end $$;

-- Corpo de 20261003230000; insert do substituto grava entry_kind = goalkeeper.
create or replace function public.swap_event_match_goalkeeper(
  p_match_id uuid,
  p_team_id uuid,
  p_goalkeeper uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_new public.event_sort_goalkeeper;
  v_active public.event_match_lineup;
begin
  v_match := private.lock_event_match(p_match_id);
  if v_match.status <> 'open' then
    raise exception 'no_open_match';
  end if;
  if p_team_id is null or p_team_id not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception 'invalid_team';
  end if;
  if p_goalkeeper is null then
    raise exception 'invalid_goalkeeper';
  end if;

  select * into v_active from public.event_match_lineup l
  where l.match_id = p_match_id and l.team_id = p_team_id
    and l.role = 'GOALKEEPER' and l.left_at is null;
  if found and v_active.person_id = p_goalkeeper then
    return private.event_match_json(v_match.event_id);
  end if;

  perform private.event_match_place_goalkeeper(v_match.event_id, p_team_id, p_goalkeeper);

  select * into v_new from public.event_sort_goalkeeper k
  where k.event_id = v_match.event_id and k.person_id = p_goalkeeper;

  update public.event_match_lineup l
  set left_at = now()
  where l.match_id = p_match_id and l.team_id = p_team_id
    and l.role = 'GOALKEEPER' and l.left_at is null;

  insert into public.event_match_lineup (
    event_id, match_id, team_id, profile_id, guest_id, role, entry_kind
  ) values (
    v_match.event_id, p_match_id, p_team_id, v_new.profile_id, v_new.guest_id,
    'GOALKEEPER', 'goalkeeper'
  );

  perform private.event_match_touch(p_match_id);
  return private.event_match_json(v_match.event_id);
end $$;

-- Uma operação: Saída (se ainda não houve), sorteio, mudança de Time, elenco e registro.
create function public.reinforce_event_match(
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
  perform private.event_match_touch(p_match_id);
  return private.event_match_json(v_match.event_id);
end $$;

revoke execute on function
  private.event_sort_close_player(uuid, uuid, uuid, boolean),
  private.event_sort_place_player(
    uuid, uuid, uuid, public.plays_as, smallint, boolean, public.position, public.position,
    public.event_match_lineup_entry_kind
  ),
  private.event_sort_arrival_destination(uuid),
  private.event_match_events_json(uuid),
  private.cleanup_member_attendance(uuid, uuid),
  private.event_match_discard_open(uuid)
from public, anon, authenticated;

revoke execute on function public.reinforce_event_match(uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.reinforce_event_match(uuid, uuid, uuid, uuid)
  to authenticated;
