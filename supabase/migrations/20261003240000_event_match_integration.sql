-- Partida e placar, etapa 4: integração com Saída, Inclusão, recálculo do gol,
-- encerramento do Evento, job das 12h e cartão da home.
-- Redefine as funções a partir do último corpo; só acrescenta o ramo da Partida.
-- Não edita o motor (event_match_engine / event_match_next_state).

-- Restore compartilhado: discard_event_match exige Condutor; o job das 12h não é.
-- Sem Partida aberta é no-op, para o job sempre poder chamar.
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

  -- estaciona a fila para a unique deferrable não bater no restore
  update public.event_sort_team t
  set queue_order = null
  where t.event_id = p_event_id;

  update public.event_sort_team t
  set queue_order = (x ->> 'queue_order')::smallint,
      win_streak = coalesce((x ->> 'win_streak')::smallint, 0)
  from jsonb_array_elements(v_match.queue_before -> 'teams') x
  where t.id = (x ->> 'id')::uuid;

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

create or replace function public.discard_event_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
begin
  v_match := private.lock_event_match(p_match_id);
  if v_match.status <> 'open' then
    raise exception 'no_open_match';
  end if;

  perform private.event_match_discard_open(v_match.event_id);
  return private.event_match_json(v_match.event_id);
end $$;

