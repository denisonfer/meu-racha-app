-- Sorteio do Evento, etapa 2: proposta guardada no banco e publicação atômica
-- (regras 9, 6.2, 8.3; spec e plano do Sorteio de 03/10/2026). Nada é gravado
-- pelo cliente: o banco sorteia, guarda e publica; o app só chama as RPCs.

create type public.event_sort_status as enum ('draft', 'confirmed');

-- Um registro por Evento: o rascunho vira o confirmado, nunca há dois.
create table public.event_sort (
  event_id uuid primary key references public.event (id) on delete cascade,
  status public.event_sort_status not null default 'draft',
  -- hash do elenco + configuração; mudou, a proposta deixa de valer
  signature text not null,
  -- sobe a cada sorteio e a cada troca de Goleiros; a confirmação cita a que viu
  version integer not null default 1,
  -- sobras escolhidas uma vez por assinatura (9.6); Membro ou Avulso
  leftover_ids uuid[] not null default '{}',
  mode text not null,
  goalkeepers_per_team boolean not null,
  -- retrato do momento do sorteio; depois da confirmação é histórico (9.5)
  balance_score numeric(5, 2) not null,
  balance_label text not null,
  balance_diff smallint not null,
  super_diff smallint not null,
  capped_by_super boolean not null,
  super_warning jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profile (id),
  constraint event_sort_mode_values check (mode in ('normal', 'split')),
  constraint event_sort_version_positive check (version >= 1),
  constraint event_sort_balance_score_range check (balance_score between 0 and 100),
  constraint event_sort_balance_label_values check (
    balance_label in ('Muito equilibrado', 'Equilibrado', 'Razoável', 'Desequilibrado')
  ),
  constraint event_sort_confirmed_shape check (
    (status = 'draft' and confirmed_at is null and confirmed_by is null)
    or (status = 'confirmed' and confirmed_at is not null and confirmed_by is not null)
  )
);

-- queue_order nulo = Time arquivado (saiu da fila ativa, fica no histórico);
-- team_number é o nome fixo ("Time 3") e não muda quando a fila anda.
create table public.event_sort_team (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_sort (event_id) on delete cascade,
  team_number smallint not null check (team_number >= 1),
  queue_order smallint check (queue_order is null or queue_order >= 1),
  unique (id, event_id),
  unique (event_id, team_number),
  -- deferrable: reordenar a fila numa única instrução não colide no meio
  constraint event_sort_team_queue_order_key unique (event_id, queue_order) deferrable initially immediate
);

-- Avulso removido leva junto o vínculo: remove_guest segue livre com o rascunho aberto
-- (a proposta fica obsoleta e é refeita). Depois da confirmação a Saída (etapa 3) é
-- que registra o histórico; até lá remover o Avulso o tira do Time.
-- Jogador de linha num Time, com o histórico de entrada e saída e o retrato dos
-- atributos usados no sorteio (8.1: editar o Membro depois só vale no próximo).
create table public.event_sort_team_player (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  team_id uuid not null,
  profile_id uuid references public.profile (id),
  guest_id uuid references public.event_guest (id) on delete cascade,
  person_id uuid generated always as (coalesce(profile_id, guest_id)) stored,
  entered_at timestamptz not null default now(),
  left_at timestamptz,
  stars_snapshot smallint not null,
  is_super_star_snapshot boolean not null,
  primary_position_snapshot public.position not null,
  secondary_position_snapshot public.position,
  constraint event_sort_team_player_team_fk
    foreign key (team_id, event_id) references public.event_sort_team (id, event_id) on delete cascade,
  constraint event_sort_team_player_member_xor_guest check ((profile_id is null) <> (guest_id is null)),
  constraint event_sort_team_player_stars_range check (stars_snapshot between 1 and 5),
  constraint event_sort_team_player_left_after_entered check (left_at is null or left_at >= entered_at),
  constraint event_sort_team_player_position_shape check (
    case
      when primary_position_snapshot = 'ANY' then secondary_position_snapshot is null
      else secondary_position_snapshot is not null
           and secondary_position_snapshot <> 'ANY'
           and secondary_position_snapshot <> primary_position_snapshot
    end
  )
);

-- uma pessoa em no máximo um Time ativo do Evento
create unique index event_sort_team_player_one_active
  on public.event_sort_team_player (event_id, person_id) where left_at is null;
create index event_sort_team_player_team on public.event_sort_team_player (team_id);

-- Goleiro: no Time (um por Time) ou na fila do gol (queue_order), nunca nos dois.
create table public.event_sort_goalkeeper (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_sort (event_id) on delete cascade,
  team_id uuid,
  queue_order smallint check (queue_order is null or queue_order >= 1),
  profile_id uuid references public.profile (id),
  guest_id uuid references public.event_guest (id) on delete cascade,
  person_id uuid generated always as (coalesce(profile_id, guest_id)) stored,
  constraint event_sort_goalkeeper_team_fk
    foreign key (team_id, event_id) references public.event_sort_team (id, event_id) on delete cascade,
  constraint event_sort_goalkeeper_member_xor_guest check ((profile_id is null) <> (guest_id is null)),
  constraint event_sort_goalkeeper_team_xor_queue check ((team_id is null) <> (queue_order is null)),
  unique (event_id, person_id),
  constraint event_sort_goalkeeper_team_key unique (team_id) deferrable initially immediate,
  constraint event_sort_goalkeeper_queue_order_key unique (event_id, queue_order) deferrable initially immediate
);

alter table public.event_sort enable row level security;
alter table public.event_sort_team enable row level security;
alter table public.event_sort_team_player enable row level security;
alter table public.event_sort_goalkeeper enable row level security;

