-- Partida e placar, etapa 3: RPCs públicas, retrato de leitura, seq e aviso.
-- create or replace / if not exists: reaplicar no banco local é seguro (sem db:reset).
-- O motor privado (engine / next_state) não muda; o Iniciar grava o goleiro de cada
-- lado em team_id para o next_state da etapa 2 continuar lendo só por team_id.

-- ============================================================
-- Schema extra: revanche pendente + reforços do review da etapa 2
-- ============================================================

alter table public.event_match
  add column if not exists next_is_rematch boolean not null default false;

alter table public.event_match
  add column if not exists next_challenger_team_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_match_next_challenger_fk'
  ) then
    alter table public.event_match
      add constraint event_match_next_challenger_fk
      foreign key (next_challenger_team_id, event_id)
      references public.event_sort_team (id, event_id);
  end if;
end $$;

-- conceded_* só credita quem ainda estava no gol: linha fechada é quem já saiu.
create or replace function private.event_match_goal_fits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_home uuid;
  v_away uuid;
  v_other uuid;
  v_scorer uuid;
  v_assist uuid;
  v_conceded uuid;
begin
  select m.home_team_id, m.away_team_id into v_home, v_away
  from public.event_match m where m.id = new.match_id;
  if new.team_id not in (v_home, v_away) then
    raise exception 'invalid_team' using errcode = 'check_violation';
  end if;
  v_other := case when new.team_id = v_home then v_away else v_home end;

  -- BEFORE INSERT não vê coluna generated; coalesce espelha scorer_id/assist_id/conceded_*.
  v_scorer := coalesce(new.scorer_profile_id, new.scorer_guest_id);
  v_assist := coalesce(new.assist_profile_id, new.assist_guest_id);
  v_conceded := coalesce(new.conceded_profile_id, new.conceded_guest_id);

  if v_scorer is not null and not exists (
    select 1 from public.event_match_lineup l
    where l.match_id = new.match_id and l.team_id = new.team_id and l.person_id = v_scorer
  ) then
    raise exception 'invalid_scorer' using errcode = 'check_violation';
  end if;
  if v_assist is not null and not exists (
    select 1 from public.event_match_lineup l
    where l.match_id = new.match_id and l.team_id = new.team_id and l.person_id = v_assist
  ) then
    raise exception 'invalid_scorer' using errcode = 'check_violation';
  end if;
  -- INSERT: só o goleiro ainda no gol. UPDATE (troca de autoria depois do apito)
  -- revalida o conceded_* que já estava gravado, e aí o elenco já tem left_at.
  if v_conceded is not null and not exists (
    select 1 from public.event_match_lineup l
    where l.match_id = new.match_id and l.team_id = v_other and l.role = 'GOALKEEPER'
      and l.person_id = v_conceded
      and (l.left_at is null or TG_OP = 'UPDATE')
  ) then
    raise exception 'invalid_goalkeeper' using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke execute on function private.event_match_goal_fits() from public, anon, authenticated;

-- Time do elenco só pode ser um dos dois da Partida (não cabe em check de uma linha).
create or replace function private.event_match_lineup_fits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_home uuid;
  v_away uuid;
begin
  select m.home_team_id, m.away_team_id into v_home, v_away
  from public.event_match m where m.id = new.match_id;
  if new.team_id is distinct from v_home and new.team_id is distinct from v_away then
    raise exception 'invalid_team' using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke execute on function private.event_match_lineup_fits() from public, anon, authenticated;

drop trigger if exists event_match_lineup_fits on public.event_match_lineup;
create trigger event_match_lineup_fits
  before insert or update on public.event_match_lineup
  for each row execute function private.event_match_lineup_fits();

-- ============================================================
-- Helpers privados
-- ============================================================

-- Goleiros >= Times ativos: cada Time com o seu. Senão, rodízio pela fila (ADR 0032).
create or replace function private.event_match_per_team(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.event_sort_goalkeeper k where k.event_id = p_event_id)
    >= (select count(*) from public.event_sort_team t
        where t.event_id = p_event_id and t.queue_order is not null);
$$;

