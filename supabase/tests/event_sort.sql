-- Sorteio do Evento, etapa 2: motor SQL, proposta guardada, confirmação atômica e leitura.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/event_sort.sql
begin;

create function pg_temp.err(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;

create function pg_temp.assert_that(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_msg;
  end if;
end $$;

-- O Sorteio só considera quem veio (did_attend). Os fluxos antigos abaixo confirmam Presença e
-- criam Avulso sem marcar "veio"; este gatilho (só nesta transação) marca na hora, para eles
-- seguirem testando o que testavam. A seção 10 o remove e prova o comportamento novo.
create function pg_temp.auto_came() returns trigger
language plpgsql as $$
begin
  new.did_attend := true;
  return new;
end $$;
create trigger auto_came before insert or update of status on public.event_attendance
  for each row when (new.status = 'confirmed') execute function pg_temp.auto_came();
create trigger auto_came before insert on public.event_guest
  for each row execute function pg_temp.auto_came();

-- n jogadores de linha com Estrelas variadas; ids estáveis (md5 de pNN)
create function pg_temp.line(p_n integer, p_supers integer[] default '{}', p_pos boolean default false)
returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'id', md5('p' || i)::uuid,
    'stars', 1 + (i * 7 % 5),
    'super', i = any (p_supers),
    'main', case when p_pos then (array['DEFENDER', 'MIDFIELDER', 'FORWARD', 'ANY'])[1 + i % 4] else 'ANY' end,
    'sec', case when p_pos and i % 4 <> 3
      then (array['DEFENDER', 'MIDFIELDER', 'FORWARD'])[1 + ((i % 4) + 1) % 3] end
  ) order by i)
  from generate_series(1, p_n) i;
$$;

create function pg_temp.sizes(p_r jsonb) returns integer[] language sql as $$
  select array_agg(jsonb_array_length(t -> 'player_ids') order by (t ->> 'index')::integer)
  from jsonb_array_elements(p_r -> 'teams') t;
$$;

create function pg_temp.placed(p_r jsonb) returns text[] language sql as $$
  select array_agg(x order by x)
  from jsonb_array_elements(p_r -> 'teams') t, jsonb_array_elements_text(t -> 'player_ids') x;
$$;

create function pg_temp.given(p_players jsonb) returns text[] language sql as $$
  select array_agg(e ->> 'id' order by e ->> 'id') from jsonb_array_elements(p_players) e;
$$;

create function pg_temp.sort(p_players jsonb, p_gk integer, p_l integer, p_pos boolean,
  p_fixed uuid[] default null, p_seed double precision default null)
returns jsonb language sql as $$
  select private.sort_teams(
    p_players,
    array(select md5('g' || i)::uuid from generate_series(1, p_gk) i),
    p_l, p_pos, p_fixed, p_seed);
$$;

-- ============================================================
-- 1. Motor: formações, invariantes e decisões do dono
-- ============================================================
do $$
declare
  v_r jsonb;
  v_n integer;
  v_l integer;
  v_sizes integer[];
  v_pl jsonb;
begin
  -- 6, 8, 11, 25 e 30 de linha com 5 por Time (regra 9.6)
  foreach v_n in array array[6, 8, 11, 25, 30] loop
    v_pl := pg_temp.line(v_n);
    v_r := pg_temp.sort(v_pl, 0, 5, false, null, v_n / 100.0);
    perform pg_temp.assert_that(pg_temp.given(v_pl) = pg_temp.placed(v_r),
      format('ninguém duplicado nem perdido com %s de linha', v_n));
  end loop;
  perform pg_temp.assert_that(pg_temp.sizes(pg_temp.sort(pg_temp.line(6), 0, 5, false)) = array[3, 3], '6 = 3x3');
  perform pg_temp.assert_that(pg_temp.sizes(pg_temp.sort(pg_temp.line(8), 0, 5, false)) = array[4, 4], '8 = 4x4');
  perform pg_temp.assert_that(pg_temp.sizes(pg_temp.sort(pg_temp.line(11), 0, 5, false)) = array[5, 5, 1], '11 = 5+5+1');
  perform pg_temp.assert_that(pg_temp.sizes(pg_temp.sort(pg_temp.line(25), 0, 5, false)) = array[5, 5, 5, 5, 5], '25 = cinco Times');
  perform pg_temp.assert_that(pg_temp.sizes(pg_temp.sort(pg_temp.line(30), 0, 5, false)) = array[5, 5, 5, 5, 5, 5], '30 = seis Times');
  -- decisão do dono: menos de 2 Times completos divide em 2 grupos, pode sair 5x4
  perform pg_temp.assert_that(pg_temp.sizes(pg_temp.sort(pg_temp.line(9), 0, 5, false)) = array[5, 4], '9 = 5x4');
  perform pg_temp.assert_that(pg_temp.sizes(pg_temp.sort(pg_temp.line(7), 0, 5, false)) = array[4, 3], '7 = 4x3');
  perform pg_temp.assert_that(pg_temp.err($e$select pg_temp.sort(pg_temp.line(5), 0, 5, false)$e$) = 'not_enough_players',
    '5 de linha não sorteia');
  raise notice 'PASS: formações 6, 8, 11, 25, 30, divisão 5x4 e bloqueio abaixo de 6';

  -- todo n de 6 a 40 e todo L de 3 a 10: tamanhos coerentes e mínimo de 3 por grupo na divisão
  for v_l in 3..10 loop
    for v_n in 6..40 loop
      v_pl := pg_temp.line(v_n);
      v_r := pg_temp.sort(v_pl, 0, v_l, v_n % 2 = 0);
      v_sizes := pg_temp.sizes(v_r);
      perform pg_temp.assert_that(pg_temp.given(v_pl) = pg_temp.placed(v_r), format('perda/duplicata n=%s L=%s', v_n, v_l));
      if v_n / v_l >= 2 then
        perform pg_temp.assert_that(
          (select bool_and(s = v_l) from unnest(v_sizes[1:v_n / v_l]) s)
          and cardinality(v_sizes) = v_n / v_l + (case when v_n % v_l > 0 then 1 else 0 end)
          and (v_n % v_l = 0 or v_sizes[cardinality(v_sizes)] = v_n % v_l),
          format('Times completos n=%s L=%s: %s', v_n, v_l, v_sizes));
      else
        perform pg_temp.assert_that(
          cardinality(v_sizes) = 2 and v_sizes[1] - v_sizes[2] in (0, 1) and v_sizes[2] >= 3,
          format('divisão n=%s L=%s: %s', v_n, v_l, v_sizes));
      end if;
    end loop;
  end loop;
  raise notice 'PASS: tamanhos de Time para L 3..10 e n 6..40 (completos + sobra, ou 2 grupos >= 3 com diferença <= 1)';
end $$;

-- ============================================================
-- 2. Motor: sobras ao acaso, fixas no re-sorteio
-- ============================================================
create temp table sort_freq (id uuid primary key, n integer not null default 0);

do $$
declare
  v_pl jsonb := pg_temp.line(11);
  v_first jsonb;
  v_again jsonb;
  v_seed integer;
  v_min integer;
  v_max integer;
begin
  insert into sort_freq (id) select (e ->> 'id')::uuid from jsonb_array_elements(v_pl) e;
  for v_seed in 1..1100 loop
    update sort_freq set n = n + 1
    where id = (pg_temp.sort(v_pl, 0, 5, false, null, v_seed / 2000.0) -> 'leftovers' ->> 0)::uuid;
  end loop;
  select min(n), max(n) into v_min, v_max from sort_freq;
  -- 1100 sorteios, 11 pessoas: média 100; qualquer um fora de 60..140 indicaria viés
  perform pg_temp.assert_that(v_min >= 60 and v_max <= 140, format('sobra desigual: min %s max %s', v_min, v_max));
  raise notice 'PASS: sobra uniforme em 1100 sorteios (min %, max %, esperado ~100)', v_min, v_max;

  -- a sobra não olha Estrelas: quem tem 1 e quem tem 5 já ficaram de fora
  perform pg_temp.assert_that(
    exists (select 1 from sort_freq f join jsonb_array_elements(v_pl) e on (e ->> 'id')::uuid = f.id
            where (e ->> 'stars')::integer = 1 and f.n > 0)
    and exists (select 1 from sort_freq f join jsonb_array_elements(v_pl) e on (e ->> 'id')::uuid = f.id
            where (e ->> 'stars')::integer = 5 and f.n > 0),
    'sobra sorteada sem olhar Estrelas');

  -- fixas: com a mesma sobra, 50 sementes diferentes nunca a movem
  v_first := pg_temp.sort(v_pl, 0, 5, false, null, 0.3);
  for v_seed in 1..50 loop
    v_again := pg_temp.sort(v_pl, 0, 5, false,
      array(select x::uuid from jsonb_array_elements_text(v_first -> 'leftovers') x), v_seed / 100.0);
    perform pg_temp.assert_that(v_again -> 'leftovers' = v_first -> 'leftovers', 'sobra fixa mudou no re-sorteio');
    perform pg_temp.assert_that(v_again -> 'teams' -> 2 -> 'player_ids' = v_first -> 'teams' -> 2 -> 'player_ids',
      'Time incompleto mudou no re-sorteio');
  end loop;
  raise notice 'PASS: sobras fixas no re-sorteio';

  perform pg_temp.assert_that(
    pg_temp.err($e$select pg_temp.sort(pg_temp.line(11), 0, 5, false, array[md5('zz')::uuid])$e$) = 'fixed_leftovers_mismatch',
    'sobra fixa fora do elenco recusada');
  perform pg_temp.assert_that(
    jsonb_array_length(pg_temp.sort(pg_temp.line(10), 0, 5, false) -> 'leftovers') = 0,
    'sem sobra quando divide certo');
end $$;

-- ============================================================
-- 3. Motor: Goleiros por Time ou fila (8.3, ADR 0032)
-- ============================================================
do $$
declare
  v_r jsonb;