revoke all on public.event_sort, public.event_sort_team, public.event_sort_team_player,
  public.event_sort_goalkeeper from public, anon, authenticated;

-- A cardinalidade não cabe em check de uma linha. Toda escrita passa pela trava
-- do Racha, então contar aqui não corre contra outro escritor.
create function private.event_sort_team_player_fits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit smallint;
  v_active integer;
begin
  if new.left_at is not null then
    return new;
  end if;

  select e.outfield_per_team into v_limit from public.event e where e.id = new.event_id;
  select count(*) into v_active
  from public.event_sort_team_player p
  where p.team_id = new.team_id and p.left_at is null and p.id <> new.id;

  if v_active + 1 > v_limit then
    raise exception 'team_full' using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke execute on function private.event_sort_team_player_fits() from public, anon, authenticated;

create trigger event_sort_team_player_fits
  before insert or update on public.event_sort_team_player
  for each row execute function private.event_sort_team_player_fits();

-- Sorteio confirmado e Evento ainda agendado não coexistem: a confirmação muda
-- os dois juntos. Deferido para valer no fim da transação.
create function private.event_sort_confirmed_needs_started_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and exists (
    select 1 from public.event e where e.id = new.event_id and e.status = 'upcoming'
  ) then
    raise exception 'sort_confirmed_event_upcoming' using errcode = 'check_violation';
  end if;
  return null;
end $$;

revoke execute on function private.event_sort_confirmed_needs_started_event()
  from public, anon, authenticated;

create constraint trigger event_sort_confirmed_needs_started_event
  after insert or update on public.event_sort
  deferrable initially deferred
  for each row execute function private.event_sort_confirmed_needs_started_event();

-- --- motor (porta de .scratch/sorteio/engine.ts; RNG do Postgres) ---

-- Estrelas decrescente; o empate se resolve ao acaso.
create function private.sort_stars_desc(p_x integer[], p_stars integer[])
returns integer[]
language sql
volatile
set search_path = ''
as $$
  select coalesce(array_agg(x order by p_stars[x] desc, random()), '{}'::integer[])
  from unnest(p_x) as x;
$$;