-- Quem defende cada Time agora: team_id no regime por Time; no rodízio, a posição
-- da fila do gol igual à do Time (1 defende o 1º, 2 o 2º).
create or replace function private.event_match_side_keepers(p_event_id uuid)
returns table (team_id uuid, profile_id uuid, guest_id uuid, person_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, k.profile_id, k.guest_id, k.person_id
  from public.event_sort_team t
  join public.event_sort_goalkeeper k on k.event_id = t.event_id and (
    case when private.event_match_per_team(t.event_id)
      then k.team_id = t.id
      else k.team_id is null and t.queue_order <= 2 and k.queue_order = t.queue_order
    end
  )
  where t.event_id = p_event_id and t.queue_order is not null;
$$;

create or replace function private.event_match_compact_goalkeeper_queue(p_event_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.event_sort_goalkeeper k set queue_order = r.n
  from (
    select x.id, row_number() over (order by x.queue_order, x.id)::smallint as n
    from public.event_sort_goalkeeper x
    where x.event_id = p_event_id and x.team_id is null
  ) r
  where k.id = r.id and k.queue_order is distinct from r.n;
$$;

-- O next_state da etapa 2 só lê goleiro por team_id. Sem isso, o rodízio (fila)
-- chegaria no motor com byTeam vazio e a fila inteira em queue.
create or replace function private.event_match_bind_side_keepers(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_sort_goalkeeper k
  set team_id = s.team_id, queue_order = null
  from private.event_match_side_keepers(p_event_id) s
  where k.event_id = p_event_id and k.person_id = s.person_id
    and k.team_id is distinct from s.team_id;
  perform private.event_match_compact_goalkeeper_queue(p_event_id);
end $$;

-- Correção / troca: o uuid é da fila do gol ou já é o deste Time. Quem saiu volta
-- ao fim da fila; Saída apaga a linha de event_sort_goalkeeper, então não recoloca.
create or replace function private.event_match_place_goalkeeper(
  p_event_id uuid,
  p_team_id uuid,
  p_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot smallint;
  v_new public.event_sort_goalkeeper;
  v_cur public.event_sort_goalkeeper;
  v_end smallint;
begin
  select t.queue_order into v_slot
  from public.event_sort_team t
  where t.id = p_team_id and t.event_id = p_event_id;
  if v_slot is null or v_slot > 2 then
    raise exception 'invalid_team';
  end if;

  select * into v_new from public.event_sort_goalkeeper k
  where k.event_id = p_event_id and k.person_id = p_person_id;
  if not found then
    raise exception 'invalid_goalkeeper';
  end if;

  -- team_id ganha da posição da fila: depois do bind, a sobra continua com
  -- queue_order 1 e o Time 1 também é 1 — não são a mesma pessoa.
  select * into v_cur from public.event_sort_goalkeeper k
  where k.event_id = p_event_id and k.team_id = p_team_id;
  if not found then
    select * into v_cur from public.event_sort_goalkeeper k
    where k.event_id = p_event_id
      and k.team_id is null and k.queue_order = v_slot;
  end if;

  if v_cur.id is not null and v_cur.id = v_new.id then
    if v_new.team_id is distinct from p_team_id then
      update public.event_sort_goalkeeper k
      set team_id = p_team_id, queue_order = null
      where k.id = v_new.id;
      perform private.event_match_compact_goalkeeper_queue(p_event_id);
    end if;
    return;
  end if;

  -- fila do gol = sem Time; o goleiro do outro lado não entra
  if v_new.team_id is not null then
    raise exception 'invalid_goalkeeper';
  end if;

  select coalesce(max(k.queue_order), 0) + 1 into v_end
  from public.event_sort_goalkeeper k
  where k.event_id = p_event_id and k.team_id is null;

  if v_cur.id is not null then
    update public.event_sort_goalkeeper k
    set team_id = null, queue_order = v_end
    where k.id = v_cur.id;
  end if;

  update public.event_sort_goalkeeper k
  set team_id = p_team_id, queue_order = null
  where k.id = v_new.id;

  perform private.event_match_compact_goalkeeper_queue(p_event_id);
end $$;

create or replace function private.lock_event_match(p_match_id uuid)
returns public.event_match
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_event public.event;
  v_match public.event_match;
begin
  select m.event_id into v_event_id from public.event_match m where m.id = p_match_id;
  if not found then
    raise exception 'not_allowed';
  end if;
  v_event := private.lock_event_for_attendance(v_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);
  select * into v_match from public.event_match m where m.id = p_match_id for update;
  return v_match;
end $$;

-- Aviso, não dado: só o seq. Políticas em realtime.messages ficam na etapa 5.
create or replace function private.event_match_notify(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq bigint;
begin
  select coalesce(max(m.seq), 0) into v_seq
  from public.event_match m where m.event_id = p_event_id;
  perform realtime.send(
    jsonb_build_object('seq', v_seq),
    'match_changed',
    'event:' || p_event_id::text,
    true
  );
end $$;

create or replace function private.event_match_touch(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  update public.event_match m
  set seq = nextval('private.event_match_seq')
  where m.id = p_match_id
  returning m.event_id into v_event_id;
  perform private.event_match_notify(v_event_id);
end $$;

create or replace function private.event_match_person_json(p_profile_id uuid, p_guest_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_profile_id is not null then (
      select jsonb_build_object(
        'kind', 'member',
        'person_id', pr.id,
        'profile_id', pr.id,
        'guest_id', null,
        'display_name', pr.display_name,
        'avatar_path', pr.avatar_path
      )
      from public.profile pr where pr.id = p_profile_id
    )
    when p_guest_id is not null then (
      select jsonb_build_object(
        'kind', 'guest',
        'person_id', g.id,
        'profile_id', null,
        'guest_id', g.id,
        'display_name', g.display_name,
        'avatar_path', null
      )
      from public.event_guest g where g.id = p_guest_id
    )
  end;
$$;

create or replace function private.event_match_goal_json(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'request_key', g.request_key,
    'team_id', g.team_id,
    'team_number', t.team_number,
    'is_own_goal', g.is_own_goal,
    'scorer', private.event_match_person_json(g.scorer_profile_id, g.scorer_guest_id),
    'assist', private.event_match_person_json(g.assist_profile_id, g.assist_guest_id),
    'conceded_goalkeeper', private.event_match_person_json(g.conceded_profile_id, g.conceded_guest_id),
    'created_at', g.created_at
  ) order by g.created_at, g.id), '[]'::jsonb)
  from public.event_match_goal g
  join public.event_sort_team t on t.id = g.team_id
  where g.match_id = p_match_id;
$$;

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
    -- aberto: o ativo; encerrada: quem estava no gol no apito (left_at = ended_at)
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
    ) = e.outfield_per_team
  )
  from public.event_match m
  join public.event e on e.id = m.event_id
  join public.event_sort_team t on t.id = p_team_id
  where m.id = p_match_id;
$$;

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
        'left_at', l.left_at
      ) order by l.team_id, l.role desc, l.entered_at, l.id), '[]'::jsonb)
      from public.event_match_lineup l
      where l.match_id = v_m.id
    )
  );