begin
  v_r := pg_temp.sort(pg_temp.line(11), 0, 5, false);
  perform pg_temp.assert_that((v_r -> 'goalkeepers' ->> 'per_team')::boolean = false
    and jsonb_array_length(v_r -> 'goalkeepers' -> 'queue') = 0, '0 goleiros: fila vazia');

  v_r := pg_temp.sort(pg_temp.line(11), 2, 5, false);   -- 3 Times, 2 goleiros
  perform pg_temp.assert_that((v_r -> 'goalkeepers' ->> 'per_team')::boolean = false
    and jsonb_array_length(v_r -> 'goalkeepers' -> 'queue') = 2
    and (select bool_and(e = 'null'::jsonb) from jsonb_array_elements(v_r -> 'goalkeepers' -> 'by_team') e),
    'menos goleiros que Times: rodízio, fila de 2, nenhum Time com goleiro próprio');

  v_r := pg_temp.sort(pg_temp.line(8), 2, 5, false);    -- 2 Times, 2 goleiros
  perform pg_temp.assert_that((v_r -> 'goalkeepers' ->> 'per_team')::boolean
    and jsonb_array_length(v_r -> 'goalkeepers' -> 'queue') = 0
    and (select count(distinct e) from jsonb_array_elements_text(v_r -> 'goalkeepers' -> 'by_team') e) = 2,
    'igual: um por Time, fila vazia');

  v_r := pg_temp.sort(pg_temp.line(25), 6, 5, false);   -- 5 Times, 6 goleiros
  perform pg_temp.assert_that((v_r -> 'goalkeepers' ->> 'per_team')::boolean
    and jsonb_array_length(v_r -> 'goalkeepers' -> 'queue') = 1, 'mais goleiros: um por Time e sobra na fila');

  v_r := pg_temp.sort(pg_temp.line(30), 6, 5, false);   -- 6 Times, 6 goleiros
  perform pg_temp.assert_that((v_r -> 'goalkeepers' ->> 'per_team')::boolean
    and jsonb_array_length(v_r -> 'goalkeepers' -> 'queue') = 0, '30 + 6: um por Time');

  v_r := pg_temp.sort(pg_temp.line(25), 3, 5, false);   -- 5 Times, 3 goleiros
  perform pg_temp.assert_that(not (v_r -> 'goalkeepers' ->> 'per_team')::boolean
    and jsonb_array_length(v_r -> 'goalkeepers' -> 'queue') = 3, '25 + 3: rodízio');

  -- a linha não depende de quantos goleiros existem
  perform pg_temp.assert_that(
    pg_temp.sort(pg_temp.line(14), 0, 5, true, null, 0.7) -> 'teams'
    = pg_temp.sort(pg_temp.line(14), 3, 5, true, null, 0.7) -> 'teams',
    'a linha não depende da quantidade de goleiros');
  raise notice 'PASS: Goleiros 0, menos, igual e mais que Times';
end $$;

-- ============================================================
-- 4. Motor: score, rótulo e teto de 74% nas fronteiras (9.5)
-- ============================================================
do $$
declare
  r record;
begin
  -- L=5, máximo 20: diferença 0..9
  select * into r from private.sort_balance(0, 5, 0);
  perform pg_temp.assert_that(r.score = 100 and r.label = 'Muito equilibrado', '100%');
  select * into r from private.sort_balance(2, 5, 0);
  perform pg_temp.assert_that(r.score = 90 and r.label = 'Muito equilibrado', '90% exato é Muito equilibrado');
  select * into r from private.sort_balance(3, 5, 0);
  perform pg_temp.assert_that(r.score = 85 and r.label = 'Equilibrado', '85%');
  select * into r from private.sort_balance(5, 5, 0);
  perform pg_temp.assert_that(r.score = 75 and r.label = 'Equilibrado', '75% exato é Equilibrado');
  select * into r from private.sort_balance(6, 5, 0);
  perform pg_temp.assert_that(r.score = 70 and r.label = 'Razoável', '70%');
  select * into r from private.sort_balance(8, 5, 0);
  perform pg_temp.assert_that(r.score = 60 and r.label = 'Razoável', '60% exato é Razoável');
  select * into r from private.sort_balance(9, 5, 0);
  perform pg_temp.assert_that(r.score = 55 and r.label = 'Desequilibrado', '55%');
  -- L=3, máximo 12: 11/12 não cai na faixa errada por arredondamento
  select * into r from private.sort_balance(1, 3, 0);
  perform pg_temp.assert_that(r.score = 91.67 and r.label = 'Muito equilibrado', '91,67% com L=3');
  select * into r from private.sort_balance(3, 3, 0);
  perform pg_temp.assert_that(r.score = 75 and r.label = 'Equilibrado', '75% com L=3');
  select * into r from private.sort_balance(5, 3, 0);
  perform pg_temp.assert_that(r.score = 58.33 and r.label = 'Desequilibrado', '58,33% com L=3');
  -- teto: 2 ou mais Super Estrelas de diferença travam em 74% / Razoável
  select * into r from private.sort_balance(0, 5, 2);
  perform pg_temp.assert_that(r.score = 74 and r.raw_score = 100 and r.label = 'Razoável' and r.capped, 'teto 74% com soma perfeita');
  select * into r from private.sort_balance(0, 5, 1);
  perform pg_temp.assert_that(r.score = 100 and not r.capped, 'diferença de 1 Super Estrela não limita');
  select * into r from private.sort_balance(6, 5, 3);
  perform pg_temp.assert_that(r.score = 70 and not r.capped and r.label = 'Razoável', 'abaixo do teto o score fica como está');
  select * into r from private.sort_balance(7, 5, 2);
  perform pg_temp.assert_that(r.score = 65 and not r.capped, '65% com 2 Super Estrelas de diferença não muda');
  raise notice 'PASS: score e rótulo nas fronteiras 60/75/90 e teto de 74%%';
end $$;

-- ============================================================
-- 5. Motor: Modo 1, Super Estrela, Modo 2 por camada e TODAS
-- ============================================================
do $$
declare
  v_r jsonb;
  v_pl jsonb;
  v_seed integer;
  v_supers integer[];
  v_bad integer := 0;
begin
  -- Estrelas todas iguais: 100%
  v_pl := (select jsonb_agg(jsonb_build_object('id', md5('e' || i)::uuid, 'stars', 3, 'super', false, 'main', 'ANY', 'sec', null))
           from generate_series(1, 10) i);
  v_r := private.sort_teams(v_pl, '{}', 5, false);
  perform pg_temp.assert_that((v_r -> 'balance' ->> 'score')::numeric = 100, 'elenco igual dá 100%');

  -- Super Estrela: com no máximo uma por Time, a diferença fica em <= 1 em todo cenário
  for v_seed in 1..200 loop
    v_supers := array[1 + v_seed % 15, 1 + (v_seed * 4 + 1) % 15, 1 + (v_seed * 11 + 2) % 15];
    v_r := pg_temp.sort(pg_temp.line(15, v_supers), 0, 5, false, null, v_seed / 300.0);
    if (v_r -> 'balance' ->> 'super_diff')::integer > 1 then
      v_bad := v_bad + 1;
    end if;
    -- aviso <=> diferença >= 2; o teto só vale com diferença >= 2
    perform pg_temp.assert_that((jsonb_array_length(v_r -> 'super_warning') > 0) = ((v_r -> 'balance' ->> 'super_diff')::integer >= 2),
      'aviso só com diferença >= 2');
  end loop;
  perform pg_temp.assert_that(v_bad = 0, format('Super Estrela diff > 1 em %s de 200 cenários', v_bad));
  -- 3 Super Estrelas em 3 Times: uma por Time
  v_r := pg_temp.sort(pg_temp.line(15, array[1, 2, 3]), 0, 5, false, null, 0.11);
  perform pg_temp.assert_that((select bool_and((t ->> 'super_count')::integer = 1) from jsonb_array_elements(v_r -> 'teams') t),
    '3 Super Estrelas, 3 Times: uma por Time');
  raise notice 'PASS: Super Estrela espalhada (diferença <= 1 em 200 cenários) e aviso coerente';

  -- Modo 2, ajuste fino não cruza camadas: 3 Super Estrelas na camada FORWARD e a DEFENDER
  -- (1 pessoa). Na serpentina contínua caíam 3 contra 1; no preenchimento por camada (ADR 0036)
  -- cada FORWARD vai para o Time com menos FORWARD (empate, o mais vazio) e sai 2 contra 2, sem aviso
  v_pl := jsonb_build_array(
    jsonb_build_object('id', md5('q1')::uuid, 'stars', 5, 'super', true, 'main', 'DEFENDER', 'sec', null),
    jsonb_build_object('id', md5('q2')::uuid, 'stars', 3, 'super', false, 'main', 'MIDFIELDER', 'sec', null),
    jsonb_build_object('id', md5('q3')::uuid, 'stars', 3, 'super', false, 'main', 'MIDFIELDER', 'sec', null),
    jsonb_build_object('id', md5('q4')::uuid, 'stars', 5, 'super', true, 'main', 'FORWARD', 'sec', null),
    jsonb_build_object('id', md5('q5')::uuid, 'stars', 4, 'super', true, 'main', 'FORWARD', 'sec', null),
    jsonb_build_object('id', md5('q6')::uuid, 'stars', 3, 'super', true, 'main', 'FORWARD', 'sec', null));
  v_r := private.sort_teams(v_pl, '{}', 3, true, null, 0.6);
  perform pg_temp.assert_that((v_r -> 'balance' ->> 'super_diff')::integer = 0
    and jsonb_array_length(v_r -> 'super_warning') = 0,
    'preenchimento por camada separa as Super Estrelas: diferença 0 e nenhum aviso');

  -- Modo 2 por camada: 6 DEF + 6 MEI (secundária ATA), 2 Times de 6 => 3 + 3 em cada Time
  for v_seed in 1..50 loop
    v_pl := (select jsonb_agg(jsonb_build_object('id', md5('c' || i)::uuid, 'stars', 1 + (i * v_seed) % 5, 'super', false,
              'main', case when i <= 6 then 'DEFENDER' else 'MIDFIELDER' end, 'sec', 'FORWARD') order by i)
             from generate_series(1, 12) i);
    v_r := private.sort_teams(v_pl, '{}', 6, true, null, v_seed / 100.0);
    perform pg_temp.assert_that(
      (select bool_and(d = 3 and m = 3) from (
        select count(*) filter (where p ->> 'main' = 'DEFENDER') d, count(*) filter (where p ->> 'main' = 'MIDFIELDER') m
        from jsonb_array_elements(v_r -> 'teams') t
        cross join lateral jsonb_array_elements_text(t -> 'player_ids') x
        join jsonb_array_elements(v_pl) p on p ->> 'id' = x
        group by t ->> 'index') s),
      'Modo 2: cada Time com 3 defensores e 3 meias');
  end loop;

  -- secundária entra no draft: 3 DEF (sec MEI) + 3 MEI (sec ATA), 2 Times de 3 => nenhum Time sem setor
  v_pl := (select jsonb_agg(jsonb_build_object('id', md5('s' || i)::uuid, 'stars', 3, 'super', false,
            'main', case when i <= 3 then 'DEFENDER' else 'MIDFIELDER' end,
            'sec', case when i <= 3 then 'MIDFIELDER' else 'FORWARD' end) order by i)
           from generate_series(1, 6) i);
  for v_seed in 1..30 loop
    v_r := private.sort_teams(v_pl, '{}', 3, true, null, v_seed / 100.0);
    perform pg_temp.assert_that(
      (select bool_and(d >= 1 and m >= 1) from (
        select count(*) filter (where p ->> 'main' = 'DEFENDER') d, count(*) filter (where p ->> 'main' = 'MIDFIELDER') m
        from jsonb_array_elements(v_r -> 'teams') t
        cross join lateral jsonb_array_elements_text(t -> 'player_ids') x
        join jsonb_array_elements(v_pl) p on p ->> 'id' = x
        group by t ->> 'index') s),
      'a secundária equilibra o setor: nenhum Time sem defensor ou sem meia');
  end loop;

  -- TODAS (decisão do dono): vai para o Time com vaga e menor soma, sem olhar setor
  v_pl := (select jsonb_agg(jsonb_build_object('id', md5('a' || i)::uuid, 'stars', s, 'super', false, 'main', 'ANY', 'sec', null) order by i)
           from (values (1, 5), (2, 5), (3, 4), (4, 4), (5, 3), (6, 3), (7, 2), (8, 2), (9, 1), (10, 1)) v(i, s));
  v_r := private.sort_teams(v_pl, '{}', 5, true, null, 0.2);
  perform pg_temp.assert_that((v_r -> 'balance' ->> 'diff')::integer = 0 and pg_temp.sizes(v_r) = array[5, 5],
    'Modo 2 só com TODAS: 15 contra 15');
  -- misto: TODAS preenche onde falta e todos os Times ficam cheios
  v_pl := pg_temp.line(18, '{}', true);
  v_r := pg_temp.sort(v_pl, 0, 6, true, null, 0.4);
  perform pg_temp.assert_that(pg_temp.sizes(v_r) = array[6, 6, 6] and pg_temp.given(v_pl) = pg_temp.placed(v_r),
    'Modo 2 com TODAS: Times cheios e ninguém perdido');
  raise notice 'PASS: Modo 2 por camada, secundária e TODAS';