create function private.sort_layer_ix(p_layer text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_layer when 'DEFENDER' then 1 when 'MIDFIELDER' then 2 when 'FORWARD' then 3 end;
$$;

-- Resto de cada camada por Time: uma camada que não divide certo deixa um Time sem o setor.
create function private.sort_layer_cost(p_counts integer[], p_teams integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(least(c % p_teams, p_teams - c % p_teams)), 0)::integer
  from unnest(p_counts) as c;
$$;

-- Vetor comparável (lexicográfico) do ajuste fino: Super Estrelas primeiro, depois as Estrelas.
create function private.sort_objective(p_sums integer[], p_sups integer[], p_spread_super boolean)
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select case when p_spread_super
    then array[s.sup_spread, s.sup_ssq, s.star_spread, s.star_ssq]
    else array[s.star_spread, s.star_ssq]
  end
  from (select
    (select max(x) - min(x) from unnest(p_sups) as x)::integer as sup_spread,
    (select sum(x * x) from unnest(p_sups) as x)::integer as sup_ssq,
    (select max(x) - min(x) from unnest(p_sums) as x)::integer as star_spread,
    (select sum(x * x) from unnest(p_sums) as x)::integer as star_ssq) s;
$$;

-- Aritmética inteira nas fronteiras: 75% exato não pode virar 74,999.
create function private.sort_balance(p_diff integer, p_line_per_team integer, p_super_diff integer)
returns table (score numeric, raw_score numeric, label text, capped boolean)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_max integer := 4 * p_line_per_team;
  v_hundredths integer := greatest(0, 4 * p_line_per_team - p_diff) * 100;
  v_capped boolean := p_super_diff >= 2 and v_hundredths > 74 * v_max;
begin
  raw_score := round(v_hundredths::numeric / v_max, 2);
  capped := v_capped;
  score := case when v_capped then 74 else raw_score end;
  label := case
    when (case when v_capped then 74 >= 90 else v_hundredths >= 90 * v_max end) then 'Muito equilibrado'
    when (case when v_capped then 74 >= 75 else v_hundredths >= 75 * v_max end) then 'Equilibrado'
    when (case when v_capped then 74 >= 60 else v_hundredths >= 60 * v_max end) then 'Razoável'
    else 'Desequilibrado'
  end;
  return next;
end $$;

-- p_players: [{id, stars, super, main, sec}] só de linha. p_seed existe para depurar e
-- testar; o RPC nunca o passa (setseed mexe no random() da sessão inteira).
create function private.sort_teams(
  p_players jsonb,
  p_goalkeepers uuid[],
  p_line_per_team integer,
  p_use_position boolean,
  p_fixed_leftovers uuid[] default null,
  p_seed double precision default null
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_l integer := p_line_per_team;
  v_n integer;
  v_ids uuid[];
  v_stars integer[];
  v_sup boolean[];
  v_main text[];
  v_sec text[];
  v_full integer;
  v_split boolean;
  v_caps integer[];
  v_t integer;
  v_left_count integer;
  v_leftovers uuid[];
  v_pool integer[];
  v_team integer[];
  v_size integer[];
  v_sums integer[];
  v_sups integer[];
  v_s2 integer[];
  v_u2 integer[];
  v_cur integer[];
  v_layer text[];
  v_counts integer[] := array[0, 0, 0];
  v_next integer[];
  v_ordered integer[] := '{}';
  v_any integer[] := '{}';
  v_i integer;
  v_k text;
  v_step integer := 0;
  v_r integer;
  v_idx integer;
  v_best integer;
  v_improved boolean;
  v_layer_cur text;
  v_layer_sec text;
  v_layer_other text;
  v_a integer;
  v_b integer;
  v_pa integer;
  v_pb integer;
  v_ta integer;
  v_tb integer;
  v_teams jsonb := '[]'::jsonb;
  v_super_warning jsonb := '[]'::jsonb;
  v_gk_order uuid[];
  v_gk_total integer;
  v_gk_per_team boolean;
  v_gk_by_team jsonb;
  v_gk_queue jsonb;
  v_min_sup integer;
  v_diff integer;
  v_super_diff integer;
  v_balance record;
  v_left_stars integer;
  v_left_sups integer;
begin
  if p_seed is not null then
    perform setseed(p_seed);
  end if;

  if v_l is null or v_l < 3 or v_l > 10 then
    raise exception 'invalid_line_per_team';
  end if;

  select coalesce(array_agg((e ->> 'id')::uuid order by o), '{}'::uuid[]),
         coalesce(array_agg((e ->> 'stars')::integer order by o), '{}'::integer[]),
         coalesce(array_agg(coalesce((e ->> 'super')::boolean, false) order by o), '{}'::boolean[]),
         coalesce(array_agg(e ->> 'main' order by o), '{}'::text[]),
         coalesce(array_agg(e ->> 'sec' order by o), '{}'::text[])
    into v_ids, v_stars, v_sup, v_main, v_sec
  from jsonb_array_elements(p_players) with ordinality as t(e, o);

  v_n := cardinality(v_ids);
  if (select count(distinct x) from unnest(v_ids) as x) <> v_n then
    raise exception 'duplicate_player';
  end if;
  if exists (select 1 from unnest(v_stars) as s where s is null or s < 1 or s > 5) then
    raise exception 'invalid_stars';
  end if;
  if v_n < 6 then
    raise exception 'not_enough_players';
  end if;

  v_full := v_n / v_l;
  v_split := v_full < 2;
  v_caps := case
    when v_split then array[ceil(v_n / 2.0)::integer, floor(v_n / 2.0)::integer]
    else array_fill(v_l, array[v_full])
  end;
  v_t := cardinality(v_caps);
  v_left_count := case when v_split then 0 else v_n % v_l end;

  -- sobras antes do equilíbrio, sem olhar Estrelas nem Posição
  if p_fixed_leftovers is not null then
    if cardinality(p_fixed_leftovers) <> v_left_count
       or (select count(distinct x) from unnest(p_fixed_leftovers) as x) <> cardinality(p_fixed_leftovers)
       or exists (select 1 from unnest(p_fixed_leftovers) as x where not (x = any (v_ids))) then
      raise exception 'fixed_leftovers_mismatch';
    end if;
    v_leftovers := p_fixed_leftovers;
  else
    select coalesce(array_agg(x), '{}'::uuid[]) into v_leftovers
    from (select x from unnest(v_ids) as x order by random() limit v_left_count) s;
  end if;

  select coalesce(array_agg(i order by i), '{}'::integer[]) into v_pool
  from generate_series(1, v_n) as i
  where not (v_ids[i] = any (v_leftovers));

  v_team := array_fill(0, array[v_n]);
  v_size := array_fill(0, array[v_t]);
  v_sums := array_fill(0, array[v_t]);
  v_sups := array_fill(0, array[v_t]);
  v_layer := array_fill('ANY'::text, array[v_n]);

  if not p_use_position then
    v_ordered := private.sort_stars_desc(v_pool, v_stars);
  else
    -- camada da Posição principal ou da secundária, a que deixar menos resto por Time
    foreach v_i in array v_pool loop
      if v_main[v_i] <> 'ANY' then
        v_layer[v_i] := v_main[v_i];
        v_counts[private.sort_layer_ix(v_main[v_i])] := v_counts[private.sort_layer_ix(v_main[v_i])] + 1;
      end if;
    end loop;

    v_improved := true;
    while v_improved loop
      v_improved := false;
      foreach v_i in array v_pool loop
        v_layer_cur := v_layer[v_i];
        v_layer_sec := v_sec[v_i];
        continue when v_layer_cur = 'ANY' or v_layer_sec is null or v_layer_sec = 'ANY';
        v_layer_other := case when v_layer_cur = v_main[v_i] then v_layer_sec else v_main[v_i] end;
        v_next := v_counts;
        v_next[private.sort_layer_ix(v_layer_cur)] := v_next[private.sort_layer_ix(v_layer_cur)] - 1;
        v_next[private.sort_layer_ix(v_layer_other)] := v_next[private.sort_layer_ix(v_layer_other)] + 1;
        if private.sort_layer_cost(v_next, v_t) < private.sort_layer_cost(v_counts, v_t) then
          v_counts := v_next;
          v_layer[v_i] := v_layer_other;
          v_improved := true;
        end if;
      end loop;
    end loop;

    foreach v_k in array array['DEFENDER', 'MIDFIELDER', 'FORWARD'] loop
      v_ordered := v_ordered || private.sort_stars_desc(
        (select coalesce(array_agg(i order by i), '{}'::integer[])
         from unnest(v_pool) as i where v_layer[i] = v_k),
        v_stars
      );
    end loop;
    v_any := private.sort_stars_desc(
      (select coalesce(array_agg(i order by i), '{}'::integer[])
       from unnest(v_pool) as i where v_layer[i] = 'ANY'),
      v_stars
    );
  end if;

  -- Serpentina contínua: o ponteiro segue de onde parou; Time cheio é pulado
  -- (na divisão em 2 grupos os tamanhos diferem).
  foreach v_i in array v_ordered loop
    loop
      v_r := v_step % (2 * v_t);
      v_idx := case when v_r < v_t then v_r else 2 * v_t - 1 - v_r end + 1;
      v_step := v_step + 1;
      if v_size[v_idx] < v_caps[v_idx] then
        v_team[v_i] := v_idx;
        v_size[v_idx] := v_size[v_idx] + 1;
        v_sums[v_idx] := v_sums[v_idx] + v_stars[v_i];
        v_sups[v_idx] := v_sups[v_idx] + v_sup[v_i]::integer;
        exit;
      end if;
    end loop;
  end loop;

  -- TODAS preenche onde falta: o Time com vaga e menor soma de Estrelas, sem olhar setor
  foreach v_i in array v_any loop
    v_best := 0;
    for v_idx in 1..v_t loop
      if v_size[v_idx] < v_caps[v_idx] and (v_best = 0 or v_sums[v_idx] < v_sums[v_best]) then
        v_best := v_idx;
      end if;
    end loop;
    v_team[v_i] := v_best;
    v_size[v_best] := v_size[v_best] + 1;
    v_sums[v_best] := v_sums[v_best] + v_stars[v_i];
    v_sups[v_best] := v_sups[v_best] + v_sup[v_i]::integer;
  end loop;

  -- Ajuste fino: primeira troca que melhora, até estabilizar. Com Posição só troca
  -- dentro da camada; TODAS troca com qualquer uma. Termina porque o vetor, de
  -- inteiros, diminui a cada troca.
  loop
    v_improved := false;
    v_cur := private.sort_objective(v_sums, v_sups, true);
    <<scan>>
    for v_a in 1..cardinality(v_pool) loop
      for v_b in v_a + 1..cardinality(v_pool) loop
        v_pa := v_pool[v_a];
        v_pb := v_pool[v_b];
        continue when v_team[v_pa] = v_team[v_pb];
        continue when not (v_layer[v_pa] = v_layer[v_pb] or v_layer[v_pa] = 'ANY' or v_layer[v_pb] = 'ANY');
        v_ta := v_team[v_pa];
        v_tb := v_team[v_pb];
        v_s2 := v_sums;
        v_s2[v_ta] := v_s2[v_ta] - v_stars[v_pa] + v_stars[v_pb];
        v_s2[v_tb] := v_s2[v_tb] - v_stars[v_pb] + v_stars[v_pa];
        v_u2 := v_sups;
        v_u2[v_ta] := v_u2[v_ta] - v_sup[v_pa]::integer + v_sup[v_pb]::integer;
        v_u2[v_tb] := v_u2[v_tb] - v_sup[v_pb]::integer + v_sup[v_pa]::integer;
        if private.sort_objective(v_s2, v_u2, true) < v_cur then
          v_team[v_pa] := v_tb;
          v_team[v_pb] := v_ta;
          v_sums := v_s2;
          v_sups := v_u2;
          v_improved := true;
          exit scan;
        end if;
      end loop;
    end loop;
    exit when not v_improved;
  end loop;

  for v_idx in 1..v_t loop
    v_teams := v_teams || jsonb_build_array(jsonb_build_object(
      'index', v_idx - 1,
      'player_ids', to_jsonb(array(
        select v_ids[i] from generate_series(1, v_n) as i
        where v_team[i] = v_idx order by v_stars[i] desc, i
      )),
      'star_sum', v_sums[v_idx],
      'super_count', v_sups[v_idx],
      'complete', v_size[v_idx] = v_l
    ));
  end loop;

  -- Time incompleto por último, fora do score
  if cardinality(v_leftovers) > 0 then
    select coalesce(sum(v_stars[i]), 0), count(*) filter (where v_sup[i])
      into v_left_stars, v_left_sups
    from generate_series(1, v_n) as i where v_ids[i] = any (v_leftovers);
    v_teams := v_teams || jsonb_build_array(jsonb_build_object(
      'index', v_t,
      'player_ids', to_jsonb(v_leftovers),
      'star_sum', v_left_stars,
      'super_count', v_left_sups,
      'complete', cardinality(v_leftovers) = v_l
    ));
  end if;

  v_diff := (select max(x) - min(x) from unnest(v_sums) as x);
  v_super_diff := (select max(x) - min(x) from unnest(v_sups) as x);
  select * into v_balance from private.sort_balance(v_diff, v_l, v_super_diff);

  v_min_sup := (select min(x) from unnest(v_sups) as x);
  if v_super_diff >= 2 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'team_index', t - 1,
      'player_ids', to_jsonb(array(
        select v_ids[i] from generate_series(1, v_n) as i
        where v_team[i] = t and v_sup[i] order by i
      ))
    ) order by t), '[]'::jsonb)
    into v_super_warning
    from generate_series(1, v_t) as t
    where v_sups[t] - v_min_sup >= 2;
  end if;

  select coalesce(array_agg(x order by random()), '{}'::uuid[]) into v_gk_order
  from unnest(coalesce(p_goalkeepers, '{}'::uuid[])) as x;
  v_gk_total := jsonb_array_length(v_teams);
  v_gk_per_team := cardinality(v_gk_order) >= v_gk_total;
  if v_gk_per_team then
    v_gk_by_team := to_jsonb(v_gk_order[1:v_gk_total]);
    v_gk_queue := to_jsonb(v_gk_order[v_gk_total + 1:cardinality(v_gk_order)]);
  else
    v_gk_by_team := to_jsonb(array_fill(null::uuid, array[v_gk_total]));
    v_gk_queue := to_jsonb(v_gk_order);
  end if;

  return jsonb_build_object(
    'mode', case when v_split then 'split' else 'normal' end,
    'teams', v_teams,
    'leftovers', to_jsonb(v_leftovers),
    'goalkeepers', jsonb_build_object(
      'per_team', v_gk_per_team, 'by_team', v_gk_by_team, 'queue', v_gk_queue
    ),
    'balance', jsonb_build_object(
      'score', v_balance.score,
      'raw_score', v_balance.raw_score,
      'label', v_balance.label,
      'diff', v_diff,
      'super_diff', v_super_diff,
      'capped_by_super', v_balance.capped
    ),
    'super_warning', v_super_warning
  );