end $$;

create or replace function private.event_match_next_side_json(p_event_id uuid, p_team_id uuid)
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
    'goalkeeper', (
      select private.event_match_person_json(s.profile_id, s.guest_id)
      from private.event_match_side_keepers(p_event_id) s
      where s.team_id = t.id
    ),
    'is_complete', (
      select count(*) from public.event_sort_team_player p
      where p.team_id = t.id and p.left_at is null
    ) = e.outfield_per_team
  )
  from public.event_sort_team t
  join public.event e on e.id = t.event_id
  where t.id = p_team_id;
$$;

create or replace function private.event_match_teams_queue_json(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'team_id', t.id,
    'team_number', t.team_number,
    'queue_order', t.queue_order,
    'win_streak', t.win_streak,
    'is_complete', (
      select count(*) from public.event_sort_team_player p
      where p.team_id = t.id and p.left_at is null
    ) = e.outfield_per_team
  ) order by t.queue_order), '[]'::jsonb)
  from public.event_sort_team t
  join public.event e on e.id = t.event_id
  where t.event_id = p_event_id and t.queue_order is not null;
$$;

create or replace function private.event_match_goalkeeper_queue_json(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'person', private.event_match_person_json(k.profile_id, k.guest_id),
    'queue_order', k.queue_order
  ) order by k.queue_order, k.id), '[]'::jsonb)
  from public.event_sort_goalkeeper k
  where k.event_id = p_event_id and k.team_id is null;