end $$;

-- ============================================================
-- 6. Exemplos fixos do protótipo (.scratch/sorteio/examples.json): mesma forma, equilíbrio equivalente
-- ============================================================
do $$
declare
  r record;
  v_pl jsonb;
  v_res jsonb;
  v_fixed uuid[];
begin
  for r in
    select * from (values
      ('6-linha-3x3', 5, false, 0, 'p01:3:f:MIDFIELDER:FORWARD p02:5:f:MIDFIELDER:FORWARD p03:3:f:DEFENDER:FORWARD p04:3:f:DEFENDER:FORWARD p05:4:f:DEFENDER:FORWARD p06:1:f:DEFENDER:MIDFIELDER', array[3, 3], false, 0, 1, 0, null),
      ('8-linha-4x4-2gk', 5, false, 2, 'p01:5:t:MIDFIELDER:DEFENDER p02:4:f:DEFENDER:FORWARD p03:4:t:MIDFIELDER:DEFENDER p04:2:f:FORWARD:MIDFIELDER p05:4:f:MIDFIELDER:FORWARD p06:5:f:FORWARD:DEFENDER p07:5:f:DEFENDER:MIDFIELDER p08:2:f:DEFENDER:MIDFIELDER', array[4, 4], true, 0, 1, 0, null),
      ('11-linha-sobra-3gk-rodizio', 5, false, 3, 'p01:1:f:DEFENDER:MIDFIELDER p02:1:f:DEFENDER:MIDFIELDER p03:5:f:MIDFIELDER:FORWARD p04:2:t:FORWARD:DEFENDER p05:2:f:MIDFIELDER:FORWARD p06:1:f:MIDFIELDER:FORWARD p07:4:t:DEFENDER:MIDFIELDER p08:4:f:DEFENDER:MIDFIELDER p09:2:f:DEFENDER:MIDFIELDER p10:2:f:DEFENDER:FORWARD p11:4:f:DEFENDER:MIDFIELDER', array[5, 5, 1], true, 0, 0, 0, null),
      ('25-linha-5-times-2gk', 5, false, 2, 'p01:1:f:DEFENDER:MIDFIELDER p02:1:f:MIDFIELDER:FORWARD p03:2:f:FORWARD:DEFENDER p04:1:f:FORWARD:DEFENDER p05:3:f:DEFENDER:FORWARD p06:4:f:DEFENDER:MIDFIELDER p07:2:f:FORWARD:MIDFIELDER p08:5:f:MIDFIELDER:DEFENDER p09:1:f:DEFENDER:FORWARD p10:1:f:DEFENDER:FORWARD p11:1:t:DEFENDER:FORWARD p12:4:t:MIDFIELDER:FORWARD p13:2:t:MIDFIELDER:DEFENDER p14:1:f:MIDFIELDER:DEFENDER p15:4:f:MIDFIELDER:DEFENDER p16:1:f:DEFENDER:FORWARD p17:2:f:DEFENDER:MIDFIELDER p18:2:f:DEFENDER:MIDFIELDER p19:5:f:DEFENDER:FORWARD p20:3:f:DEFENDER:FORWARD p21:4:f:MIDFIELDER:DEFENDER p22:2:f:DEFENDER:FORWARD p23:3:f:ANY:- p24:2:f:DEFENDER:FORWARD p25:5:f:MIDFIELDER:FORWARD', array[5, 5, 5, 5, 5], false, 2, 1, 1, null),
      ('30-linha-6-times-6gk', 5, false, 6, 'p01:5:f:MIDFIELDER:DEFENDER p02:2:f:DEFENDER:MIDFIELDER p03:1:f:DEFENDER:FORWARD p04:2:f:DEFENDER:MIDFIELDER p05:5:f:ANY:- p06:2:f:FORWARD:DEFENDER p07:1:t:DEFENDER:MIDFIELDER p08:4:t:DEFENDER:MIDFIELDER p09:2:f:MIDFIELDER:FORWARD p10:1:f:MIDFIELDER:FORWARD p11:1:f:MIDFIELDER:DEFENDER p12:5:f:DEFENDER:FORWARD p13:4:t:MIDFIELDER:FORWARD p14:5:t:DEFENDER:MIDFIELDER p15:4:f:DEFENDER:FORWARD p16:5:f:DEFENDER:FORWARD p17:2:f:DEFENDER:FORWARD p18:2:f:FORWARD:DEFENDER p19:3:f:FORWARD:DEFENDER p20:5:f:DEFENDER:FORWARD p21:1:f:MIDFIELDER:FORWARD p22:5:f:DEFENDER:FORWARD p23:3:f:MIDFIELDER:DEFENDER p24:3:f:FORWARD:MIDFIELDER p25:4:f:FORWARD:DEFENDER p26:5:f:FORWARD:DEFENDER p27:4:f:DEFENDER:MIDFIELDER p28:5:f:MIDFIELDER:DEFENDER p29:3:f:DEFENDER:FORWARD p30:1:f:DEFENDER:MIDFIELDER', array[5, 5, 5, 5, 5, 5], true, 0, 1, 1, null),
      ('18-posicao-todas-super', 6, true, 4, 'p01:2:f:DEFENDER:MIDFIELDER p02:3:f:FORWARD:DEFENDER p03:3:t:FORWARD:DEFENDER p04:3:f:DEFENDER:FORWARD p05:2:f:FORWARD:DEFENDER p06:1:f:FORWARD:MIDFIELDER p07:4:f:DEFENDER:FORWARD p08:3:f:DEFENDER:FORWARD p09:1:f:FORWARD:DEFENDER p10:1:f:FORWARD:MIDFIELDER p11:4:f:MIDFIELDER:DEFENDER p12:4:t:MIDFIELDER:FORWARD p13:5:f:DEFENDER:FORWARD p14:3:t:MIDFIELDER:DEFENDER p15:5:f:DEFENDER:FORWARD p16:2:f:DEFENDER:MIDFIELDER p17:4:f:DEFENDER:MIDFIELDER p18:1:f:MIDFIELDER:DEFENDER', array[6, 6, 6], true, 1, 0, 0, null),
      ('13-posicao-sobras-fixas', 4, true, 1, 'p01:1:f:MIDFIELDER:DEFENDER p02:2:f:FORWARD:MIDFIELDER p03:4:t:DEFENDER:FORWARD p04:2:f:DEFENDER:MIDFIELDER p05:4:f:MIDFIELDER:DEFENDER p06:4:f:DEFENDER:FORWARD p07:4:f:MIDFIELDER:FORWARD p08:1:f:DEFENDER:MIDFIELDER p09:2:t:FORWARD:DEFENDER p10:4:f:MIDFIELDER:DEFENDER p11:5:f:DEFENDER:MIDFIELDER p12:2:f:ANY:- p13:4:f:DEFENDER:MIDFIELDER', array[4, 4, 4, 1], false, 1, 1, 1, array['p03']),
      ('9-linha-divisao-5x4', 5, true, 0, 'p01:3:f:MIDFIELDER:DEFENDER p02:3:f:FORWARD:MIDFIELDER p03:1:f:DEFENDER:FORWARD p04:3:t:DEFENDER:MIDFIELDER p05:4:f:DEFENDER:MIDFIELDER p06:4:f:FORWARD:MIDFIELDER p07:1:f:DEFENDER:FORWARD p08:5:f:DEFENDER:MIDFIELDER p09:1:f:MIDFIELDER:DEFENDER', array[5, 4], false, 0, 1, 1, null)
    ) as x(name, l, pos, gk, players, sizes, per_team, queue_len, ref_diff, ref_super_diff, fixed)
  loop
    select jsonb_agg(jsonb_build_object(
      'id', md5(split_part(p, ':', 1))::uuid, 'stars', split_part(p, ':', 2)::integer,
      'super', split_part(p, ':', 3) = 't', 'main', split_part(p, ':', 4),
      'sec', nullif(split_part(p, ':', 5), '-')))
    into v_pl from unnest(string_to_array(r.players, ' ')) p;
    v_fixed := case when r.fixed is null then null else array(select md5(f)::uuid from unnest(r.fixed) f) end;

    v_res := private.sort_teams(v_pl, array(select md5('g' || i)::uuid from generate_series(1, r.gk) i),
      r.l, r.pos, v_fixed, 0.5);
    perform pg_temp.assert_that(pg_temp.sizes(v_res) = r.sizes, format('%s: formação %s', r.name, pg_temp.sizes(v_res)));
    perform pg_temp.assert_that((v_res -> 'goalkeepers' ->> 'per_team')::boolean = r.per_team
      and jsonb_array_length(v_res -> 'goalkeepers' -> 'queue') = r.queue_len, r.name || ': Goleiros');
    perform pg_temp.assert_that(pg_temp.given(v_pl) = pg_temp.placed(v_res), r.name || ': ninguém perdido');
    -- o RNG é outro: aceita-se no máximo 1 ponto a mais que a referência do TS
    perform pg_temp.assert_that((v_res -> 'balance' ->> 'diff')::integer <= r.ref_diff + 1
      and (v_res -> 'balance' ->> 'super_diff')::integer <= greatest(r.ref_super_diff, 1),
      format('%s: diferença %s (ref %s), super %s (ref %s)', r.name, v_res -> 'balance' ->> 'diff', r.ref_diff,
        v_res -> 'balance' ->> 'super_diff', r.ref_super_diff));
    if v_fixed is not null then
      perform pg_temp.assert_that(v_res -> 'leftovers' = to_jsonb(v_fixed), r.name || ': sobra fixa');
    end if;
  end loop;
  raise notice 'PASS: 8 exemplos fixos do protótipo (forma, Goleiros e equilíbrio equivalentes)';