end $$;

revoke execute on function
  private.sort_stars_desc(integer[], integer[]),
  private.sort_layer_ix(text),
  private.sort_layer_cost(integer[], integer),
  private.sort_objective(integer[], integer[], boolean),
  private.sort_balance(integer, integer, integer),
  private.sort_teams(jsonb, uuid[], integer, boolean, uuid[], double precision)
  from public, anon, authenticated;

-- --- elenco, assinatura e leitura ---

-- Quem entra no sorteio ou nos Goleiros: Membros ativos com Presença confirmada
-- e todos os Avulsos. Lista de espera e cancelados ficam de fora.
create function private.event_sort_roster(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r.entry order by r.key), '[]'::jsonb)
  from (
    select ea.profile_id::text as key,
      jsonb_build_object(
        'kind', 'member', 'id', ea.profile_id, 'plays_as', m.plays_as,
        'stars', m.stars, 'super', m.is_super_star,
        'main', m.primary_position, 'sec', m.secondary_position
      ) as entry
    from public.event_attendance ea
    join public.event e on e.id = ea.event_id
    join public.member m
      on m.racha_id = e.racha_id and m.profile_id = ea.profile_id and m.is_active
    where ea.event_id = p_event_id and ea.status = 'confirmed'
    union all
    select g.id::text,
      jsonb_build_object(
        'kind', 'guest', 'id', g.id, 'plays_as', g.plays_as,
        'stars', g.stars, 'super', g.is_super_star,
        'main', g.primary_position, 'sec', g.secondary_position
      )
    from public.event_guest g
    where g.event_id = p_event_id
  ) r;