-- Cartão da home: um ponto só para as duas list_* não divergirem.
-- Sem Sorteio = none; Sorteio confirmado + open = open; confirmado sem open = between
-- (inclui antes da primeira Partida).
create or replace function private.event_match_list_fields(p_event_id uuid)
returns table (
  match_state text,
  match_home_score integer,
  match_away_score integer,
  next_home_team_number integer,
  next_away_team_number integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_home_n integer;
  v_away_n integer;
begin
  if not private.event_sort_confirmed(p_event_id) then
    match_state := 'none';
  elsif exists (
    select 1 from public.event_match m
    where m.event_id = p_event_id and m.status = 'open'
  ) then
    match_state := 'open';
  else
    match_state := 'between';
  end if;

  select * into v_match
  from public.event_match m
  where m.event_id = p_event_id and m.status = 'open';
  if not found then
    select * into v_match
    from public.event_match m
    where m.event_id = p_event_id and m.status = 'finished'
    order by m.number desc
    limit 1;
  end if;

  if v_match.id is not null then
    select count(*)::integer into match_home_score
    from public.event_match_goal g
    where g.match_id = v_match.id and g.team_id = v_match.home_team_id;
    select count(*)::integer into match_away_score
    from public.event_match_goal g
    where g.match_id = v_match.id and g.team_id = v_match.away_team_id;
  end if;

  select t.team_number into v_home_n
  from public.event_sort_team t
  where t.event_id = p_event_id and t.queue_order = 1;
  select t.team_number into v_away_n
  from public.event_sort_team t
  where t.event_id = p_event_id and t.queue_order = 2;
  if v_home_n is not null and v_away_n is not null then
    next_home_team_number := v_home_n;
    next_away_team_number := v_away_n;
  end if;

  return next;
end $$;

revoke execute on function
  private.event_match_discard_open(uuid),
  private.event_match_list_fields(uuid)
  from public, anon, authenticated;

-- Corpo de 20261003170000, com goleiros ativos da Partida aberta fixos.
-- Sem Partida aberta o plano é o mesmo: pinned vem vazio.
create or replace function private.event_sort_rebalance_goalkeepers(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teams integer;
  v_gks integer;
  v_per_team boolean;
  v_open_match uuid;
begin
  select m.id into v_open_match
  from public.event_match m
  where m.event_id = p_event_id and m.status = 'open';

  select count(*) into v_teams from public.event_sort_team t
  where t.event_id = p_event_id and t.queue_order is not null;
  select count(*) into v_gks from public.event_sort_goalkeeper k where k.event_id = p_event_id;
  v_per_team := v_gks >= v_teams;

  with pinned as (
    -- elenco ativo, e também team_id do confronto: no rodízio o Iniciar
    -- grava team_id no bind e pode não deixar linha GOALKEEPER
    select l.person_id
    from public.event_match_lineup l
    where l.match_id = v_open_match
      and l.role = 'GOALKEEPER' and l.left_at is null
    union
    select k.person_id
    from public.event_sort_goalkeeper k
    join public.event_match m on m.id = v_open_match
    where k.event_id = p_event_id
      and k.team_id in (m.home_team_id, m.away_team_id)
  ), gk as (
    select k.id, k.team_id, k.queue_order,
      p.person_id is not null as is_pinned,
      case
        when p.person_id is not null then -1
        when tm.queue_order is not null then 0
        when k.team_id is null then 1
        else 2
      end as grp,
      row_number() over (
        order by case
          when p.person_id is not null then -1
          when tm.queue_order is not null then 0
          when k.team_id is null then 1
          else 2
        end,
          tm.queue_order, k.queue_order, k.id
      ) as pos
    from public.event_sort_goalkeeper k
    left join public.event_sort_team tm on tm.id = k.team_id
    left join pinned p on p.person_id = k.person_id
    where k.event_id = p_event_id
  ), free_teams as (
    select tm.id, row_number() over (order by tm.queue_order) as n
    from public.event_sort_team tm
    where v_per_team and tm.event_id = p_event_id and tm.queue_order is not null
      and not exists (
        select 1 from gk
        where gk.team_id = tm.id and (gk.grp = 0 or gk.is_pinned)
      )
  ), loose as (
    select gk.id, row_number() over (order by gk.pos) as n
    from gk
    where not gk.is_pinned and not (v_per_team and gk.grp = 0)
  ), plan as (
    select gk.id, gk.team_id, gk.queue_order
    from gk where gk.is_pinned
    union all
    select gk.id, gk.team_id, null::smallint as queue_order
    from gk where not gk.is_pinned and v_per_team and gk.grp = 0
    union all
    select l.id, ft.id,
      case when ft.id is null then (l.n - (select count(*) from free_teams))::smallint end
    from loose l left join free_teams ft on ft.n = l.n
  )
  update public.event_sort_goalkeeper k set team_id = p.team_id, queue_order = p.queue_order
  from plan p where k.id = p.id;
end $$;

-- Corpo de 20261003170000. Com Partida aberta: fecha o elenco; goleiro puxa o
-- primeiro da fila do gol; Time em campo vazio não sai da fila até o apito.
create or replace function private.event_sort_close_player(p_event_id uuid, p_profile_id uuid, p_guest_id uuid)
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
begin
  select m.id, m.home_team_id, m.away_team_id
    into v_match_id, v_home, v_away
  from public.event_match m
  where m.event_id = p_event_id and m.status = 'open';

  if v_match_id is not null then
    select l.team_id, l.role into v_lineup_team, v_lineup_role
    from public.event_match_lineup l
    where l.match_id = v_match_id and l.person_id = v_person and l.left_at is null;

    if v_lineup_team is not null then
      update public.event_match_lineup l set left_at = now()
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
        event_id, match_id, team_id, profile_id, guest_id, role
      ) values (
        p_event_id, v_match_id, v_lineup_team, v_next.profile_id, v_next.guest_id, 'GOALKEEPER'
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
end $$;

-- Corpo de 20261003210000 (snapshots de position_detail). Com Partida aberta,
-- o incompleto escolhido não é queue_order 1 nem 2; sem incompleto depois, Time novo.
create or replace function private.event_sort_place_player(
  p_event_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_plays_as public.plays_as,
  p_stars smallint,
  p_super boolean,
  p_main public.position,
  p_sec public.position
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per_team smallint;
  v_team_id uuid;
  v_main_detail public.position_detail;
  v_sec_detail public.position_detail;
  v_match_open boolean;
begin
  if p_plays_as = 'GOALKEEPER' then
    insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id, guest_id)
    values (
      p_event_id,
      (select coalesce(max(k.queue_order), 0) + 1 from public.event_sort_goalkeeper k where k.event_id = p_event_id),
      p_profile_id, p_guest_id
    );
  else
    select e.outfield_per_team into v_per_team from public.event e where e.id = p_event_id;

    if p_profile_id is not null then
      select m.primary_position_detail, m.secondary_position_detail into v_main_detail, v_sec_detail
      from public.member m
      join public.event e on e.racha_id = m.racha_id
      where e.id = p_event_id and m.profile_id = p_profile_id;
    else
      select g.primary_position_detail, g.secondary_position_detail into v_main_detail, v_sec_detail
      from public.event_guest g where g.id = p_guest_id;
    end if;

    v_match_open := exists (
      select 1 from public.event_match m
      where m.event_id = p_event_id and m.status = 'open'
    );

    select t.id into v_team_id
    from public.event_sort_team t
    where t.event_id = p_event_id and t.queue_order is not null
      and (select count(*) from public.event_sort_team_player p
           where p.team_id = t.id and p.left_at is null) < v_per_team
      and (not v_match_open or t.queue_order not in (1, 2))
    order by t.queue_order
    limit 1;

    if v_team_id is null then
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
  end if;

  perform private.event_sort_rebalance_goalkeepers(p_event_id);
end $$;

-- Corpo de 20261003190000. Recusa com match_open depois da conferência de pagamento,
-- para payments_not_reviewed continuar o mesmo quando o Evento é pago.
create or replace function public.finish_event(p_event_id uuid, p_payments_reviewed boolean default false)
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

  perform 1 from public.racha r where r.id = v_event.racha_id for update;
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  if v_event.status is distinct from 'active' or v_event.conductor_id is distinct from v_uid then
    raise exception 'not_allowed';
  end if;

  if v_event.is_paid and not coalesce(p_payments_reviewed, false) then
    raise exception 'payments_not_reviewed';
  end if;

  if exists (
    select 1 from public.event_match m
    where m.event_id = p_event_id and m.status = 'open'
  ) then
    raise exception 'match_open';
  end if;

  update public.event e set
    status = 'finished',
    ended_at = now(),
    ended_by = v_uid,
    ended_by_system = false
  where e.id = p_event_id;

  perform private.settle_event_credits(p_event_id);

  perform private.create_next_recurring_event(
    v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, now()
  );
end $$;

-- Corpo de 20261003022422. No ramo active, descarta a Partida aberta na mesma
-- transação, antes de encerrar e apurar o Caixa uma vez.
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

drop function public.list_my_racha_events();

create function public.list_my_racha_events()
returns table (
  racha_id uuid,
  id uuid,
  status public.event_status,
  starts_on date,
  starts_at time,
  place text,
  confirmed_count integer,
  spot_limit smallint,
  my_status text,
  my_queue_position integer,
  sort_confirmed boolean,
  match_state text,
  match_home_score integer,
  match_away_score integer,
  next_home_team_number integer,
  next_away_team_number integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.racha_id, selected.id, selected.status, selected.starts_on,
    selected.starts_at, selected.place,
    private.event_occupancy(selected.id), selected.spot_limit,
    ea.status::text,
    case when ea.status = 'waitlisted'
      then private.my_waitlist_position(selected.id, m.profile_id)
      else null
    end,
    private.event_sort_confirmed(selected.id),
    card.match_state, card.match_home_score, card.match_away_score,
    card.next_home_team_number, card.next_away_team_number
  from public.member m
  join lateral (
    select e.id, e.status, e.starts_on, e.starts_at, e.place, e.spot_limit
    from public.event e
    where e.racha_id = m.racha_id
      and e.status in ('active'::public.event_status, 'upcoming'::public.event_status)
    order by case when e.status = 'active' then 0 else 1 end,
      e.starts_on, e.starts_at, e.id
    limit 1
  ) selected on true
  left join public.event_attendance ea
    on ea.event_id = selected.id and ea.profile_id = m.profile_id
  left join lateral private.event_match_list_fields(selected.id) card on true
  where m.profile_id = (select auth.uid())
    and m.is_active;
$$;

revoke execute on function public.list_my_racha_events() from public, anon;
grant execute on function public.list_my_racha_events() to authenticated;

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
  next_away_team_number integer
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
      e.spot_limit, e.payer_target, e.outfield_per_team, e.conductor_id, p.display_name,
      private.event_occupancy(e.id),
      ea.status::text,
      case when ea.status = 'waitlisted' then private.my_waitlist_position(e.id, v_uid) else null end,
      private.event_sort_confirmed(e.id),
      card.match_state, card.match_home_score, card.match_away_score,
      card.next_home_team_number, card.next_away_team_number
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