end $$;

-- ============================================================
-- 7. Banco: grants, RLS e constraints
-- ============================================================
do $$
declare
  v_fn text;
  v_tbl text;
  v_priv text;
begin
  foreach v_fn in array array[
    'public.prepare_event_sort(uuid)', 'public.confirm_event_sort(uuid, integer)',
    'public.swap_event_sort_goalkeepers(uuid, integer, uuid, uuid)',
    'public.get_event_sort_proposal(uuid)', 'public.get_event_sort(uuid)'] loop
    perform pg_temp.assert_that(has_function_privilege('authenticated', v_fn, 'execute'), v_fn || ' para authenticated');
    perform pg_temp.assert_that(not has_function_privilege('anon', v_fn, 'execute'), v_fn || ' negada a anon');
  end loop;
  foreach v_fn in array array[
    'private.sort_teams(jsonb, uuid[], integer, boolean, uuid[], double precision)',
    'private.event_sort_roster(uuid)', 'private.event_sort_proposal_json(uuid)',
    'private.event_sort_published_json(uuid)', 'private.sort_balance(integer, integer, integer)'] loop
    perform pg_temp.assert_that(not has_function_privilege('authenticated', v_fn, 'execute')
      and not has_function_privilege('anon', v_fn, 'execute'), v_fn || ' sem grant a clientes');
  end loop;
  foreach v_tbl in array array['event_sort', 'event_sort_team', 'event_sort_team_player', 'event_sort_goalkeeper'] loop
    perform pg_temp.assert_that((select relrowsecurity from pg_class where oid = ('public.' || v_tbl)::regclass), v_tbl || ' com RLS');
    perform pg_temp.assert_that(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tbl),
      v_tbl || ' sem policies');
    foreach v_priv in array array['select', 'insert', 'update', 'delete'] loop
      perform pg_temp.assert_that(not has_table_privilege('authenticated', 'public.' || v_tbl, v_priv)
        and not has_table_privilege('anon', 'public.' || v_tbl, v_priv), v_tbl || ' sem ' || v_priv);
    end loop;
  end loop;
  raise notice 'PASS: grants, RLS ligada sem policies e funções privadas fechadas';
end $$;

-- Auditoria estática: toda função pública que escreve em Membro, Presença, Avulso ou Evento
-- toma a trava do Racha (for update no Racha ou lock_event_for_attendance) antes de gravar.
do $$
declare
  v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and p.prosrc ~* '(insert into|update|delete from)\s+public\.(member|event|event_attendance|event_guest)\y'
    and p.prosrc !~* 'from public\.racha r[^;]*for update'
    and p.prosrc !~* 'lock_event_for_attendance'
    -- lock_event_match chama lock_event_for_attendance antes de travar a Partida
    and p.prosrc !~* 'lock_event_match'
    -- create_racha cria o Racha e o Dono (não há Evento nem elenco a proteger);
    -- o gatilho abaixo só roda dentro de update_member/expel_member/leave_racha, já travados
    and p.proname not in ('create_racha', 'clear_ineligible_upcoming_conductor');
  perform pg_temp.assert_that(v_bad is null, 'escrita sem trava do Racha em: ' || coalesce(v_bad, ''));
  raise notice 'PASS: auditoria de trava do Racha nas funções que mudam Membro, Presença, Avulso e Evento';
end $$;

-- ============================================================
-- 8. RPCs: fluxo completo com Racha, Condutor, elenco e dois aparelhos
-- ============================================================
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_x uuid := gen_random_uuid();
  v_p uuid[] := array(select gen_random_uuid() from generate_series(1, 12));
  v_g uuid[] := array(select gen_random_uuid() from generate_series(1, 4));
  v_names text[] := array['Ana', 'Bia', 'Caio', 'Davi', 'Eva', 'Fabio', 'Gil', 'Hugo', 'Ivo', 'Jose', 'Kaio', 'Lia'];
  v_racha uuid;
  v_event uuid;
  v_guest uuid;
  v_future date := current_date + 14;
  v_i integer;
  v_pr jsonb;
  v_pr2 jsonb;
  v_pub jsonb;
  v_pub2 jsonb;
  v_ver integer;
  v_left uuid[];
  v_left_prev uuid[];
  v_msg text;
  v_q jsonb;
  v_before jsonb;
  v_after jsonb;
  v_member_stars smallint;
  v_n integer;