$$;

create function private.event_sort_signature(p_event_id uuid, p_roster jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(sha256(convert_to(
    format('v1|line=%s|position=%s|%s', e.outfield_per_team, e.consider_position, p_roster::text),
    'UTF8'
  )), 'hex')
  from public.event e where e.id = p_event_id;
$$;

revoke execute on function private.event_sort_roster(uuid), private.event_sort_signature(uuid, jsonb)
  from public, anon, authenticated;

create function private.assert_event_sort_conductor(p_event public.event)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.my_racha_role(p_event.racha_id) is null then
    raise exception 'not_member';
  end if;
  if p_event.conductor_id is distinct from (select auth.uid()) then
    raise exception 'not_conductor';
  end if;
end $$;

revoke execute on function private.assert_event_sort_conductor(public.event)
  from public, anon, authenticated;

-- Times com jogadores (retrato), Goleiro do Time e somas atuais. A mesma forma
-- serve à proposta e aos Times publicados.
create function private.event_sort_teams_json(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.obj order by x.queue_order nulls last, x.team_number), '[]'::jsonb)
  from (
    select tm.queue_order, tm.team_number,
      jsonb_build_object(
        'team_number', tm.team_number,
        'queue_order', tm.queue_order,
        'is_active', tm.queue_order is not null,
        'player_count', pl.cnt,
        'is_complete', pl.cnt = e.outfield_per_team,
        'star_sum', pl.stars,
        'super_count', pl.supers,
        'players', pl.list,
        'goalkeeper', gk.obj
      ) as obj
    from public.event_sort_team tm
    join public.event e on e.id = tm.event_id
    cross join lateral (
      select count(*)::integer as cnt,
        coalesce(sum(p.stars_snapshot), 0)::integer as stars,
        (count(*) filter (where p.is_super_star_snapshot))::integer as supers,
        coalesce(jsonb_agg(
          jsonb_build_object(
            'kind', case when p.profile_id is not null then 'member' else 'guest' end,
            'profile_id', p.profile_id,
            'guest_id', p.guest_id,
            'display_name', coalesce(pr.display_name, g.display_name),
            'avatar_path', pr.avatar_path,
            'stars', p.stars_snapshot,
            'is_super_star', p.is_super_star_snapshot,
            'primary_position', p.primary_position_snapshot,
            'secondary_position', p.secondary_position_snapshot,
            'entered_at', p.entered_at
          ) order by p.stars_snapshot desc, coalesce(pr.display_name, g.display_name), p.id
        ), '[]'::jsonb) as list
      from public.event_sort_team_player p
      left join public.profile pr on pr.id = p.profile_id
      left join public.event_guest g on g.id = p.guest_id
      where p.team_id = tm.id and p.left_at is null
    ) pl
    left join lateral (
      select jsonb_build_object(
        'kind', case when k.profile_id is not null then 'member' else 'guest' end,
        'profile_id', k.profile_id,
        'guest_id', k.guest_id,
        'display_name', coalesce(pr.display_name, g.display_name),
        'avatar_path', pr.avatar_path
      ) as obj
      from public.event_sort_goalkeeper k
      left join public.profile pr on pr.id = k.profile_id
      left join public.event_guest g on g.id = k.guest_id
      where k.team_id = tm.id
    ) gk on true
    where tm.event_id = p_event_id
  ) x;
$$;

-- Fila do gol, em ordem
create function private.event_sort_goalkeeper_queue_json(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'kind', case when k.profile_id is not null then 'member' else 'guest' end,
      'profile_id', k.profile_id,
      'guest_id', k.guest_id,
      'display_name', coalesce(pr.display_name, g.display_name),
      'avatar_path', pr.avatar_path,
      'queue_order', k.queue_order
    ) order by k.queue_order
  ), '[]'::jsonb)
  from public.event_sort_goalkeeper k
  left join public.profile pr on pr.id = k.profile_id
  left join public.event_guest g on g.id = k.guest_id
  where k.event_id = p_event_id and k.team_id is null;
