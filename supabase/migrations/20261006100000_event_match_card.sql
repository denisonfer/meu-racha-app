-- Cartões, etapa 1: registro, segundo amarelo, saída por vermelho e leitura.
-- Funções redefinidas partem da última migration citada no comentário de cada uma.
-- Vermelho não é Saída: a pessoa continua no Time e no Evento.

create type public.event_match_card_color as enum ('yellow', 'red');
create type public.event_match_card_red_reason as enum ('direct', 'second_yellow');

alter table public.event_match_lineup
  add column left_by_red boolean not null default false;

-- O amarelo antigo permanece quando o segundo vira vermelho. Unique (id, event_id)
-- segue o padrão das tabelas da Partida que entram em FK composta.
create table public.event_match_card (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  match_id uuid not null,
  team_id uuid not null,
  profile_id uuid references public.profile (id),
  guest_id uuid references public.event_guest (id),
  person_id uuid generated always as (coalesce(profile_id, guest_id)) stored,
  is_goalkeeper boolean not null,
  color public.event_match_card_color not null,
  red_reason public.event_match_card_red_reason,
  match_second integer not null check (match_second >= 0),
  created_by uuid not null references public.profile (id),
  created_at timestamptz not null default now(),
  unique (id, event_id),
  constraint event_match_card_match_fk foreign key (match_id, event_id)
    references public.event_match (id, event_id) on delete cascade,
  constraint event_match_card_team_fk foreign key (team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_match_card_person_xor check ((profile_id is null) <> (guest_id is null)),
  constraint event_match_card_red_reason_shape check (
    (color = 'yellow' and red_reason is null)
    or (color = 'red' and red_reason is not null)
  )
);

create index event_match_card_match on public.event_match_card (match_id);

alter table public.event_match_card enable row level security;
revoke all on public.event_match_card from public, anon, authenticated;

-- Segundos já jogados, pausas fora. O cartão grava este número para o aparelho
-- contar o resto no relógio que já mostra. now() é o instante da transação.
create function private.event_match_second(p_match_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_elapsed integer;
begin
  select * into v_match from public.event_match m where m.id = p_match_id;
  if not found then
    return 0;
  end if;
  v_elapsed :=
    floor(extract(epoch from now() - v_match.started_at))::integer
    - v_match.paused_seconds
    - case
        when v_match.paused_at is not null
          then floor(extract(epoch from now() - v_match.paused_at))::integer
        else 0
      end;
  if v_elapsed < 0 then
    return 0;
  end if;
  return v_elapsed;
end $$;

-- Segundo amarelo na mesma Partida vira vermelho. Vermelho só fecha a linha
-- do elenco desta Partida; não chama a Saída do Evento.
create function public.add_event_match_card(
  p_match_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_color public.event_match_card_color
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_line public.event_match_lineup;
  v_color public.event_match_card_color;
  v_reason public.event_match_card_red_reason;
  v_second integer;
begin
  v_match := private.lock_event_match(p_match_id);
  if v_match.status <> 'open' then
    raise exception 'no_open_match';
  end if;
  if p_color is null or (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;

  select * into v_line from public.event_match_lineup l
  where l.match_id = p_match_id
    and l.left_at is null
    and l.team_id in (v_match.home_team_id, v_match.away_team_id)
    and (
      (p_profile_id is not null and l.profile_id = p_profile_id)
      or (p_guest_id is not null and l.guest_id = p_guest_id)
    );
  if not found then
    raise exception 'not_on_field';
  end if;

  v_second := private.event_match_second(p_match_id);
  v_color := p_color;
  v_reason := case
    when p_color = 'red' then 'direct'::public.event_match_card_red_reason
    else null
  end;
  -- Qualquer amarelo anterior nesta Partida, mesmo já cumprido, vira o novo em vermelho.
  if p_color = 'yellow' and exists (
    select 1 from public.event_match_card c
    where c.match_id = p_match_id
      and c.person_id = v_line.person_id
      and c.color = 'yellow'
  ) then
    v_color := 'red';
    v_reason := 'second_yellow';
  end if;

  if v_color = 'red' then
    update public.event_match_lineup l
    set left_at = now(), left_by_red = true
    where l.id = v_line.id;
  end if;

  insert into public.event_match_card (
    event_id, match_id, team_id, profile_id, guest_id,
    is_goalkeeper, color, red_reason, match_second, created_by
  ) values (
    v_match.event_id, p_match_id, v_line.team_id,
    v_line.profile_id, v_line.guest_id,
    v_line.role = 'GOALKEEPER', v_color, v_reason, v_second,
    (select auth.uid())
  );

  perform private.event_match_touch(p_match_id);
  return private.event_match_json(v_match.event_id);
end $$;

-- Apagar o vermelho devolve a linha que ele fechou. Se outro goleiro ficou
-- ativo depois (Trocar goleiro), a unique do elenco falha e nada é gravado.
create function public.delete_event_match_card(p_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.event_match_card;
  v_match public.event_match;
  v_line_id uuid;
begin
  select * into v_card from public.event_match_card c where c.id = p_card_id;
  if not found then
    raise exception 'not_allowed';
  end if;
  v_match := private.lock_event_match(v_card.match_id);
  select * into v_card from public.event_match_card c where c.id = p_card_id;
  if not found then
    raise exception 'not_allowed';
  end if;
  if v_match.status = 'finished' then
    raise exception 'match_locked';
  end if;
  if v_match.status <> 'open' then
    raise exception 'no_open_match';
  end if;

  delete from public.event_match_card c where c.id = p_card_id;

  if v_card.color = 'red' and not exists (
    select 1 from public.event_match_lineup l
    where l.match_id = v_card.match_id
      and l.person_id = v_card.person_id
      and l.left_at is null
  ) then
    select x.id into v_line_id
    from public.event_match_lineup x
    where x.match_id = v_card.match_id
      and x.person_id = v_card.person_id
      and x.left_by_red
    order by x.left_at desc nulls last, x.id desc
    limit 1;

    update public.event_match_lineup l
    set left_at = null, left_by_red = false
    where l.id = v_line_id;
  end if;

  perform private.event_match_touch(v_card.match_id);
  return private.event_match_json(v_match.event_id);
end $$;

-- Corpo de 20261003230000. Goleiro com amarelo correndo não leva o gol sofrido.
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
  v_keeper := found;

  -- 120 s de relógio da Partida. No instante exato o amarelo já acabou.
  -- IF aninhado: sem goleiro ativo o registro nem foi preenchido.
  if v_keeper then
    if exists (
      select 1 from public.event_match_card c
      where c.match_id = p_match_id
        and c.person_id = v_conceded.person_id
        and c.color = 'yellow'
        and c.match_second + 120 > private.event_match_second(p_match_id)
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

-- Corpo de 20261005100000. Descarte não apaga a Partida; o cartão sai aqui.
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

  delete from public.event_match_card c where c.match_id = v_match.id;

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

-- Corpo de 20261005100000. left_by_red no elenco; a lateral ativa continua left_at nulo.
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
        'left_by_self', l.left_by_self,
        'left_by_red', l.left_by_red
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

-- Corpo de 20261005100000. cards na Partida; left_by_red no elenco completo.
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
    'cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'person', private.event_match_person_json(c.profile_id, c.guest_id),
        'team_id', c.team_id,
        'is_goalkeeper', c.is_goalkeeper,
        'color', c.color,
        'red_reason', c.red_reason,
        'match_second', c.match_second,
        'created_at', c.created_at
      ) order by c.created_at, c.id), '[]'::jsonb)
      from public.event_match_card c
      where c.match_id = v_m.id
    ),
    'lineup', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'team_id', l.team_id,
        'role', l.role,
        'person', private.event_match_person_json(l.profile_id, l.guest_id),
        'entered_at', l.entered_at,
        'left_at', l.left_at,
        'entry_kind', l.entry_kind,
        'left_by_self', l.left_by_self,
        'left_by_red', l.left_by_red
      ) order by l.team_id, l.role desc, l.entered_at, l.id), '[]'::jsonb)
      from public.event_match_lineup l
      where l.match_id = v_m.id
    )
  );