begin
  insert into auth.users (id, raw_user_meta_data)
  select u.id, jsonb_build_object('display_name', u.name, 'birth_date', '1990-01-01',
    'plays_as', 'OUTFIELD', 'primary_position', 'ANY', 'terms_accepted', true)
  from (
    select v_owner as id, 'Dono Sorteio' as name
    union all select v_a, 'Admin Alfa' union all select v_b, 'Admin Beta' union all select v_x, 'Fora Racha'
    union all select v_p[i], v_names[i] from generate_series(1, 12) i
    union all select v_g[i], 'Goleiro ' || v_names[i] from generate_series(1, 4) i
  ) u;

  insert into public.racha (name, invite_code, place, weekday, kickoff_time, spot_limit, outfield_per_team)
  values ('Prova Sorteio', 'ZZZZS2', 'Quadra Sorteio', 1, '19:00', 13, 5)
  returning id into v_racha;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, secondary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', null, 3),
         (v_racha, v_a, 'ADMIN', 'OUTFIELD', 'ANY', null, 3),
         (v_racha, v_b, 'ADMIN', 'OUTFIELD', 'ANY', null, 3);
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, secondary_position, stars, is_super_star)
  select v_racha, v_p[i], 'PLAYER', 'OUTFIELD',
    case when i % 2 = 1 then 'DEFENDER' else 'FORWARD' end::public.position,
    case when i % 2 = 1 then 'MIDFIELDER' else 'DEFENDER' end::public.position,
    (array[5, 4, 4, 3, 3, 3, 2, 2, 1, 1, 3, 3])[i], i = 1
  from generate_series(1, 12) i;
  insert into public.member (racha_id, profile_id, role, plays_as)
  select v_racha, v_g[i], 'PLAYER', 'GOALKEEPER' from generate_series(1, 4) i;

  insert into public.event (
    racha_id, starts_on, starts_at, place, status, spot_limit, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule, tie_return_order,
    consider_position, match_duration_min)
  select r.id, v_future, time '19:00', 'Quadra Sorteio', 'upcoming', 13, r.reminder_lead_hours,
    r.outfield_per_team, r.game_mode, r.max_consecutive_wins, r.tie_rule, r.tie_return_order,
    false, r.match_duration_min
  from public.racha r where r.id = v_racha
  returning id into v_event;

  -- ---------- autorização ----------
  perform set_config('request.jwt.claim.sub', v_x::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('select public.prepare_event_sort(%L)', v_event)) = 'not_member', 'não Membro não prepara');
  perform pg_temp.assert_that(pg_temp.err(format('select public.get_event_sort_proposal(%L)', v_event)) = 'not_member', 'não Membro não lê proposta');
  perform pg_temp.assert_that(pg_temp.err(format('select public.get_event_sort(%L)', v_event)) = 'not_member', 'não Membro não lê os Times');
  perform set_config('request.jwt.claim.sub', v_p[1]::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('select public.prepare_event_sort(%L)', v_event)) = 'not_conductor', 'Jogador não prepara');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('select public.prepare_event_sort(%L)', v_event)) = 'not_conductor',
    'Dono sem condução não prepara');
  perform public.assume_event_conduction(v_event);
  perform pg_temp.assert_that(pg_temp.err(format('select public.prepare_event_sort(%L)', v_event)) = 'not_enough_players',
    'sem elenco: not_enough_players');
  raise notice 'PASS: autorização (não Membro, Jogador, Dono sem condução)';

  -- ---------- elenco: 10 Membros + 1 Avulso (11 de linha), 2 Goleiros, 1 na fila ----------
  for v_i in 1..10 loop
    perform set_config('request.jwt.claim.sub', v_p[v_i]::text, true);
    perform public.confirm_attendance(v_event);
  end loop;
  for v_i in 1..2 loop
    perform set_config('request.jwt.claim.sub', v_g[v_i]::text, true);
    perform public.confirm_attendance(v_event);
  end loop;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_guest := public.add_guest(v_event, 'Avulso Alfa', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  perform set_config('request.jwt.claim.sub', v_p[11]::text, true);
  perform public.confirm_attendance(v_event);
  perform pg_temp.assert_that((select status from public.event_attendance where event_id = v_event and profile_id = v_p[11]) = 'waitlisted',
    'o 14º entra na fila');

  -- proposta ainda inexistente
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_pr := public.get_event_sort_proposal(v_event);
  perform pg_temp.assert_that(v_pr ->> 'state' = 'none' and (v_pr ->> 'line_count')::integer = 11
    and (v_pr ->> 'goalkeeper_count')::integer = 2 and (v_pr ->> 'can_sort')::boolean, 'antes de sortear: contagens e state none');

  -- ---------- preparar ----------
  v_pr := public.prepare_event_sort(v_event);
  perform pg_temp.assert_that(v_pr ->> 'state' = 'ready' and (v_pr ->> 'version')::integer = 1, 'primeira proposta, versão 1');
  perform pg_temp.assert_that(jsonb_array_length(v_pr -> 'teams') = 3, '11 de linha: 3 Times');
  perform pg_temp.assert_that((select array_agg((t ->> 'player_count')::integer order by (t ->> 'team_number')::integer)
    from jsonb_array_elements(v_pr -> 'teams') t) = array[5, 5, 1], 'tamanhos 5, 5 e 1');
  perform pg_temp.assert_that((select count(*) from public.event_sort_team_player where event_id = v_event) = 11
    and not (v_pr ->> 'goalkeepers_per_team')::boolean
    and jsonb_array_length(v_pr -> 'goalkeeper_queue') = 2, 'rascunho persistido: 11 de linha e fila do gol com 2');
  perform pg_temp.assert_that((select status from public.event where id = v_event) = 'upcoming', 'rascunho não ativa o Evento');
  -- a waitlist e o Condutor ficam fora do rascunho
  perform pg_temp.assert_that(not exists (select 1 from public.event_sort_team_player where event_id = v_event and profile_id = v_p[11]),
    'quem está na fila não entra nos Times');

  -- dois aparelhos veem a mesma proposta; Jogador não vê rascunho nenhum
  v_pr2 := public.get_event_sort_proposal(v_event);
  perform pg_temp.assert_that(v_pr = v_pr2, 'duas leituras da proposta são idênticas');
  perform set_config('request.jwt.claim.sub', v_p[1]::text, true);
  perform pg_temp.assert_that(public.get_event_sort(v_event) ->> 'state' = 'none', 'rascunho invisível à leitura pública');
  perform pg_temp.assert_that(pg_temp.err(format('select public.get_event_sort_proposal(%L)', v_event)) = 'not_conductor', 'Jogador não lê a proposta');
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform pg_temp.assert_that(public.get_event_sort(v_event) ->> 'state' = 'none', 'Admin sem condução também não vê o rascunho');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  raise notice 'PASS: preparar gera e guarda a proposta; dois aparelhos veem a mesma; rascunho invisível';

  -- ---------- sobra fixa ----------
  select leftover_ids into v_left_prev from public.event_sort where event_id = v_event;
  perform pg_temp.assert_that(cardinality(v_left_prev) = 1, 'uma sobra');
  for v_i in 1..25 loop
    v_pr2 := public.prepare_event_sort(v_event);
    select leftover_ids into v_left from public.event_sort where event_id = v_event;
    perform pg_temp.assert_that(v_left = v_left_prev, 'sobra mudou no re-sorteio');
    perform pg_temp.assert_that(jsonb_array_length(v_pr2 -> 'teams' -> 2 -> 'players') = 1
      and coalesce(v_pr2 -> 'teams' -> 2 -> 'players' -> 0 ->> 'profile_id', v_pr2 -> 'teams' -> 2 -> 'players' -> 0 ->> 'guest_id')
        = v_left_prev[1]::text, 'o Time incompleto é a pessoa da sobra');
  end loop;
  perform pg_temp.assert_that((v_pr2 ->> 'version')::integer = 26, 'cada re-sorteio sobe a versão');
  perform pg_temp.assert_that((select count(*) from public.event_sort where event_id = v_event) = 1
    and (select count(*) from public.event_sort_team where event_id = v_event) = 3
    and (select count(*) from public.event_sort_team_player where event_id = v_event) = 11, 're-sortear troca, não acumula');
  raise notice 'PASS: sobra fixa em 25 re-sorteios';

  -- ---------- assinatura: cada campo invalida ----------
  -- (a ordem dos campos: presença, Onde joga, Estrelas, Super Estrela, Posição, Avulso, configuração)
  v_ver := (v_pr2 ->> 'version')::integer;

  -- presença: cancelar um confirmado
  perform set_config('request.jwt.claim.sub', v_p[10]::text, true);
  perform public.cancel_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'presença cancelada invalida');
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_event_sort(%L, %s)', v_event, v_ver)) = 'roster_changed',
    'confirmar proposta obsoleta: roster_changed');
  -- a fila promovida ao abrir vaga também muda o elenco: P11 sobe e o stale continua
  perform pg_temp.assert_that((select status from public.event_attendance where event_id = v_event and profile_id = v_p[11]) = 'confirmed',
    'vaga aberta promove a fila (Presença livre antes do Sorteio)');
  v_pr2 := public.prepare_event_sort(v_event);
  perform pg_temp.assert_that(v_pr2 ->> 'state' = 'ready' and (v_pr2 ->> 'version')::integer = v_ver + 1, 'nova assinatura: sorteia de novo');
  select leftover_ids into v_left from public.event_sort where event_id = v_event;
  perform pg_temp.assert_that(cardinality(v_left) = 1, 'a nova assinatura reescolhe a sobra (11 de linha de novo)');
  v_ver := (v_pr2 ->> 'version')::integer;

  -- presença: o mesmo elenco de antes volta a valer? não: assinatura nova. Cancela e reconfirma P11 mantém ready só se igual.
  -- Onde joga: P2 passa a Goleiro (e volta)
  update public.member set plays_as = 'GOALKEEPER', stars = null, primary_position = null, secondary_position = null,
    is_super_star = false where racha_id = v_racha and profile_id = v_p[2];
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'Onde joga invalida');
  update public.member set plays_as = 'OUTFIELD', stars = 4, primary_position = 'FORWARD', secondary_position = 'DEFENDER'
    where racha_id = v_racha and profile_id = v_p[2];
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'ready',
    'voltar ao mesmo elenco restaura a assinatura da proposta');

  -- Estrelas e Super Estrela (RPC do Admin)
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.update_member(v_racha, v_p[3], 5::smallint, false, null);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'Estrelas invalidam');
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.update_member(v_racha, v_p[3], 4::smallint, false, null);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'ready', 'Estrelas restauradas');
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.update_member(v_racha, v_p[3], 4::smallint, true, null);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'Super Estrela invalida');
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.update_member(v_racha, v_p[3], 4::smallint, false, null);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  -- Posição principal e secundária
  update public.member set primary_position = 'MIDFIELDER' where racha_id = v_racha and profile_id = v_p[4];
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'Posição principal invalida');
  update public.member set primary_position = 'FORWARD' where racha_id = v_racha and profile_id = v_p[4];
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'ready', 'Posição restaurada');
  update public.member set secondary_position = 'MIDFIELDER' where racha_id = v_racha and profile_id = v_p[4];
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'Posição secundária invalida');
  update public.member set secondary_position = 'DEFENDER' where racha_id = v_racha and profile_id = v_p[4];

  -- Avulso: atributos, remoção e novo
  update public.event_guest set stars = 5 where id = v_guest;
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'Estrelas do Avulso invalidam');
  update public.event_guest set stars = 3 where id = v_guest;
  update public.event_guest set is_super_star = true where id = v_guest;
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'Super Estrela do Avulso invalida');
  update public.event_guest set is_super_star = false where id = v_guest;
  update public.event_guest set primary_position = 'FORWARD', secondary_position = 'DEFENDER' where id = v_guest;
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'Posição do Avulso invalida');
  update public.event_guest set primary_position = 'ANY', secondary_position = null where id = v_guest;
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'ready', 'Avulso restaurado');
  perform public.remove_guest(v_guest);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'remover Avulso invalida');
  -- sem o Avulso e com P11 promovida, o elenco é 10 Membros + P11 = 11 de linha de novo; novo Avulso muda
  v_guest := public.add_guest(v_event, 'Avulso Beta', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'novo Avulso invalida');

  -- configuração do Sorteio no Evento
  v_pr2 := public.prepare_event_sort(v_event);
  v_ver := (v_pr2 ->> 'version')::integer;
  update public.event set consider_position = true where id = v_event;
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'Considerar Posição invalida');
  update public.event set consider_position = false where id = v_event;
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'ready', 'configuração restaurada');
  update public.event set outfield_per_team = 6 where id = v_event;
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'Quantidade de linha invalida');
  update public.event set outfield_per_team = 5 where id = v_event;

  -- o que NÃO invalida: fila, nome e did_attend
  update public.profile set display_name = 'Ana Renomeada' where id = v_p[1];
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_attendance_attended(v_event, v_p[1], null, true);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'ready', 'nome e comparecimento não invalidam');
  raise notice 'PASS: presença, Onde joga, Estrelas, Super Estrela, Posição, Avulso e configuração invalidam a proposta';

  -- ---------- modo Posição no RPC ----------
  update public.event set consider_position = true where id = v_event;
  v_pr2 := public.prepare_event_sort(v_event);
  perform pg_temp.assert_that(v_pr2 ->> 'state' = 'ready' and jsonb_array_length(v_pr2 -> 'teams') = 3,
    'Sorteio com Posição pelo RPC');
  perform pg_temp.assert_that((select count(*) from public.event_sort_team_player
      where event_id = v_event and primary_position_snapshot is not null) = 11, 'snapshot de Posição gravado');
  update public.event set consider_position = false where id = v_event;
  v_pr2 := public.prepare_event_sort(v_event);
  v_ver := (v_pr2 ->> 'version')::integer;

  -- ---------- troca de Goleiros (rodízio) ----------
  v_before := v_pr2 -> 'teams';
  v_q := v_pr2 -> 'goalkeeper_queue';
  perform pg_temp.assert_that(pg_temp.err(format('select public.swap_event_sort_goalkeepers(%L, %s, %L, %L)',
    v_event, v_ver - 1, v_g[1], v_g[2])) = 'proposal_outdated', 'troca com versão antiga recusada');
  perform pg_temp.assert_that(pg_temp.err(format('select public.swap_event_sort_goalkeepers(%L, %s, %L, %L)',
    v_event, v_ver, v_g[1], v_g[3])) = 'goalkeeper_not_found', 'troca com Goleiro fora da proposta recusada');
  v_pr2 := public.swap_event_sort_goalkeepers(v_event, v_ver, v_g[1], v_g[2]);
  perform pg_temp.assert_that(v_pr2 -> 'teams' = v_before, 'trocar Goleiros não mexe na linha');
  perform pg_temp.assert_that((v_pr2 -> 'goalkeeper_queue' -> 0 ->> 'profile_id') = (v_q -> 1 ->> 'profile_id')
    and (v_pr2 -> 'goalkeeper_queue' -> 1 ->> 'profile_id') = (v_q -> 0 ->> 'profile_id'), 'a fila do gol inverteu');
  perform pg_temp.assert_that((v_pr2 ->> 'version')::integer = v_ver + 1, 'troca sobe a versão');
  perform set_config('request.jwt.claim.sub', v_p[1]::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('select public.swap_event_sort_goalkeepers(%L, %s, %L, %L)',
    v_event, v_ver + 1, v_g[1], v_g[2])) = 'not_conductor', 'só o Condutor troca Goleiros');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  -- Goleiros por Time: 4 Goleiros >= 3 Times (a chegada de 2 muda o elenco), troca Time x fila
  for v_i in 3..4 loop
    perform set_config('request.jwt.claim.sub', v_g[v_i]::text, true);
    perform public.confirm_attendance(v_event);
  end loop;
  perform pg_temp.assert_that((select status from public.event_attendance where event_id = v_event and profile_id = v_g[3]) = 'waitlisted',
    'Goleiro também respeita o Limite');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.update_event(v_event, v_future, time '19:00', 'Quadra Sorteio', false, null::integer, 15::smallint, null::integer);
  v_pr2 := public.prepare_event_sort(v_event);
  perform pg_temp.assert_that((v_pr2 ->> 'goalkeeper_count')::integer = 4 and (v_pr2 ->> 'goalkeepers_per_team')::boolean
    and jsonb_array_length(v_pr2 -> 'goalkeeper_queue') = 1, '4 Goleiros em 3 Times: um por Time e 1 na fila');
  v_ver := (v_pr2 ->> 'version')::integer;
  v_q := v_pr2 -> 'goalkeeper_queue' -> 0;
  v_before := (select t -> 'goalkeeper' from jsonb_array_elements(v_pr2 -> 'teams') t where (t ->> 'team_number') = '1');
  v_pr2 := public.swap_event_sort_goalkeepers(v_event, v_ver, (v_before ->> 'profile_id')::uuid, (v_q ->> 'profile_id')::uuid);
  perform pg_temp.assert_that((select t -> 'goalkeeper' ->> 'profile_id' from jsonb_array_elements(v_pr2 -> 'teams') t
      where t ->> 'team_number' = '1') = v_q ->> 'profile_id'
    and v_pr2 -> 'goalkeeper_queue' -> 0 ->> 'profile_id' = v_before ->> 'profile_id', 'Goleiro do Time trocou com o da fila');
  raise notice 'PASS: troca de Goleiros (rodízio e por Time) sem tocar na linha';

  -- ---------- troca de Condutor ----------
  v_ver := (v_pr2 ->> 'version')::integer;
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.assume_event_conduction(v_event);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) = v_pr2, 'novo Condutor lê a mesma proposta');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('select public.get_event_sort_proposal(%L)', v_event)) = 'not_conductor',
    'ex-Condutor perde a leitura do rascunho');
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_event_sort(%L, %s)', v_event, v_ver)) = 'not_conductor',
    'ex-Condutor não confirma');
  perform pg_temp.assert_that(pg_temp.err(format('select public.prepare_event_sort(%L)', v_event)) = 'not_conductor',
    'ex-Condutor não re-sorteia');
  -- Admin Condutor perde o Cargo: a condução cai e ele deixa de confirmar
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.update_member(v_racha, v_a, 3::smallint, false, 'PLAYER');
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_event_sort(%L, %s)', v_event, v_ver)) = 'not_conductor',
    'Admin rebaixado não confirma');
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform public.assume_event_conduction(v_event);
  raise notice 'PASS: troca de Condutor (leitura, re-sorteio e confirmação seguem o Condutor atual)';

  -- ---------- confirmar ----------
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_event_sort(%L, %s)', v_event, v_ver - 1)) = 'proposal_outdated',
    'versão antiga recusada');
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_event_sort(%L, null)', v_event)) = 'proposal_outdated',
    'versão ausente recusada');
  perform pg_temp.assert_that((select status from public.event where id = v_event) = 'upcoming', 'recusas não ativam');

  -- um elenco que mudou entre ver e confirmar
  perform set_config('request.jwt.claim.sub', v_p[9]::text, true);
  perform public.cancel_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_event_sort(%L, %s)', v_event, v_ver)) = 'roster_changed',
    'elenco mudou: roster_changed');
  perform pg_temp.assert_that((select status from public.event where id = v_event) = 'upcoming'
    and (select status from public.event_sort where event_id = v_event) = 'draft', 'recusa não deixa meia confirmação');
  -- P10 volta (ocupa a última vaga) e P12 cai na fila: ficará Aguardando inclusão
  perform set_config('request.jwt.claim.sub', v_p[10]::text, true);
  perform public.confirm_attendance(v_event);
  perform set_config('request.jwt.claim.sub', v_p[12]::text, true);
  perform public.confirm_attendance(v_event);
  perform pg_temp.assert_that((select status from public.event_attendance where event_id = v_event and profile_id = v_p[12]) = 'waitlisted',
    'P12 na fila');
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  v_pr2 := public.prepare_event_sort(v_event);
  v_ver := (v_pr2 ->> 'version')::integer;
  select (jsonb_array_length(v_pr2 -> 'teams')) into v_n;

  v_pub := public.confirm_event_sort(v_event, v_ver);
  perform pg_temp.assert_that(v_pub ->> 'state' = 'published' and (v_pub ->> 'is_conductor')::boolean, 'confirmou');
  perform pg_temp.assert_that((select status from public.event where id = v_event) = 'active', 'Evento virou active');
  perform pg_temp.assert_that((select status from public.event_sort where event_id = v_event) = 'confirmed'
    and (select confirmed_by from public.event_sort where event_id = v_event) = v_b, 'Sorteio confirmado pelo Condutor');
  perform pg_temp.assert_that((select count(*) from public.event_sort_team where event_id = v_event) = v_n
    and (select count(*) from public.event_sort_team_player where event_id = v_event and left_at is null)
      = (select count(*) from public.event_attendance a join public.member m on m.profile_id = a.profile_id and m.racha_id = v_racha
         where a.event_id = v_event and a.status = 'confirmed' and m.plays_as = 'OUTFIELD')
        + (select count(*) from public.event_guest where event_id = v_event and plays_as = 'OUTFIELD'),
    'active só com Times e jogadores persistidos');
  -- a checagem deferida (confirmado => Evento fora de upcoming) passa no fluxo real
  set constraints event_sort_confirmed_needs_started_event immediate;
  set constraints event_sort_confirmed_needs_started_event deferred;
  raise notice 'PASS: confirmar publica e ativa na mesma transação';

  -- confirmação repetida / concorrente (sequencial): a segunda não confirma de novo
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_event_sort(%L, %s)', v_event, v_ver)) = 'already_confirmed',
    'segunda confirmação: already_confirmed');
  perform pg_temp.assert_that(pg_temp.err(format('select public.prepare_event_sort(%L)', v_event)) = 'already_confirmed',
    'não re-sorteia depois de confirmar');
  perform pg_temp.assert_that(pg_temp.err(format('select public.get_event_sort_proposal(%L)', v_event)) = 'already_confirmed',
    'proposta não existe mais depois da confirmação');
  perform pg_temp.assert_that(pg_temp.err(format('select public.swap_event_sort_goalkeepers(%L, %s, %L, %L)', v_event, v_ver, v_g[1], v_g[2]))
    = 'already_confirmed', 'não troca Goleiros depois de confirmar');
  perform pg_temp.assert_that((select count(*) from public.event_sort where event_id = v_event) = 1, 'um Sorteio por Evento');
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.event_sort (event_id, signature, mode, goalkeepers_per_team,
    balance_score, balance_label, balance_diff, super_diff, capped_by_super) values (%L, 'x', 'normal', false, 100, 'Equilibrado', 0, 0, false)$f$, v_event))
    like '%event_sort_pkey%', 'segundo Sorteio para o Evento é barrado pela chave');

  -- ---------- leitura dos Times publicados ----------
  perform set_config('request.jwt.claim.sub', v_p[1]::text, true);
  v_pub2 := public.get_event_sort(v_event);
  perform pg_temp.assert_that(v_pub2 ->> 'state' = 'published' and not (v_pub2 ->> 'is_conductor')::boolean, 'Jogador vê os Times');
  perform pg_temp.assert_that(jsonb_array_length(v_pub2 -> 'waiting_for_inclusion') = 1
    and v_pub2 -> 'waiting_for_inclusion' -> 0 ->> 'profile_id' = v_p[12]::text,
    'Aguardando inclusão lista quem estava na fila');
  perform pg_temp.assert_that((v_pub2 -> 'balance' ->> 'label') is not null and (v_pub2 -> 'balance' ->> 'score')::numeric between 0 and 100,
    'score e rótulo confirmados na leitura');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_temp.assert_that((public.get_event_sort(v_event) - 'is_conductor' - 'viewer') = (v_pub2 - 'is_conductor' - 'viewer'),
    'Dono que não conduz recebe os mesmos Times que o Jogador');
  perform pg_temp.assert_that(pg_temp.err(format('select public.prepare_event_sort(%L)', v_event)) = 'not_conductor',
    'Dono que não conduz não muta');
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform pg_temp.assert_that((public.get_event_sort(v_event) ->> 'is_conductor')::boolean, 'Condutor identificado na leitura');
  perform set_config('request.jwt.claim.sub', v_x::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('select public.get_event_sort(%L)', v_event)) = 'not_member', 'leitura negada a não Membro');
  -- snapshot: editar Estrelas depois não muda os Times publicados
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_before := public.get_event_sort(v_event) -> 'teams';
  perform public.update_member(v_racha, v_p[1], 1::smallint, false, null);
  perform pg_temp.assert_that(public.get_event_sort(v_event) -> 'teams' = v_before, 'Estrelas editadas depois não alteram o retrato');
  raise notice 'PASS: leitura publicada igual para Dono, Admin e Jogador, snapshots preservados, não Membro negado';