$$;

create function private.event_sort_balance_json(p_sort public.event_sort)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'score', p_sort.balance_score,
    'label', p_sort.balance_label,
    'diff', p_sort.balance_diff,
    'super_diff', p_sort.super_diff,
    'capped_by_super', p_sort.capped_by_super
  );
$$;

-- Estados: none (nada sorteado), stale (o elenco mudou: "A lista mudou. Sorteie
-- novamente."), ready (proposta vigente).
create function private.event_sort_proposal_json(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_roster jsonb := private.event_sort_roster(p_event_id);
  v_sort public.event_sort%rowtype;
  v_base jsonb;
  v_line integer;
begin
  select count(*) filter (where e ->> 'plays_as' = 'OUTFIELD')::integer into v_line
  from jsonb_array_elements(v_roster) as e;

  v_base := jsonb_build_object(
    'event_id', p_event_id,
    'line_count', v_line,
    'goalkeeper_count', jsonb_array_length(v_roster) - v_line,
    'min_line_players', 6,
    'can_sort', v_line >= 6
  );

  select * into v_sort from public.event_sort s where s.event_id = p_event_id;
  if not found then
    return v_base || jsonb_build_object('state', 'none');
  end if;
  if v_sort.signature <> private.event_sort_signature(p_event_id, v_roster) then
    return v_base || jsonb_build_object('state', 'stale');
  end if;

  return v_base || jsonb_build_object(
    'state', 'ready',
    'version', v_sort.version,
    'mode', v_sort.mode,
    'balance', private.event_sort_balance_json(v_sort),
    'super_warning', v_sort.super_warning,
    'teams', private.event_sort_teams_json(p_event_id),
    'goalkeepers_per_team', v_sort.goalkeepers_per_team,
    'goalkeeper_queue', private.event_sort_goalkeeper_queue_json(p_event_id)
  );
end $$;

-- Times publicados: o mesmo para todo Membro ativo; só is_conductor muda o que o app oferece.
create function private.event_sort_published_json(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_sort public.event_sort%rowtype;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  select * into v_sort from public.event_sort s
  where s.event_id = p_event_id and s.status = 'confirmed';
  if not found then
    return jsonb_build_object('state', 'none');
  end if;

  return jsonb_build_object(
    'state', 'published',
    'event_id', p_event_id,
    'event_status', v_event.status,
    'conductor_id', v_event.conductor_id,
    'is_conductor', v_event.conductor_id is not distinct from (select auth.uid()),
    'confirmed_at', v_sort.confirmed_at,
    'outfield_per_team', v_event.outfield_per_team,
    'mode', v_sort.mode,
    'balance', private.event_sort_balance_json(v_sort),
    'super_warning', v_sort.super_warning,
    'teams', private.event_sort_teams_json(p_event_id),
    'goalkeepers_per_team', v_sort.goalkeepers_per_team,
    'goalkeeper_queue', private.event_sort_goalkeeper_queue_json(p_event_id),
    -- Aguardando inclusão: quem estava na fila não sobe sozinho depois da publicação
    'waiting_for_inclusion', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'profile_id', ea.profile_id,
          'display_name', p.display_name,
          'avatar_path', p.avatar_path,
          'plays_as', m.plays_as,
          'queue_position', private.my_waitlist_position(p_event_id, ea.profile_id)
        ) order by private.my_waitlist_position(p_event_id, ea.profile_id)
      ), '[]'::jsonb)
      from public.event_attendance ea
      join public.profile p on p.id = ea.profile_id
      join public.member m
        on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
      where ea.event_id = p_event_id and ea.status = 'waitlisted'
    )
  );
end $$;

revoke execute on function
  private.event_sort_teams_json(uuid),
  private.event_sort_goalkeeper_queue_json(uuid),
  private.event_sort_balance_json(public.event_sort),
  private.event_sort_proposal_json(uuid),
  private.event_sort_published_json(uuid)
  from public, anon, authenticated;

-- --- RPCs ---

