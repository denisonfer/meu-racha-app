-- Partida e placar, etapa 2: tabelas, gatilho de elenco e motor da fila
-- (regras 8.3 e 10.2, ADR 0032; spec e plano da Partida e placar de 03/10/2026).
-- Só o esquema e o cálculo. RPCs públicas (iniciar/encerrar/gol) ficam na etapa 3.
-- O motor é o porte de `.scratch/partida/engine.ts`; os casos de `cases.json`
-- rodam contra `private.event_match_next_state` em `supabase/tests/event_match.sql`.

-- Vitórias seguidas do Time na fila. Só o encerramento da Partida (etapa 3) escreve aqui.
alter table public.event_sort_team
  add column win_streak smallint not null default 0,
  add constraint event_sort_team_win_streak_nonneg check (win_streak >= 0);

create type public.event_match_status as enum ('open', 'finished', 'discarded');
create type public.event_match_role as enum ('OUTFIELD', 'GOALKEEPER');

-- `seq` cresce em todo o banco (uma sequência só), então também cresce de uma Partida
-- para a seguinte do mesmo Evento: o cliente ignora aviso com seq menor ou igual.
create sequence private.event_match_seq;

create table public.event_match (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_sort (event_id) on delete cascade,
  number integer not null check (number >= 1),
  home_team_id uuid not null,
  away_team_id uuid not null,
  -- Time que entrou da fila para esta Partida; nulo quando os dois chegaram juntos
  challenger_team_id uuid,
  is_rematch boolean not null default false,
  status public.event_match_status not null default 'open',
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  -- soma das pausas já encerradas; a pausa corrente é paused_at até agora
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  ended_at timestamptz,
  -- nulo = empate sem pênaltis (ou Partida descartada / ainda aberta)
  winner_team_id uuid,
  decided_by_penalties boolean not null default false,
  -- retrato do que o Iniciar encontrou: fila de Times, win_streak e goleiros (para descartar)
  queue_before jsonb not null,
  seq bigint not null default nextval('private.event_match_seq'),
  started_by uuid not null references public.profile (id),
  unique (id, event_id),
  unique (event_id, number),
  constraint event_match_home_fk foreign key (home_team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_match_away_fk foreign key (away_team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_match_challenger_fk foreign key (challenger_team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_match_winner_fk foreign key (winner_team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_match_teams_differ check (home_team_id <> away_team_id),
  constraint event_match_challenger_in_match check (
    challenger_team_id is null or challenger_team_id in (home_team_id, away_team_id)
  ),
  constraint event_match_winner_in_match check (
    winner_team_id is null or winner_team_id in (home_team_id, away_team_id)
  ),
  constraint event_match_penalties_need_winner check (
    not decided_by_penalties or winner_team_id is not null
  ),
  constraint event_match_status_shape check (
    (status = 'open' and ended_at is null and winner_team_id is null
      and not decided_by_penalties)
    or (status = 'finished' and ended_at is not null)
    or (status = 'discarded' and ended_at is not null and winner_team_id is null
      and not decided_by_penalties)
  ),
  constraint event_match_ended_after_start check (ended_at is null or ended_at >= started_at),
  constraint event_match_paused_after_start check (paused_at is null or paused_at >= started_at)
);

-- uma Partida aberta por Evento
create unique index event_match_one_open on public.event_match (event_id) where status = 'open';

-- Quem esteve em campo, e quando. Partida jogada = ter linha aqui; Vitória = estar ativo no
-- Time vencedor no apito (left_at = ended_at da Partida); o goleiro de cada Gol vem daqui.
create table public.event_match_lineup (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  match_id uuid not null,
  team_id uuid not null,
  profile_id uuid references public.profile (id),
  guest_id uuid references public.event_guest (id),
  person_id uuid generated always as (coalesce(profile_id, guest_id)) stored,
  role public.event_match_role not null,
  entered_at timestamptz not null default now(),
  left_at timestamptz,
  constraint event_match_lineup_match_fk foreign key (match_id, event_id)
    references public.event_match (id, event_id) on delete cascade,
  constraint event_match_lineup_team_fk foreign key (team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_match_lineup_member_xor_guest check ((profile_id is null) <> (guest_id is null)),
  constraint event_match_lineup_left_after_entered check (left_at is null or left_at >= entered_at)
);

create unique index event_match_lineup_one_active
  on public.event_match_lineup (match_id, person_id) where left_at is null;
create unique index event_match_lineup_one_goalkeeper
  on public.event_match_lineup (match_id, team_id) where role = 'GOALKEEPER' and left_at is null;
create index event_match_lineup_match on public.event_match_lineup (match_id);

create table public.event_match_goal (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  match_id uuid not null,
  -- chave do cliente: repetir a mesma chave devolve o Gol que já existe (etapa 3)
  request_key text not null check (char_length(request_key) between 1 and 100),
  -- Time que recebe o ponto; no gol contra é o adversário de quem tocou
  team_id uuid not null,
  scorer_profile_id uuid references public.profile (id),
  scorer_guest_id uuid references public.event_guest (id),
  scorer_id uuid generated always as (coalesce(scorer_profile_id, scorer_guest_id)) stored,
  assist_profile_id uuid references public.profile (id),
  assist_guest_id uuid references public.event_guest (id),
  assist_id uuid generated always as (coalesce(assist_profile_id, assist_guest_id)) stored,
  is_own_goal boolean not null default false,
  -- goleiro ativo do lado que sofreu, no momento do Gol; nulo se ninguém defendia
  conceded_profile_id uuid references public.profile (id),
  conceded_guest_id uuid references public.event_guest (id),
  conceded_goalkeeper_id uuid generated always as (coalesce(conceded_profile_id, conceded_guest_id)) stored,
  created_at timestamptz not null default now(),
  constraint event_match_goal_match_fk foreign key (match_id, event_id)
    references public.event_match (id, event_id) on delete cascade,
  constraint event_match_goal_team_fk foreign key (team_id, event_id)
    references public.event_sort_team (id, event_id),
  constraint event_match_goal_request_key unique (match_id, request_key),
  constraint event_match_goal_scorer_one check (scorer_profile_id is null or scorer_guest_id is null),
  constraint event_match_goal_assist_one check (assist_profile_id is null or assist_guest_id is null),
  constraint event_match_goal_conceded_one check (conceded_profile_id is null or conceded_guest_id is null),
  -- gol contra não credita ninguém; os demais têm autor, e assistência só com autor
  constraint event_match_goal_own_goal_anonymous check (
    not is_own_goal or (scorer_id is null and assist_id is null)
  ),
  constraint event_match_goal_needs_scorer check (is_own_goal or scorer_id is not null),
  constraint event_match_goal_assist_needs_scorer check (assist_id is null or scorer_id is not null),
  constraint event_match_goal_assist_not_scorer check (
    assist_id is distinct from scorer_id or assist_id is null
  )
);

create index event_match_goal_match on public.event_match_goal (match_id);

alter table public.event_match enable row level security;
alter table public.event_match_lineup enable row level security;
alter table public.event_match_goal enable row level security;

revoke all on public.event_match, public.event_match_lineup, public.event_match_goal
  from public, anon, authenticated;
revoke all on sequence private.event_match_seq from public, anon, authenticated;

-- Autor e assistência são do elenco da Partida, do Time que recebe o ponto; o goleiro que
-- sofreu é goleiro do outro Time na Partida. Cardinalidade entre tabelas não cabe em check.
create function private.event_match_goal_fits()
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
  if v_conceded is not null and not exists (
    select 1 from public.event_match_lineup l
    where l.match_id = new.match_id and l.team_id = v_other and l.role = 'GOALKEEPER'
      and l.person_id = v_conceded
  ) then
    raise exception 'invalid_goalkeeper' using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke execute on function private.event_match_goal_fits() from public, anon, authenticated;

create trigger event_match_goal_fits
  before insert or update on public.event_match_goal
  for each row execute function private.event_match_goal_fits();

-- ============================================================
-- Motor da fila (porte de .scratch/partida/engine.ts)
-- ============================================================

-- Só calcula. A entrada e a saída têm o formato JSON do TypeScript (camelCase), para os
-- casos de cases.json rodarem sem tradução de nomes. `p_seed` é o único sorteio de
-- tieReturnOrder RANDOM (rng() < 0.5 mantém mandante na frente); nulo sorteia com random().
-- Sorteio inesperado no teste passa um valor; produção passa nulo e o banco sorteia.
create function private.event_match_engine(p_input jsonb, p_seed double precision)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids text[];
  v_n integer;
  v_home text := p_input ->> 'homeId';
  v_away text := p_input ->> 'awayId';
  v_challenger text := p_input ->> 'challengerId';
  v_rematch boolean := coalesce((p_input ->> 'isRematch')::boolean, false);
  v_score_h integer := (p_input #>> '{score,home}')::integer;
  v_score_a integer := (p_input #>> '{score,away}')::integer;
  v_pen text := p_input ->> 'penaltyWinnerId';
  v_mode text := p_input #>> '{engine,gameMode}';
  v_max integer := (p_input #>> '{engine,maxConsecutiveWins}')::integer;
  v_rule text := p_input #>> '{engine,tieRule}';
  v_order text := p_input #>> '{engine,tieReturnOrder}';
  v_tie boolean;
  v_pen_applies boolean;
  v_streak jsonb;
  v_number jsonb;
  v_complete jsonb;
  v_winner text;
  v_loser text;
  v_penalties boolean := false;
  v_consequence text;
  v_fallback text;
  v_effective_rule text;
  v_stayers text[] := '{}';
  v_leavers text[] := '{}';
  v_pair boolean := false;
  v_rest text[];
  v_queue text[];
  v_entering text[] := '{}';
  v_streaks jsonb := '{}'::jsonb;
  v_next_home text;
  v_next_away text;
  v_next_challenger text;
  v_is_rematch boolean;
  v_bt jsonb;
  v_gq text[];
  v_total integer;
  v_draw double precision;
  v_swap boolean;
  v_k text;
  v_x text;
  v_all text[] := '{}';
begin
  select array_agg(t ->> 'id' order by (t ->> 'queueOrder')::integer),
    jsonb_object_agg(t ->> 'id', t -> 'winStreak'),
    jsonb_object_agg(t ->> 'id', t -> 'teamNumber'),
    jsonb_object_agg(t ->> 'id', coalesce(t -> 'complete', 'true'::jsonb))
  into v_ids, v_streak, v_number, v_complete
  from jsonb_array_elements(p_input -> 'teams') t;

  v_n := coalesce(cardinality(v_ids), 0);
  if v_n < 2 then
    raise exception 'not_enough_teams';
  end if;
  if (
    select count(distinct x) from unnest(v_ids) x
  ) <> v_n then
    raise exception 'invalid_queue';
  end if;
  if (
    select array_agg((t ->> 'queueOrder')::integer order by (t ->> 'queueOrder')::integer)
    from jsonb_array_elements(p_input -> 'teams') t
  ) is distinct from array(select generate_series(1, v_n)) then
    raise exception 'invalid_queue';
  end if;
  if v_ids[1] is distinct from v_home or v_ids[2] is distinct from v_away then
    raise exception 'invalid_queue';
  end if;
  if v_challenger is not null and v_challenger not in (v_home, v_away) then
    raise exception 'invalid_queue';
  end if;
  if v_mode = 'MAX_WINS' and (v_max is null or v_max < 2) then
    raise exception 'invalid_engine';
  end if;
  if v_rematch and (v_mode = 'ROTATION' or v_rule <> 'BOTH_STAY') then
    raise exception 'invalid_engine';
  end if;
  if v_score_h is null or v_score_a is null or v_score_h < 0 or v_score_a < 0 then
    raise exception 'invalid_score';
  end if;

  -- Pênaltis só existem em empate com a regra PENALTIES, fora da Rotação (10.2).
  v_tie := v_score_h = v_score_a;
  v_pen_applies := v_mode <> 'ROTATION' and v_rule = 'PENALTIES';
  if v_pen is not null then
    if not v_tie or not v_pen_applies or v_pen not in (v_home, v_away) then
      raise exception 'invalid_penalty_winner';
    end if;
  elsif v_tie and v_pen_applies then
    raise exception 'penalty_winner_required';
  end if;

  v_bt := coalesce(p_input #> '{goalkeepers,byTeam}', '{}'::jsonb);
  v_gq := coalesce(array(
    select e.x from jsonb_array_elements_text(p_input #> '{goalkeepers,queue}') with ordinality as e(x, o)
    order by e.o
  ), '{}'::text[]);
  for v_x, v_k in
    select e.key, e.value #>> '{}'
    from jsonb_each(v_bt) e
    where e.value <> 'null'::jsonb
  loop
    if not v_x = any(v_ids) then
      raise exception 'invalid_goalkeepers';
    end if;
    v_all := v_all || v_k;
  end loop;
  v_all := v_all || v_gq;
  if cardinality(v_all) <> (select count(distinct x) from unnest(v_all) x) then
    raise exception 'invalid_goalkeepers';
  end if;
  v_total := cardinality(v_all);
  if v_total >= v_n then
    -- goleiros >= Times: todo Time tem o seu (ADR 0032)
    if exists (select 1 from unnest(v_ids) t where v_bt ->> t is null) then
      raise exception 'invalid_goalkeepers';
    end if;
  else
    -- rodízio: Time que espera na fila não segura goleiro
    if exists (
      select 1 from unnest(v_ids) t
      where t not in (v_home, v_away) and v_bt ->> t is not null
    ) then
      raise exception 'invalid_goalkeepers';
    end if;
  end if;

  if v_score_h > v_score_a then
    v_winner := v_home;
  elsif v_score_a > v_score_h then
    v_winner := v_away;
  elsif v_pen is not null then
    v_winner := v_pen;
    v_penalties := true;
  end if;
  if v_winner is not null then
    v_loser := case when v_winner = v_home then v_away else v_home end;
  end if;

  if v_mode = 'ROTATION' then
    -- A Regra de Empate não vale em Rotação: os dois saem de qualquer jeito, e a ordem de
    -- volta segue tieReturnOrder também quando há vencedor (10.2, v1.37).
    v_consequence := 'ROTATION';
    v_stayers := '{}';
    v_pair := true;
  elsif v_winner is not null then
    if v_mode = 'MAX_WINS' and (v_streak ->> v_winner)::integer + 1 >= v_max then
      -- entra na fila antes do perdedor; sem sorteio
      v_consequence := 'MAX_WINS_OUT';
      v_stayers := '{}';
      v_leavers := array[v_winner, v_loser];
    else
      v_consequence := 'WINNER_STAYS';
      v_stayers := array[v_winner];
      v_leavers := array[v_loser];
    end if;
  else
    -- Empate sem pênaltis. A revanche que empata de novo vira "sai ambos"; sem desafiante o
    -- "desafiante leva" também (os dois chegaram juntos: 1ª Partida ou depois de sai ambos).
    v_effective_rule := v_rule;
    if v_rule = 'BOTH_STAY' and v_rematch then
      v_effective_rule := 'BOTH_OUT';
      v_fallback := 'REMATCH_TIED_AGAIN';
    elsif v_rule = 'CHALLENGER_WINS' and v_challenger is null then
      v_effective_rule := 'BOTH_OUT';
      v_fallback := 'NO_CHALLENGER';
    end if;
    if v_effective_rule = 'BOTH_STAY' then
      v_consequence := 'REMATCH';
      v_stayers := array[v_home, v_away];
      v_leavers := '{}';
    elsif v_effective_rule = 'CHALLENGER_WINS' then
      v_consequence := 'CHALLENGER_STAYS';
      v_stayers := array[v_challenger];
      v_leavers := array[case when v_challenger = v_home then v_away else v_home end];
    else
      -- BOTH_OUT (PENALTIES nunca chega aqui: a validação exige o vencedor)
      v_consequence := 'BOTH_OUT';
      v_stayers := '{}';
      v_pair := true;
    end if;
  end if;

  if v_pair then
    if v_order = 'TEAM_ORDER' then
      v_swap := (v_number ->> v_home)::integer > (v_number ->> v_away)::integer;
    else
      v_draw := coalesce(p_seed, random());
      v_swap := v_draw >= 0.5;
    end if;
    v_leavers := case when v_swap then array[v_away, v_home] else array[v_home, v_away] end;
  end if;

  v_rest := case when v_n > 2 then v_ids[3:v_n] else '{}'::text[] end;
  v_queue := v_stayers || v_rest || v_leavers;
  v_next_home := v_queue[1];
  v_next_away := v_queue[2];
  foreach v_x in array array[v_next_home, v_next_away] loop
    if not v_x = any(v_stayers) then
      v_entering := v_entering || v_x;
    end if;
  end loop;

  -- Sequência de vitórias: só o vencedor soma. Empate zera a sequência dos dois Times,
  -- mesmo quando um fica em campo (revanche ou desafiante leva) — 10.2. Sem isso, "fica
  -- ambos" acumularia vitórias que o Time não teve. Perdedor e quem sai também zeram.
  foreach v_x in array v_ids loop
    v_streaks := v_streaks || jsonb_build_object(v_x, (v_streak ->> v_x)::integer);
  end loop;
  foreach v_x in array array[v_home, v_away] loop
    v_streaks := v_streaks || jsonb_build_object(
      v_x, case when v_x is not distinct from v_winner then (v_streak ->> v_x)::integer + 1 else 0 end
    );
  end loop;
  foreach v_x in array v_leavers loop
    v_streaks := v_streaks || jsonb_build_object(v_x, 0);
  end loop;

  v_is_rematch := v_consequence = 'REMATCH';
  -- Desafiante da próxima: só existe quando um Time ficou e o outro lugar veio da fila.
  -- Na revanche o confronto é o mesmo, então o desafiante não muda.
  v_next_challenger := case
    when v_is_rematch then v_challenger
    when cardinality(v_stayers) = 1 then v_queue[2]
  end;

  -- Goleiros (8.3, ADR 0032). Com goleiros >= Times, o goleiro é do Time e a fila do gol
  -- (as sobras) não anda. No rodízio, o goleiro de quem sai vai para o fim da fila do gol,
  -- na ordem em que o Time entra na fila de Times; só depois cada Time que chega pega o
  -- primeiro da fila. Sair antes de entrar é o que faz "quem sai voltar na hora" com 2.
  if v_total < v_n then
    foreach v_x in array v_leavers loop
      v_k := v_bt ->> v_x;
      if v_k is not null then
        v_gq := v_gq || v_k;
      end if;
      v_bt := jsonb_set(v_bt, array[v_x], 'null'::jsonb, true);
    end loop;
    foreach v_x in array v_entering loop
      if cardinality(v_gq) > 0 then
        v_bt := jsonb_set(v_bt, array[v_x], to_jsonb(v_gq[1]), true);
        v_gq := case when cardinality(v_gq) > 1 then v_gq[2:cardinality(v_gq)] else '{}'::text[] end;
      else
        v_bt := jsonb_set(v_bt, array[v_x], 'null'::jsonb, true);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'queue', to_jsonb(v_queue),
    'winStreaks', v_streaks,
    'goalkeepers', jsonb_build_object('byTeam', v_bt, 'queue', to_jsonb(v_gq)),
    'next', jsonb_build_object(
      'homeId', v_next_home,
      'awayId', v_next_away,
      'challengerId', v_next_challenger,
      'isRematch', v_is_rematch,
      'incompleteTeamIds', coalesce((
        select jsonb_agg(x) from unnest(array[v_next_home, v_next_away]) as x
        where v_complete ->> x = 'false'
      ), '[]'::jsonb)
    ),
    'consequence', v_consequence,
    'fallback', v_fallback,
    'winnerId', v_winner,
    'decidedByPenalties', v_penalties,
    'leavingTeamIds', to_jsonb(v_leavers),
    'enteringTeamIds', to_jsonb(v_entering)
  );
end $$;

revoke execute on function private.event_match_engine(jsonb, double precision)
  from public, anon, authenticated;

-- Monta a entrada do motor a partir das tabelas e calcula. O placar vem dos Gols gravados.
-- Só lê: a prévia e o encerramento (etapa 3) usam esta mesma função. `p_seed` é o sorteio
-- de quem volta primeiro (RANDOM); nulo deixa o banco sortear.
create function private.event_match_next_state(
  p_match_id uuid,
  p_penalty_winner uuid,
  p_seed double precision
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_match public.event_match;
  v_event public.event;
  v_teams jsonb;
  v_by_team jsonb;
  v_queue jsonb;
begin
  select * into v_match from public.event_match m where m.id = p_match_id;
  if not found then
    raise exception 'match_not_found';
  end if;
  select * into v_event from public.event e where e.id = v_match.event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'queueOrder', t.queue_order,
    'winStreak', t.win_streak,
    'teamNumber', t.team_number,
    'complete', (
      select count(*) from public.event_sort_team_player p
      where p.team_id = t.id and p.left_at is null
    ) = v_event.outfield_per_team
  ) order by t.queue_order), '[]'::jsonb)
  into v_teams
  from public.event_sort_team t
  where t.event_id = v_event.id and t.queue_order is not null;

  -- atribuição atual: team_id no gol, queue_order na fila. O Iniciar (etapa 3) grava
  -- o goleiro de cada lado em team_id; o teste da etapa 2 monta o mesmo retrato.
  select coalesce(jsonb_object_agg(t.id, coalesce(to_jsonb(k.person_id), 'null'::jsonb)), '{}'::jsonb)
  into v_by_team
  from public.event_sort_team t
  left join public.event_sort_goalkeeper k on k.team_id = t.id
  where t.event_id = v_event.id and t.queue_order is not null;

  select coalesce(jsonb_agg(k.person_id order by k.queue_order), '[]'::jsonb)
  into v_queue
  from public.event_sort_goalkeeper k
  where k.event_id = v_event.id and k.queue_order is not null;

  return private.event_match_engine(
    jsonb_build_object(
      'teams', v_teams,
      'homeId', v_match.home_team_id,
      'awayId', v_match.away_team_id,
      'challengerId', v_match.challenger_team_id,
      'isRematch', v_match.is_rematch,
      'score', jsonb_build_object(
        'home', (select count(*) from public.event_match_goal g
          where g.match_id = p_match_id and g.team_id = v_match.home_team_id),
        'away', (select count(*) from public.event_match_goal g
          where g.match_id = p_match_id and g.team_id = v_match.away_team_id)
      ),
      'penaltyWinnerId', p_penalty_winner,
      'goalkeepers', jsonb_build_object('byTeam', v_by_team, 'queue', v_queue),
      'engine', jsonb_build_object(
        'gameMode', v_event.game_mode,
        'maxConsecutiveWins', case when v_event.game_mode = 'MAX_WINS' then v_event.max_consecutive_wins end,
        'tieRule', v_event.tie_rule,
        'tieReturnOrder', v_event.tie_return_order
      )
    ),
    p_seed
  );
end $$;

revoke execute on function private.event_match_next_state(uuid, uuid, double precision)
  from public, anon, authenticated;