end $$;

-- ============================================================
-- 9. Constraints do banco e Evento legado
-- ============================================================
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_p uuid[] := array(select gen_random_uuid() from generate_series(1, 7));
  v_names text[] := array['Ana', 'Bia', 'Caio', 'Davi', 'Eva', 'Fabio', 'Gil'];
  v_racha uuid;
  v_event uuid;
  v_event2 uuid;
  v_team1 uuid;
  v_team2 uuid;
  v_guest uuid;
  v_i integer;
  v_future date := current_date + 20;
begin
  insert into auth.users (id, raw_user_meta_data)
  select u.id, jsonb_build_object('display_name', u.name, 'birth_date', '1990-01-01',
    'plays_as', 'OUTFIELD', 'primary_position', 'ANY', 'terms_accepted', true)
  from (select v_owner as id, 'Dono Constraints' as name
        union all select v_p[i], v_names[i] from generate_series(1, 7) i) u;
  insert into public.racha (name, invite_code, place, outfield_per_team, spot_limit)
  values ('Prova Constraints', 'ZZZZS3', 'Quadra C', 3, 10) returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  select v_racha, case when i = 0 then v_owner else v_p[i] end, case when i = 0 then 'OWNER' else 'PLAYER' end::public.member_role,
    'OUTFIELD', 'ANY', 3 from generate_series(0, 7) i;
  insert into public.event (racha_id, starts_on, starts_at, place, status, spot_limit, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule, tie_return_order, consider_position)
  select r.id, v_future, time '19:00', 'Quadra C', 'upcoming', 10, r.reminder_lead_hours, 3, r.game_mode,
    r.max_consecutive_wins, r.tie_rule, r.tie_return_order, false from public.racha r where r.id = v_racha
  returning id into v_event;
  v_guest := gen_random_uuid();
  insert into public.event_guest (id, event_id, display_name, plays_as, primary_position, stars)
  values (v_guest, v_event, 'Avulso Teste', 'OUTFIELD', 'ANY', 3);

  insert into public.event_sort (event_id, signature, mode, goalkeepers_per_team, balance_score,
    balance_label, balance_diff, super_diff, capped_by_super)
  values (v_event, 'x', 'normal', false, 100, 'Muito equilibrado', 0, 0, false);
  insert into public.event_sort_team (event_id, team_number, queue_order) values (v_event, 1, 1) returning id into v_team1;
  insert into public.event_sort_team (event_id, team_number, queue_order) values (v_event, 2, 2) returning id into v_team2;

  -- Time de 3 (L=3) aceita 3 e recusa o 4º
  for v_i in 1..3 loop
    insert into public.event_sort_team_player (event_id, team_id, profile_id, stars_snapshot,
      is_super_star_snapshot, primary_position_snapshot)
    values (v_event, v_team1, v_p[v_i], 3, false, 'ANY');
  end loop;
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.event_sort_team_player (event_id, team_id, profile_id,
    stars_snapshot, is_super_star_snapshot, primary_position_snapshot) values (%L, %L, %L, 3, false, 'ANY')$f$,
    v_event, v_team1, v_p[4])) = 'team_full', 'Time acima da linha por Time é barrado');
  -- quem saiu libera a vaga
  update public.event_sort_team_player set left_at = now() where team_id = v_team1 and profile_id = v_p[3];
  insert into public.event_sort_team_player (event_id, team_id, profile_id, stars_snapshot,
    is_super_star_snapshot, primary_position_snapshot)
  values (v_event, v_team1, v_p[4], 3, false, 'ANY');

  -- uma pessoa em no máximo um Time ativo
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.event_sort_team_player (event_id, team_id, profile_id,
    stars_snapshot, is_super_star_snapshot, primary_position_snapshot) values (%L, %L, %L, 3, false, 'ANY')$f$,
    v_event, v_team2, v_p[1])) like '%event_sort_team_player_one_active%', 'pessoa em dois Times ativos é barrada');
  -- depois de sair, pode entrar em outro (histórico de passagem preservado)
  insert into public.event_sort_team_player (event_id, team_id, profile_id, stars_snapshot,
    is_super_star_snapshot, primary_position_snapshot)
  values (v_event, v_team2, v_p[3], 3, false, 'ANY');
  perform pg_temp.assert_that((select count(*) from public.event_sort_team_player where event_id = v_event and profile_id = v_p[3]) = 2,
    'histórico de entrada e saída mantém as duas passagens');
  -- Membro XOR Avulso
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.event_sort_team_player (event_id, team_id, profile_id, guest_id,
    stars_snapshot, is_super_star_snapshot, primary_position_snapshot) values (%L, %L, %L, %L, 3, false, 'ANY')$f$,
    v_event, v_team2, v_p[5], v_guest)) like '%member_xor_guest%', 'Membro e Avulso juntos são barrados');
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.event_sort_team_player (event_id, team_id,
    stars_snapshot, is_super_star_snapshot, primary_position_snapshot) values (%L, %L, 3, false, 'ANY')$f$,
    v_event, v_team2)) like '%member_xor_guest%', 'nenhum dos dois também é barrado');
  insert into public.event_sort_team_player (event_id, team_id, guest_id, stars_snapshot,
    is_super_star_snapshot, primary_position_snapshot)
  values (v_event, v_team2, v_guest, 3, false, 'ANY');
  -- Goleiro: no Time ou na fila, um por Time
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.event_sort_goalkeeper (event_id, team_id, queue_order, profile_id)
    values (%L, %L, 1, %L)$f$, v_event, v_team1, v_p[6])) like '%team_xor_queue%', 'Goleiro no Time e na fila é barrado');
  insert into public.event_sort_goalkeeper (event_id, team_id, profile_id) values (v_event, v_team1, v_p[6]);
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.event_sort_goalkeeper (event_id, team_id, profile_id)
    values (%L, %L, %L)$f$, v_event, v_team1, v_p[7])) like '%event_sort_goalkeeper_team_key%', 'dois Goleiros no mesmo Time são barrados');
  -- Time de outro Evento: a chave composta impede
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.event_sort_team_player (event_id, team_id, profile_id,
    stars_snapshot, is_super_star_snapshot, primary_position_snapshot) values (%L, %L, %L, 3, false, 'ANY')$f$,
    gen_random_uuid(), v_team2, v_p[7])) like '%violates foreign key%', 'Time só aceita jogadores do próprio Sorteio');
  raise notice 'PASS: constraints de Time cheio, pessoa única ativa, Membro XOR Avulso e Goleiro';

  -- confirmado exige Evento fora de upcoming (verificado no fim da transação; aqui forçado)
  update public.event_sort set status = 'confirmed', confirmed_at = now(), confirmed_by = v_owner where event_id = v_event;
  perform pg_temp.assert_that(pg_temp.err('set constraints event_sort_confirmed_needs_started_event immediate')
    like '%sort_confirmed_event_upcoming%', 'Sorteio confirmado com Evento upcoming é barrado');