-- Preparar e re-sortear são a mesma chamada: a primeira escolhe as sobras, as
-- seguintes as conservam enquanto a assinatura for a mesma.
create function public.prepare_event_sort(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_sort public.event_sort%rowtype;
  v_roster jsonb;
  v_signature text;
  v_players jsonb;
  v_gks uuid[];
  v_fixed uuid[];
  v_result jsonb;
  v_team record;
  v_team_id uuid;
  v_had_sort boolean;
begin
  -- a trava comum do Racha, a mesma de Presença, Avulso, Membro e edição do Evento
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);

  select * into v_sort from public.event_sort s where s.event_id = p_event_id;
  v_had_sort := found;
  if v_had_sort and v_sort.status = 'confirmed' then
    raise exception 'already_confirmed';
  end if;
  if v_event.status <> 'upcoming' then
    raise exception 'event_not_upcoming';
  end if;

  v_roster := private.event_sort_roster(p_event_id);
  v_signature := private.event_sort_signature(p_event_id, v_roster);

  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_players
  from jsonb_array_elements(v_roster) as e where e ->> 'plays_as' = 'OUTFIELD';
  select coalesce(array_agg((e ->> 'id')::uuid), '{}'::uuid[]) into v_gks
  from jsonb_array_elements(v_roster) as e where e ->> 'plays_as' = 'GOALKEEPER';

  if jsonb_array_length(v_players) < 6 then
    raise exception 'not_enough_players';
  end if;

  if v_had_sort and v_sort.signature = v_signature then
    v_fixed := v_sort.leftover_ids;
  end if;

  v_result := private.sort_teams(
    v_players, v_gks, v_event.outfield_per_team, v_event.consider_position, v_fixed
  );

  insert into public.event_sort as s (
    event_id, signature, leftover_ids, mode, goalkeepers_per_team, balance_score,
    balance_label, balance_diff, super_diff, capped_by_super, super_warning
  ) values (
    p_event_id, v_signature,
    array(select x::uuid from jsonb_array_elements_text(v_result -> 'leftovers') as x),
    v_result ->> 'mode',
    (v_result -> 'goalkeepers' ->> 'per_team')::boolean,
    (v_result -> 'balance' ->> 'score')::numeric,
    v_result -> 'balance' ->> 'label',
    (v_result -> 'balance' ->> 'diff')::smallint,
    (v_result -> 'balance' ->> 'super_diff')::smallint,
    (v_result -> 'balance' ->> 'capped_by_super')::boolean,
    v_result -> 'super_warning'
  )
  on conflict (event_id) do update set
    signature = excluded.signature,
    version = s.version + 1,
    leftover_ids = excluded.leftover_ids,
    mode = excluded.mode,
    goalkeepers_per_team = excluded.goalkeepers_per_team,
    balance_score = excluded.balance_score,
    balance_label = excluded.balance_label,
    balance_diff = excluded.balance_diff,
    super_diff = excluded.super_diff,
    capped_by_super = excluded.capped_by_super,
    super_warning = excluded.super_warning,
    generated_at = now();

  delete from public.event_sort_goalkeeper g where g.event_id = p_event_id;
  delete from public.event_sort_team t where t.event_id = p_event_id;

  for v_team in
    select t.value as team, t.ord::integer as ord
    from jsonb_array_elements(v_result -> 'teams') with ordinality as t(value, ord)
  loop
    insert into public.event_sort_team (event_id, team_number, queue_order)
    values (p_event_id, v_team.ord, v_team.ord)
    returning id into v_team_id;

    insert into public.event_sort_team_player (
      event_id, team_id, profile_id, guest_id, stars_snapshot,
      is_super_star_snapshot, primary_position_snapshot, secondary_position_snapshot
    )
    select p_event_id, v_team_id,
      case when r.kind = 'member' then r.id end,
      case when r.kind = 'guest' then r.id end,
      r.stars, r.super, r.main, r.sec
    from jsonb_to_recordset(v_roster) as r(
      kind text, id uuid, stars smallint, super boolean, main public.position, sec public.position
    )
    where r.id in (
      select x::uuid from jsonb_array_elements_text(v_team.team -> 'player_ids') as x
    );

    insert into public.event_sort_goalkeeper (event_id, team_id, profile_id, guest_id)
    select p_event_id, v_team_id,
      case when r.kind = 'member' then r.id end,
      case when r.kind = 'guest' then r.id end
    from jsonb_to_recordset(v_roster) as r(kind text, id uuid)
    where r.id = (v_result -> 'goalkeepers' -> 'by_team' ->> (v_team.ord - 1))::uuid;
  end loop;

  insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id, guest_id)
  select p_event_id, q.ord::smallint,
    case when r.kind = 'member' then r.id end,
    case when r.kind = 'guest' then r.id end
  from jsonb_array_elements_text(v_result -> 'goalkeepers' -> 'queue')
    with ordinality as q(id, ord)
  join jsonb_to_recordset(v_roster) as r(kind text, id uuid) on r.id = q.id::uuid;

  return private.event_sort_proposal_json(p_event_id);
end $$;

revoke execute on function public.prepare_event_sort(uuid) from public, anon;
grant execute on function public.prepare_event_sort(uuid) to authenticated;

-- Troca dois Goleiros de lugar (Time ou fila) sem re-sortear a linha.
create function public.swap_event_sort_goalkeepers(
  p_event_id uuid,
  p_version integer,
  p_goalkeeper_a uuid,
  p_goalkeeper_b uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_sort public.event_sort%rowtype;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);

  select * into v_sort from public.event_sort s where s.event_id = p_event_id;
  if found and v_sort.status = 'confirmed' then
    raise exception 'already_confirmed';
  end if;
  if v_event.status <> 'upcoming' then
    raise exception 'event_not_upcoming';
  end if;
  if not found then
    raise exception 'no_proposal';
  end if;
  if v_sort.signature <> private.event_sort_signature(p_event_id, private.event_sort_roster(p_event_id)) then
    raise exception 'roster_changed';
  end if;
  if v_sort.version is distinct from p_version then
    raise exception 'proposal_outdated';
  end if;

  if p_goalkeeper_a is distinct from p_goalkeeper_b then
    if (
      select count(*) from public.event_sort_goalkeeper k
      where k.event_id = p_event_id and k.person_id in (p_goalkeeper_a, p_goalkeeper_b)
    ) <> 2 then
      raise exception 'goalkeeper_not_found';
    end if;

    -- uma instrução só: as chaves únicas adiáveis conferem no fim dela
    update public.event_sort_goalkeeper k set
      team_id = o.team_id,
      queue_order = o.queue_order
    from public.event_sort_goalkeeper o
    where k.event_id = p_event_id and o.event_id = p_event_id
      and ((k.person_id = p_goalkeeper_a and o.person_id = p_goalkeeper_b)
        or (k.person_id = p_goalkeeper_b and o.person_id = p_goalkeeper_a));

    update public.event_sort s set version = s.version + 1 where s.event_id = p_event_id;
  end if;

  return private.event_sort_proposal_json(p_event_id);
end $$;

revoke execute on function public.swap_event_sort_goalkeepers(uuid, integer, uuid, uuid)
  from public, anon;
grant execute on function public.swap_event_sort_goalkeepers(uuid, integer, uuid, uuid)
  to authenticated;

