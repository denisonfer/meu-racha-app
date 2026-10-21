-- Lateral por lado, parte 2 (decisão do dono de 21/10/2026): Lateral Esquerdo e Lateral
-- Direito são camadas separadas no Sorteio, espalhadas entre os Times como o Zagueiro.
-- Mesmos corpos de 20261003210000_position_detail.sql, com LEFT_BACK e RIGHT_BACK no lugar
-- de FULL_BACK e oito camadas em vez de sete.

create or replace function private.position_detail_fits(zone public.position, detail public.position_detail)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    detail is null
      or (zone = 'DEFENDER' and detail in ('CENTER_BACK', 'LEFT_BACK', 'RIGHT_BACK'))
      or (zone = 'MIDFIELDER' and detail in ('DEFENSIVE_MID', 'ATTACKING_MID')),
    false
  );
$$;

create or replace function private.sort_layer_ix(p_layer text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_layer
    when 'CENTER_BACK' then 1
    when 'LEFT_BACK' then 2
    when 'RIGHT_BACK' then 3
    when 'DEFENDER' then 4
    when 'DEFENSIVE_MID' then 5
    when 'ATTACKING_MID' then 6
    when 'MIDFIELDER' then 7
    when 'FORWARD' then 8
  end;
$$;

create or replace function private.sort_teams(
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
  v_counts integer[] := array_fill(0, array[8]);
  v_next integer[];
  v_ordered integer[] := '{}';
  v_any integer[] := '{}';
  v_layer_players integer[];
  v_got integer[];
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

    -- Preenchimento por camada (ADR 0036): cada jogador da camada, em Estrelas desc, vai para o
    -- Time com vaga que tem menos gente desta camada; empate, menos gente no total; depois,
    -- menor soma de Estrelas; depois, menor índice. Na serpentina, o jogador a mais de camada
    -- ímpar caía sempre no mesmo Time e o ataque acumulava num Time só.
    foreach v_k in array array[
      'CENTER_BACK', 'LEFT_BACK', 'RIGHT_BACK', 'DEFENDER', 'DEFENSIVE_MID', 'ATTACKING_MID', 'MIDFIELDER',
      'FORWARD'
    ] loop
      v_layer_players := private.sort_stars_desc(
        (select coalesce(array_agg(i order by i), '{}'::integer[])
         from unnest(v_pool) as i where v_layer[i] = v_k),
        v_stars
      );
      continue when cardinality(v_layer_players) = 0;
      v_got := array_fill(0, array[v_t]);
      foreach v_i in array v_layer_players loop
        v_best := 0;
        for v_idx in 1..v_t loop
          continue when v_size[v_idx] >= v_caps[v_idx];
          if v_best = 0
             or (v_got[v_idx], v_size[v_idx], v_sums[v_idx])
                < (v_got[v_best], v_size[v_best], v_sums[v_best]) then
            v_best := v_idx;
          end if;
        end loop;
        v_team[v_i] := v_best;
        v_got[v_best] := v_got[v_best] + 1;
        v_size[v_best] := v_size[v_best] + 1;
        v_sums[v_best] := v_sums[v_best] + v_stars[v_i];
        v_sups[v_best] := v_sups[v_best] + v_sup[v_i]::integer;
      end loop;
    end loop;
    v_any := private.sort_stars_desc(
      (select coalesce(array_agg(i order by i), '{}'::integer[])
       from unnest(v_pool) as i where v_layer[i] = 'ANY'),
      v_stars
    );
  end if;

  -- Serpentina contínua (só sem Posição; com Posição v_ordered fica vazio): o ponteiro segue
  -- de onde parou; Time cheio é pulado (na divisão em 2 grupos os tamanhos diferem).
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
  private.position_detail_fits(public.position, public.position_detail),
  private.sort_layer_ix(text),
  private.sort_teams(jsonb, uuid[], integer, boolean, uuid[], double precision)
  from public, anon, authenticated;
