-- Partida e placar, etapa 5: políticas RLS do canal privado e aviso na
-- Saída/Inclusão. RLS em realtime.messages já está ligada — a doc proíbe
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY (42501, aborta a migration).
-- private.event_match_notify já existe (etapa 3); o contrato não muda.

-- As políticas rodam como `authenticated` e precisam enxergar as funções. Elas vivem em
-- `realtime_policy` (fora de `exposed schemas` do PostgREST) para `private` continuar sem
-- USAGE para `authenticated`/`anon`: event_recurrence.sql vigia essa invariante.
create schema if not exists realtime_policy;
revoke all on schema realtime_policy from public, anon;
grant usage on schema realtime_policy to authenticated;

-- Helpers para as políticas e para os testes não simularem o join do Realtime.
-- realtime.topic() lê o GUC `realtime.topic` (conferido no banco local).
create or replace function realtime_policy.event_match_realtime_event_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select realtime.topic())
      ~ '^event:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then substring((select realtime.topic()) from 7)::uuid
    else null
  end;
$$;

-- my_racha_role já filtra is_active; não duplicar a regra de pertença.
create or replace function realtime_policy.event_match_can_watch(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select public.my_racha_role(e.racha_id) is not null
      from public.event e
      where e.id = p_event_id
    ),
    false
  );
$$;

create or replace function realtime_policy.event_match_can_track(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select e.conductor_id is not distinct from (select auth.uid())
      from public.event e
      where e.id = p_event_id
    ),
    false
  );
$$;

revoke execute on function
  realtime_policy.event_match_realtime_event_id(),
  realtime_policy.event_match_can_watch(uuid),
  realtime_policy.event_match_can_track(uuid)
  from public, anon;

grant execute on function
  realtime_policy.event_match_realtime_event_id(),
  realtime_policy.event_match_can_watch(uuid),
  realtime_policy.event_match_can_track(uuid)
  to authenticated;

drop policy if exists "event_match: membro assiste" on realtime.messages;
create policy "event_match: membro assiste"
on realtime.messages
for select
to authenticated
using (
  realtime_policy.event_match_can_watch(realtime_policy.event_match_realtime_event_id())
  and extension in ('broadcast', 'presence')
);

drop policy if exists "event_match: condutor publica presence" on realtime.messages;
create policy "event_match: condutor publica presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime_policy.event_match_can_track(realtime_policy.event_match_realtime_event_id())
  and extension = 'presence'
);

-- Corpo de 20261003240000 + touch quando há Partida aberta, para quem só
-- assiste pelo aviso não ficar com elenco velho. Sem Partida aberta, igual.
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

  if v_match_id is not null then
    perform private.event_match_touch(v_match_id);
  end if;
end $$;

-- Corpo de 20261003240000 (snapshots de position_detail + pula 1/2).
-- Touch no fim: goleiro também muda o elenco visível, então o aviso sobe nos dois ramos.
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

  perform private.event_match_touch(m.id)
  from public.event_match m
  where m.event_id = p_event_id and m.status = 'open';
end $$;