-- Confirma o que o banco guardou: o cliente só cita a versão que viu. Sorteio
-- confirmado e upcoming -> active acontecem na mesma transação.
create function public.confirm_event_sort(p_event_id uuid, p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_sort public.event_sort%rowtype;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);

  select * into v_sort from public.event_sort s where s.event_id = p_event_id;
  if found and v_sort.status = 'confirmed' then
    raise exception 'already_confirmed';
  end if;
  if v_event.status <> 'upcoming' then
    raise exception 'event_not_upcoming';
  end if;
  if not found
     or (select count(*) from public.event_sort_team t where t.event_id = p_event_id) < 2 then
    raise exception 'no_proposal';
  end if;
  if v_sort.signature <> private.event_sort_signature(p_event_id, private.event_sort_roster(p_event_id)) then
    raise exception 'roster_changed';
  end if;
  if v_sort.version is distinct from p_version then
    raise exception 'proposal_outdated';
  end if;

  update public.event_sort s set
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = (select auth.uid())
  where s.event_id = p_event_id;

  update public.event e set status = 'active' where e.id = p_event_id;

  return private.event_sort_published_json(p_event_id);
end $$;

revoke execute on function public.confirm_event_sort(uuid, integer) from public, anon;
grant execute on function public.confirm_event_sort(uuid, integer) to authenticated;

-- Só o Condutor vê o rascunho
create function public.get_event_sort_proposal(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;
  perform private.assert_event_sort_conductor(v_event);

  if exists (
    select 1 from public.event_sort s where s.event_id = p_event_id and s.status = 'confirmed'
  ) then
    raise exception 'already_confirmed';
  end if;
  if v_event.status <> 'upcoming' then
    raise exception 'event_not_upcoming';
  end if;

  return private.event_sort_proposal_json(p_event_id);
end $$;

revoke execute on function public.get_event_sort_proposal(uuid) from public, anon;
grant execute on function public.get_event_sort_proposal(uuid) to authenticated;

-- Times publicados, para qualquer Membro ativo. Rascunho e Evento legado sem Sorteio: state none.
create function public.get_event_sort(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;
  if public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_member';
  end if;

  return private.event_sort_published_json(p_event_id);
end $$;

revoke execute on function public.get_event_sort(uuid) from public, anon;
grant execute on function public.get_event_sort(uuid) to authenticated;

-- --- auditoria de trava ---

-- Toda escrita em Membro/Presença/Avulso/Evento já toma a trava do Racha antes de
-- tudo (lock_event_for_attendance ou o for update direto), menos a reativação
-- de Membro pela aprovação. Ela agora trava o Racha antes de reler e gravar, na
-- mesma ordem das demais; o resto do corpo é idêntico.
create or replace function public.approve_join_request(
  p_request_id uuid,
  p_stars smallint,
  p_super_star boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.join_request%rowtype;
  v_profile public.profile%rowtype;
  v_stars smallint;
  v_super_star boolean;
begin
  select * into v_request from public.join_request jr where jr.id = p_request_id;
  if not found then
    raise exception 'already_resolved';
  end if;

  -- Racha primeiro, pedido depois: a ordem de expel_member, que apaga o pedido sob a mesma trava
  perform 1 from public.racha r where r.id = v_request.racha_id for update;

  -- for update: dois admins no mesmo pedido, o segundo espera e vê já resolvido
  select * into v_request from public.join_request jr
    where jr.id = p_request_id for update;
  if not found then
    raise exception 'already_resolved';
  end if;
  if not coalesce(public.my_racha_role(v_request.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'already_resolved';
  end if;

  select * into v_profile from public.profile p where p.id = v_request.profile_id;

  -- Goleiro entra sem Estrelas nem Super Estrela, seja o que for que veio (8.3)
  if v_profile.plays_as = 'GOALKEEPER' then
    v_stars := null;
    v_super_star := false;
  else
    if p_stars is null or p_stars not between 1 and 5 then
      raise exception 'stars_required';
    end if;
    v_stars := p_stars;
    v_super_star := coalesce(p_super_star, false);
  end if;

  -- quem saiu e voltou já tem a linha (inativa) do par: reativa em vez de duplicar.
  -- o where trava a reativação em quem está inativo: sem ele, um pedido
  -- pendente "impossível" (Membro já ativo, ex.: dois aprovam em paralelo)
  -- rebaixaria/sobrescreveria as Estrelas de um Membro ativo.
  insert into public.member as m (
    racha_id, profile_id, role, plays_as, primary_position, secondary_position,
    stars, is_super_star
  ) values (
    v_request.racha_id, v_request.profile_id, 'PLAYER', v_profile.plays_as,
    v_profile.primary_position, v_profile.secondary_position, v_stars, v_super_star
  )
  on conflict (racha_id, profile_id) do update set
    is_active = true,
    role = 'PLAYER',
    plays_as = excluded.plays_as,
    primary_position = excluded.primary_position,
    secondary_position = excluded.secondary_position,
    stars = excluded.stars,
    is_super_star = excluded.is_super_star,
    joined_at = now()
  where not m.is_active;

  -- found reflete o insert/update do comando acima (confirmado com o
  -- postgres local): se o where bloqueou (Membro já ativo), nada mudou.
  if not found then
    raise exception 'already_resolved';
  end if;

  update public.join_request jr
    set status = 'APPROVED', reviewed_by = (select auth.uid()), reviewed_at = now()
    where jr.id = p_request_id;

  -- reaprovado depois de expulso: o aviso antigo não pode reaparecer na lista
  delete from public.racha_notice n
    where n.profile_id = v_request.profile_id
      and n.racha_id = v_request.racha_id
      and n.kind = 'REMOVED';
end $$;