end $$;

-- Evento active legado sem Sorteio segue intacto
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_p uuid := gen_random_uuid();
  v_racha uuid;
  v_event uuid;
  v_future date := current_date + 25;
begin
  insert into auth.users (id, raw_user_meta_data)
  values (v_owner, '{"display_name":"Dono Legado","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb),
         (v_p, '{"display_name":"Jogador Legado","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}'::jsonb);
  insert into public.racha (name, invite_code, place, outfield_per_team, spot_limit)
  values ('Prova Legado', 'ZZZZS4', 'Quadra L', 5, 10) returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3), (v_racha, v_p, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  insert into public.event (racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule, tie_return_order, consider_position)
  select r.id, current_date, time '19:00', 'Quadra L', 'active', v_owner, 10, r.reminder_lead_hours, 5, r.game_mode,
    r.max_consecutive_wins, r.tie_rule, r.tie_return_order, false from public.racha r where r.id = v_racha
  returning id into v_event;

  perform set_config('request.jwt.claim.sub', v_p::text, true);
  perform pg_temp.assert_that(public.get_event_sort(v_event) ->> 'state' = 'none', 'legado: nada publicado');
  perform public.confirm_attendance(v_event);
  perform public.cancel_attendance(v_event);
  perform public.confirm_attendance(v_event);
  perform pg_temp.assert_that((select status from public.event_attendance where event_id = v_event and profile_id = v_p) = 'confirmed',
    'legado: Presença continua livre');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('select public.prepare_event_sort(%L)', v_event)) = 'event_not_upcoming',
    'active legado não prepara Sorteio');
  perform pg_temp.assert_that(pg_temp.err(format('select public.get_event_sort_proposal(%L)', v_event)) = 'event_not_upcoming',
    'active legado não tem proposta');
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_event_sort(%L, 1)', v_event)) = 'event_not_upcoming',
    'active legado não confirma');
  perform public.finish_event(v_event);
  perform pg_temp.assert_that((select status from public.event where id = v_event) = 'finished'
    and not exists (select 1 from public.event_sort where event_id = v_event), 'legado encerra sem criar Sorteio');
  raise notice 'PASS: Evento active legado sem Sorteio preservado';