$$;

-- Retrato do momento. seq: da aberta, senão da última, senão 0.
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
    )
  );
end $$;

create or replace function private.event_match_queue_before_json(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'queue_order', t.queue_order, 'win_streak', t.win_streak
      ) order by t.team_number), '[]'::jsonb)
      from public.event_sort_team t where t.event_id = p_event_id
    ),
    'goalkeepers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'person_id', k.person_id, 'team_id', k.team_id, 'queue_order', k.queue_order
      ) order by k.id), '[]'::jsonb)
      from public.event_sort_goalkeeper k where k.event_id = p_event_id
    )
  );
$$;

-- Aplica o jsonb do motor nas filas. Time sem linha ativa sai depois do apito
-- (compacta como o Sorteio). Goleiro vai para team_id — o next_state da etapa 2
-- só enxerga atribuição por Time.
create or replace function private.event_match_apply_next_state(
  p_event_id uuid,
  p_out jsonb,
  p_removed uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_queue uuid[];
  v_final uuid[];
  v_plan jsonb := '[]'::jsonb;
  v_wait uuid[] := '{}';
  v_seen uuid[] := '{}';
  v_person uuid;
  v_team uuid;
  i integer;
begin
  select coalesce(array_agg(e.x::uuid order by e.o), '{}') into v_queue
  from jsonb_array_elements_text(p_out -> 'queue') with ordinality as e(x, o);

  select coalesce(array_agg(q order by o), '{}') into v_final
  from unnest(v_queue) with ordinality as u(q, o)
  where not q = any(p_removed);

  update public.event_sort_team t
  set queue_order = null, win_streak = 0
  where t.id = any(p_removed);

  update public.event_sort_team t
  set queue_order = f.n::smallint,
      win_streak = coalesce((p_out -> 'winStreaks' ->> t.id::text)::smallint, 0)
  from unnest(v_final) with ordinality as f(id, n)
  where t.id = f.id;

  for v_team, v_person in
    select b.key::uuid, (b.value #>> '{}')::uuid
    from jsonb_each(p_out -> 'goalkeepers' -> 'byTeam') b
    where b.value <> 'null'::jsonb
  loop
    if v_team = any(v_final) then
      v_plan := v_plan || jsonb_build_array(jsonb_build_object(
        'person_id', v_person, 'team_id', v_team, 'queue_order', null
      ));
      v_seen := v_seen || v_person;
    else
      v_wait := v_wait || v_person;
    end if;
  end loop;

  for v_person in
    select e.x::uuid
    from jsonb_array_elements_text(coalesce(p_out #> '{goalkeepers,queue}', '[]'::jsonb))
      with ordinality as e(x, o)
    order by e.o
  loop
    v_wait := v_wait || v_person;
  end loop;

  for i in 1 .. coalesce(cardinality(v_wait), 0) loop
    if v_wait[i] is not null and not v_wait[i] = any(v_seen) then
      v_plan := v_plan || jsonb_build_array(jsonb_build_object(
        'person_id', v_wait[i],
        'team_id', null,
        'queue_order', (
          select coalesce(max((x ->> 'queue_order')::smallint), 0) + 1
          from jsonb_array_elements(v_plan) x
          where x ->> 'queue_order' is not null
        )
      ));
      v_seen := v_seen || v_wait[i];
    end if;
  end loop;

  update public.event_sort_goalkeeper k
  set team_id = (p ->> 'team_id')::uuid,
      queue_order = (p ->> 'queue_order')::smallint
  from jsonb_array_elements(v_plan) p
  where k.event_id = p_event_id and k.person_id = (p ->> 'person_id')::uuid;
end $$;

-- ============================================================
-- RPCs públicas
-- ============================================================

create or replace function public.get_event_match(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found or public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_allowed';
  end if;
  return private.event_match_json(p_event_id);
end $$;

create or replace function public.start_event_match(
  p_event_id uuid,
  p_home_goalkeeper uuid default null,
  p_away_goalkeeper uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_t1 public.event_sort_team;
  v_t2 public.event_sort_team;
  v_last public.event_match;
  v_challenger uuid;
  v_rematch boolean := false;
  v_before jsonb;
  v_match_id uuid;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

  if exists (
    select 1 from public.event_match m
    where m.event_id = p_event_id and m.status = 'open'
  ) then
    raise exception 'match_open';
  end if;

  select * into v_t1 from public.event_sort_team t
  where t.event_id = p_event_id and t.queue_order = 1;
  select * into v_t2 from public.event_sort_team t
  where t.event_id = p_event_id and t.queue_order = 2;
  if v_t1.id is null or v_t2.id is null then
    raise exception 'not_enough_teams';
  end if;

  -- descarte restaura isto; correção do Condutor vem depois
  v_before := private.event_match_queue_before_json(p_event_id);

  if p_home_goalkeeper is not null then
    perform private.event_match_place_goalkeeper(p_event_id, v_t1.id, p_home_goalkeeper);
  end if;
  if p_away_goalkeeper is not null then
    perform private.event_match_place_goalkeeper(p_event_id, v_t2.id, p_away_goalkeeper);
  end if;

  perform private.event_match_bind_side_keepers(p_event_id);

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

  insert into public.event_match (
    event_id, number, home_team_id, away_team_id, challenger_team_id, is_rematch,
    queue_before, started_by
  ) values (
    p_event_id,
    (select coalesce(max(m.number), 0) + 1 from public.event_match m where m.event_id = p_event_id),
    v_t1.id, v_t2.id, v_challenger, v_rematch, v_before, (select auth.uid())
  ) returning id into v_match_id;

  insert into public.event_match_lineup (event_id, match_id, team_id, profile_id, guest_id, role)
  select p_event_id, v_match_id, p.team_id, p.profile_id, p.guest_id, 'OUTFIELD'
  from public.event_sort_team_player p
  where p.team_id in (v_t1.id, v_t2.id) and p.left_at is null;

  insert into public.event_match_lineup (event_id, match_id, team_id, profile_id, guest_id, role)
  select p_event_id, v_match_id, s.team_id, s.profile_id, s.guest_id, 'GOALKEEPER'
  from private.event_match_side_keepers(p_event_id) s
  where s.team_id in (v_t1.id, v_t2.id);

  perform private.event_match_touch(v_match_id);
  return private.event_match_json(p_event_id);
end $$;

create or replace function public.pause_event_match(p_match_id uuid)
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
  -- idempotente: segunda pausa não soma seq
  if v_match.paused_at is null then
    update public.event_match m set paused_at = now() where m.id = p_match_id;
    perform private.event_match_touch(p_match_id);
  end if;
  return private.event_match_json(v_match.event_id);
end $$;

create or replace function public.resume_event_match(p_match_id uuid)
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
  if v_match.paused_at is not null then
    update public.event_match m set
      paused_seconds = m.paused_seconds
        + round(extract(epoch from now() - m.paused_at))::integer,
      paused_at = null
    where m.id = p_match_id;
    perform private.event_match_touch(p_match_id);
  end if;
  return private.event_match_json(v_match.event_id);
end $$;

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
begin
  v_match := private.lock_event_match(p_match_id);

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

-- Autoria: aberta, ou finished com Evento active (a trava já recusa o resto).
create or replace function public.update_event_match_goal(
  p_goal_id uuid,
  p_scorer uuid,
  p_assist uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal public.event_match_goal;
  v_match public.event_match;
  v_scorer public.event_match_lineup;
  v_assist public.event_match_lineup;
begin
  select * into v_goal from public.event_match_goal g where g.id = p_goal_id;
  if not found then
    raise exception 'not_allowed';
  end if;
  v_match := private.lock_event_match(v_goal.match_id);
  if v_match.status = 'discarded' then
    raise exception 'no_open_match';
  end if;
  select * into v_goal from public.event_match_goal g where g.id = p_goal_id;
  if not found then
    raise exception 'not_allowed';
  end if;
  if v_goal.is_own_goal then
    raise exception 'invalid_scorer';
  end if;

  -- elenco inteiro: depois do apito todo mundo já tem left_at
  select * into v_scorer from public.event_match_lineup l
  where l.match_id = v_goal.match_id and l.team_id = v_goal.team_id and l.person_id = p_scorer
  order by l.entered_at
  limit 1;
  if p_scorer is null or not found then
    raise exception 'invalid_scorer';
  end if;
  if p_assist is not null then
    select * into v_assist from public.event_match_lineup l
    where l.match_id = v_goal.match_id and l.team_id = v_goal.team_id and l.person_id = p_assist
    order by l.entered_at
    limit 1;
    if not found or p_assist = p_scorer then
      raise exception 'invalid_scorer';
    end if;
  end if;

  update public.event_match_goal g set
    scorer_profile_id = v_scorer.profile_id,
    scorer_guest_id = v_scorer.guest_id,
    assist_profile_id = v_assist.profile_id,
    assist_guest_id = v_assist.guest_id
  where g.id = p_goal_id;

  perform private.event_match_touch(v_goal.match_id);
  return private.event_match_json(v_match.event_id);
end $$;

create or replace function public.delete_event_match_goal(p_goal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal public.event_match_goal;
  v_match public.event_match;
begin
  select * into v_goal from public.event_match_goal g where g.id = p_goal_id;
  if not found then
    raise exception 'not_allowed';
  end if;
  v_match := private.lock_event_match(v_goal.match_id);
  if v_match.status = 'finished' then
    raise exception 'match_locked';
  end if;
  if v_match.status <> 'open' then
    raise exception 'no_open_match';
  end if;
  delete from public.event_match_goal g where g.id = p_goal_id;
  perform private.event_match_touch(v_goal.match_id);
  return private.event_match_json(v_match.event_id);
end $$;

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

  insert into public.event_match_lineup (event_id, match_id, team_id, profile_id, guest_id, role)
  values (v_match.event_id, p_match_id, p_team_id, v_new.profile_id, v_new.guest_id, 'GOALKEEPER');

  perform private.event_match_touch(p_match_id);
  return private.event_match_json(v_match.event_id);
end $$;

create or replace function public.preview_finish_event_match(
  p_match_id uuid,
  p_penalty_winner uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_out jsonb;
begin
  v_match := private.lock_event_match(p_match_id);
  if v_match.status <> 'open' then
    raise exception 'no_open_match';
  end if;
  -- semente nula: produção deixa o banco sortear (tieReturnOrder RANDOM)
  v_out := private.event_match_next_state(p_match_id, p_penalty_winner, null);
  return jsonb_build_object(
    'match_id', p_match_id,
    'score', jsonb_build_object(
      'home', (select count(*) from public.event_match_goal g
        where g.match_id = p_match_id and g.team_id = v_match.home_team_id),
      'away', (select count(*) from public.event_match_goal g
        where g.match_id = p_match_id and g.team_id = v_match.away_team_id)
    ),
    'winner_team_id', (v_out ->> 'winnerId')::uuid,
    'decided_by_penalties', (v_out ->> 'decidedByPenalties')::boolean,
    'consequence', v_out ->> 'consequence',
    'fallback', v_out ->> 'fallback',
    'next_is_rematch', (v_out #>> '{next,isRematch}')::boolean,
    'next_challenger_team_id', (v_out #>> '{next,challengerId}')::uuid
  );
end $$;

create or replace function public.finish_event_match(
  p_match_id uuid,
  p_penalty_winner uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_out jsonb;
  v_ended timestamptz;
  v_removed uuid[];
begin
  v_match := private.lock_event_match(p_match_id);
  if v_match.status <> 'open' then
    raise exception 'no_open_match';
  end if;

  v_out := private.event_match_next_state(p_match_id, p_penalty_winner, null);
  v_ended := now();

  update public.event_match m set
    status = 'finished',
    ended_at = v_ended,
    winner_team_id = (v_out ->> 'winnerId')::uuid,
    decided_by_penalties = coalesce((v_out ->> 'decidedByPenalties')::boolean, false),
    next_challenger_team_id = (v_out #>> '{next,challengerId}')::uuid,
    next_is_rematch = coalesce((v_out #>> '{next,isRematch}')::boolean, false),
    paused_seconds = m.paused_seconds
      + case
          when m.paused_at is not null
            then round(extract(epoch from v_ended - m.paused_at))::integer
          else 0
        end,
    paused_at = null
  where m.id = p_match_id;

  -- Vitória = left_at igual ao ended_at; quem saiu no meio tem left_at anterior
  update public.event_match_lineup l
  set left_at = v_ended
  where l.match_id = p_match_id and l.left_at is null;

  select coalesce(array_agg(t.id), '{}') into v_removed
  from public.event_sort_team t
  where t.id in (v_match.home_team_id, v_match.away_team_id)
    and not exists (
      select 1 from public.event_sort_team_player p
      where p.team_id = t.id and p.left_at is null
    );

  perform private.event_match_apply_next_state(v_match.event_id, v_out, v_removed);
  perform private.event_match_touch(p_match_id);
  return private.event_match_json(v_match.event_id);
end $$;

create or replace function public.discard_event_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_ended timestamptz;
begin
  v_match := private.lock_event_match(p_match_id);
  if v_match.status <> 'open' then
    raise exception 'no_open_match';
  end if;

  v_ended := now();
  update public.event_match m
  set status = 'discarded', ended_at = v_ended, paused_at = null
  where m.id = p_match_id;

  update public.event_match_lineup l
  set left_at = v_ended
  where l.match_id = p_match_id and l.left_at is null;

  -- estaciona a fila para a unique deferrable não bater no restore
  update public.event_sort_team t
  set queue_order = null
  where t.event_id = v_match.event_id;

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
    where x.event_id = v_match.event_id
  ) r
  where k.id = r.id;

  update public.event_sort_goalkeeper k
  set team_id = (s ->> 'team_id')::uuid,
      queue_order = (s ->> 'queue_order')::smallint
  from jsonb_array_elements(v_match.queue_before -> 'goalkeepers') s
  where k.event_id = v_match.event_id
    and k.person_id = (s ->> 'person_id')::uuid;

  perform private.event_match_touch(p_match_id);
  return private.event_match_json(v_match.event_id);
end $$;

revoke execute on function
  private.event_match_goal_fits(),
  private.event_match_lineup_fits(),
  private.event_match_per_team(uuid),
  private.event_match_side_keepers(uuid),
  private.event_match_compact_goalkeeper_queue(uuid),
  private.event_match_bind_side_keepers(uuid),
  private.event_match_place_goalkeeper(uuid, uuid, uuid),
  private.lock_event_match(uuid),
  private.event_match_notify(uuid),
  private.event_match_touch(uuid),
  private.event_match_person_json(uuid, uuid),
  private.event_match_goal_json(uuid),
  private.event_match_side_json(uuid, uuid),
  private.event_match_item_json(uuid),
  private.event_match_next_side_json(uuid, uuid),
  private.event_match_teams_queue_json(uuid),
  private.event_match_goalkeeper_queue_json(uuid),
  private.event_match_json(uuid),
  private.event_match_queue_before_json(uuid),
  private.event_match_apply_next_state(uuid, jsonb, uuid[])
  from public, anon, authenticated;

revoke execute on function
  public.get_event_match(uuid),
  public.start_event_match(uuid, uuid, uuid),
  public.pause_event_match(uuid),
  public.resume_event_match(uuid),
  public.add_event_match_goal(uuid, text, uuid, uuid, uuid, boolean),
  public.update_event_match_goal(uuid, uuid, uuid),
  public.delete_event_match_goal(uuid),
  public.swap_event_match_goalkeeper(uuid, uuid, uuid),
  public.preview_finish_event_match(uuid, uuid),
  public.finish_event_match(uuid, uuid),
  public.discard_event_match(uuid)
  from public, anon;

grant execute on function
  public.get_event_match(uuid),
  public.start_event_match(uuid, uuid, uuid),
  public.pause_event_match(uuid),
  public.resume_event_match(uuid),
  public.add_event_match_goal(uuid, text, uuid, uuid, uuid, boolean),
  public.update_event_match_goal(uuid, uuid, uuid),
  public.delete_event_match_goal(uuid),
  public.swap_event_match_goalkeeper(uuid, uuid, uuid),
  public.preview_finish_event_match(uuid, uuid),
  public.finish_event_match(uuid, uuid),
  public.discard_event_match(uuid)
  to authenticated;