end $$;

-- Corpo de 20261005100000. Lance de cartão entra; saída por vermelho fica de fora.
-- Empate de created_at: Reforço (rank 0) antes de gol e cartão (rank 1).
create or replace function private.event_match_events_json(p_match_id uuid)
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
      and not l.left_by_red

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

    union all

    select c.id, c.created_at, 1, jsonb_build_object(
      'kind', 'card',
      'id', c.id,
      'person', private.event_match_person_json(c.profile_id, c.guest_id),
      'team_id', c.team_id,
      'team_number', t.team_number,
      'is_goalkeeper', c.is_goalkeeper,
      'color', c.color,
      'red_reason', c.red_reason,
      'match_second', c.match_second,
      'created_at', c.created_at
    )
    from public.event_match_card c
    join public.event_sort_team t on t.id = c.team_id
    where c.match_id = p_match_id
  ) e;
$$;

-- Corpo de 20261005100000. Reforço pendente ignora quem saiu por vermelho.
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

revoke execute on function private.event_match_second(uuid)
  from public, anon, authenticated;

revoke execute on function
  public.add_event_match_card(uuid, uuid, uuid, public.event_match_card_color),
  public.delete_event_match_card(uuid)
  from public, anon;

grant execute on function
  public.add_event_match_card(uuid, uuid, uuid, public.event_match_card_color),
  public.delete_event_match_card(uuid)
  to authenticated;