end $$;

-- ============================================================
-- 10. O Sorteio só considera quem veio (did_attend)
-- ============================================================
drop trigger auto_came on public.event_attendance;
drop trigger auto_came on public.event_guest;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_l uuid[] := array(select gen_random_uuid() from generate_series(1, 8));
  v_g uuid[] := array(select gen_random_uuid() from generate_series(1, 2));
  v_racha uuid;
  v_event uuid;
  v_guest uuid;
  v_i integer;
  v_pr jsonb;
  v_ver integer;
  v_ids text[];
begin
  insert into auth.users (id, raw_user_meta_data)
  select u.id, jsonb_build_object('display_name', u.name, 'birth_date', '1990-01-01',
    'plays_as', 'OUTFIELD', 'primary_position', 'ANY', 'terms_accepted', true)
  from (select v_owner as id, 'Dono Veio' as name
        union all select v_l[i], 'Linha ' || chr(64 + i) from generate_series(1, 8) i
        union all select v_g[i], 'Gol ' || chr(64 + i) from generate_series(1, 2) i) u;
  insert into public.racha (name, invite_code, place, outfield_per_team, spot_limit)
  values ('Prova Veio', 'ZZZZS5', 'Quadra V', 3, 20) returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  select v_racha, v_l[i], 'PLAYER', 'OUTFIELD', 'ANY', 1 + i % 5 from generate_series(1, 8) i;
  insert into public.member (racha_id, profile_id, role, plays_as)
  select v_racha, v_g[i], 'PLAYER', 'GOALKEEPER' from generate_series(1, 2) i;
  insert into public.event (racha_id, starts_on, starts_at, place, status, spot_limit, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule, tie_return_order, consider_position)
  select r.id, current_date + 30, time '19:00', 'Quadra V', 'upcoming', 20, r.reminder_lead_hours, 3, r.game_mode,
    r.max_consecutive_wins, r.tie_rule, r.tie_return_order, false from public.racha r where r.id = v_racha
  returning id into v_event;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.assume_event_conduction(v_event);
  for v_i in 1..8 loop
    perform set_config('request.jwt.claim.sub', v_l[v_i]::text, true);
    perform public.confirm_attendance(v_event);
  end loop;
  for v_i in 1..2 loop
    perform set_config('request.jwt.claim.sub', v_g[v_i]::text, true);
    perform public.confirm_attendance(v_event);
  end loop;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_guest := public.add_guest(v_event, 'Avulso Veio', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  -- Avulso nasce com "veio"; desmarcado, volta a ficar fora do Sorteio
  perform pg_temp.assert_that((select g.did_attend from public.event_guest g where g.id = v_guest),
    'Avulso adicionado já nasce com "veio"');
  perform public.set_attendance_attended(v_event, null, v_guest, false);

  -- confirmado sem "veio" está fora do elenco e fora do Sorteio
  v_pr := public.get_event_sort_proposal(v_event);
  perform pg_temp.assert_that(v_pr ->> 'state' = 'none' and (v_pr ->> 'line_count')::integer = 0
    and (v_pr ->> 'goalkeeper_count')::integer = 0 and not (v_pr ->> 'can_sort')::boolean
    and (v_pr ->> 'confirmed_count')::integer = 11 and (v_pr ->> 'not_attended_count')::integer = 11,
    'ninguém veio: elenco vazio, 11 confirmados e 11 sem "veio"');
  perform pg_temp.assert_that(jsonb_array_length(private.event_sort_roster(v_event)) = 0, 'roster vazio sem "veio"');
  perform pg_temp.assert_that(pg_temp.err(format('select public.prepare_event_sort(%L)', v_event)) = 'not_enough_players',
    '8 de linha confirmados, nenhum veio: não sorteia');

  for v_i in 1..6 loop
    perform public.set_attendance_attended(v_event, v_l[v_i], null, true);
  end loop;
  v_pr := public.get_event_sort_proposal(v_event);
  perform pg_temp.assert_that((v_pr ->> 'line_count')::integer = 6 and (v_pr ->> 'goalkeeper_count')::integer = 0
    and (v_pr ->> 'can_sort')::boolean and (v_pr ->> 'confirmed_count')::integer = 11
    and (v_pr ->> 'not_attended_count')::integer = 5, 'contagens: só 6 vieram, 11 confirmados, 5 faltam marcar');

  v_pr := public.prepare_event_sort(v_event);
  v_ver := (v_pr ->> 'version')::integer;
  select array_agg(x order by x) into v_ids from (
    select coalesce(pl ->> 'profile_id', pl ->> 'guest_id') as x
    from jsonb_array_elements(v_pr -> 'teams') t, jsonb_array_elements(t -> 'players') pl) q;
  perform pg_temp.assert_that(v_pr ->> 'state' = 'ready' and v_ids = (select array_agg(x::text order by x::text) from unnest(v_l[1:6]) x),
    'o Sorteio usa só quem veio (Avulso e os outros dois de linha ficam de fora)');
  perform pg_temp.assert_that(not exists (select 1 from public.event_sort_team_player where event_id = v_event
    and person_id in (v_l[7], v_l[8], v_guest)), 'sem "veio" não há passagem por Time');

  -- marcar "veio" invalida a proposta e desmarcar restaura (a assinatura deriva do elenco)
  perform public.set_attendance_attended(v_event, v_l[7], null, true);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'marcar veio (Membro) invalida');
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_event_sort(%L, %s)', v_event, v_ver)) = 'roster_changed',
    'confirmar proposta invalidada pelo "veio": roster_changed');
  perform public.set_attendance_attended(v_event, v_l[7], null, false);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'ready'
    and (public.get_event_sort_proposal(v_event) ->> 'version')::integer = v_ver, 'desmarcar restaura a mesma proposta');

  perform public.set_attendance_attended(v_event, null, v_guest, true);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'marcar veio (Avulso) invalida');
  perform public.set_attendance_attended(v_event, null, v_guest, false);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'ready', 'desmarcar o Avulso restaura');

  perform public.set_attendance_attended(v_event, v_g[1], null, true);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'marcar veio (Goleiro) invalida');
  perform public.set_attendance_attended(v_event, v_g[1], null, false);
  perform public.set_attendance_attended(v_event, v_l[1], null, false);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'desmarcar quem estava na proposta invalida');
  perform public.set_attendance_attended(v_event, v_l[1], null, true);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'ready', 'remarcar restaura');

  -- Avulso sem "veio" fica fora mesmo no elenco com Goleiro que veio
  perform public.set_attendance_attended(v_event, v_g[1], null, true);
  v_pr := public.prepare_event_sort(v_event);
  perform pg_temp.assert_that((v_pr ->> 'goalkeeper_count')::integer = 1 and (v_pr ->> 'line_count')::integer = 6
    and (v_pr ->> 'confirmed_count')::integer = 11 and (v_pr ->> 'not_attended_count')::integer = 4,
    'Goleiro que veio entra; contagens refletem os 4 sem "veio" (2 de linha, 1 Goleiro, 1 Avulso)');
  v_ver := (v_pr ->> 'version')::integer;

  -- confirmar continua trocando upcoming -> active na mesma transação
  v_pr := public.confirm_event_sort(v_event, v_ver);
  perform pg_temp.assert_that(v_pr ->> 'state' = 'published' and (select status from public.event where id = v_event) = 'active',
    'confirmar publica e ativa');
  raise notice 'PASS: Sorteio só com "veio": roster, contagens, invalidação e restauração (Membro, Avulso, Goleiro)';
end $$;

rollback;
