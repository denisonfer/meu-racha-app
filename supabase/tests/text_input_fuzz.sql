-- Fuzz de texto livre: payloads hostis e tamanhos extremos em todo ponto de entrada de
-- texto do banco (RPCs de public chamáveis por authenticated/anon, colunas text de
-- escrita direta e o jsonb de metadados do signup). Tudo roda dentro de transação com
-- ROLLBACK; cada tentativa roda num sub-bloco que desfaz o próprio efeito.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/text_input_fuzz.sql
--
-- Conjunto FIXO de payloads (tabela pg_temp.payload, logo abaixo):
--   or1 ' OR '1'='1          drop '; drop table public.profile; --
--   sleep " ) ; select pg_sleep(5); --   (canário: a chamada não pode passar de 1 s)
--   dollar $$ x $$   param $1   pct %   under _   bslash \   hex00 \x00 (4 caracteres)
--   esc E'\\' (5 caracteres)   xss <script>alert(1)</script>   path ../../etc/passwd
--   tpl {{7*7}}   shell ${7*7}   emoji (4 bytes + ZWJ + U+202E RTL)   empty ''
--   spaces '   '   10k (10 000 caracteres)   1M (1 000 000 caracteres)
--   + jsonb hostil nos metadados do signup (bloco próprio) e NUL/UTF-8 inválido (bloco próprio).
-- Cada alvo ainda recebe "controles" declarados na chamada: valores válidos e limites
-- exatos (n e n+1 caracteres), para que "aceitou" e "rejeitou" não passem trivialmente.
--
-- Campo que aceita 1 MB NÃO falha o teste: vira `NOTICE: SEM LIMITE: ...` (decisão de limite
-- é do dono do produto). Falha de verdade: schema alterado, SQL executado, erro interno
-- (qualquer SQLSTATE fora de P0001/23514/23505/42501), aceitar o que devia rejeitar,
-- gravar valor diferente do enviado, sleep > 1 s.
\set ON_ERROR_STOP on
begin;

-- ============================================================
-- Ferramentas
-- ============================================================

-- Impressão digital do schema: se algum payload virar DDL, muda.
create function pg_temp.snap() returns text
language sql as $$
  select md5(
    coalesce((select string_agg(c.relname || c.relkind::text, ',' order by c.relname)
      from pg_class c where c.relnamespace in ('public'::regnamespace, 'private'::regnamespace)), '')
    || (select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid
        where c.relnamespace = 'public'::regnamespace and a.attnum > 0 and not a.attisdropped)::text
    || coalesce((select string_agg(p.oid::regprocedure::text, ',' order by p.oid::regprocedure::text)
        from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)), '')
    || (select count(*) from pg_constraint where connamespace in ('public'::regnamespace, 'private'::regnamespace))::text
    || (select count(*) from pg_trigger where not tgisinternal)::text
    || (select count(*) from pg_policy)::text
  )
$$;

create function pg_temp.counts() returns text
language sql as $$
  select concat_ws(',',
    (select count(*) from public.profile), (select count(*) from public.racha),
    (select count(*) from public.member), (select count(*) from public.event),
    (select count(*) from public.event_guest), (select count(*) from public.report),
    (select count(*) from public.push_token), (select count(*) from public.notification),
    (select count(*) from public.racha_notice), (select count(*) from public.racha_monthly_pass),
    (select count(*) from public.event_match_goal))
$$;

-- Executa p_call (um statement com $1..$3 = p_a..p_c) como p_role e p_sub, lê de volta o
-- valor gravado e DESFAZ tudo. Mede o tempo e compara schema/contagens antes e depois.
create function pg_temp.probe(
  p_role text, p_sub uuid, p_call text, p_read text, p_a text, p_b text, p_c text,
  out state text, out code text, out msg text, out ms numeric, out stored text,
  out has_row boolean, out same_schema boolean, out cnt0 text, out cnt1 text
) language plpgsql as $$
declare
  v_t0 timestamptz;
  v_snap0 text := pg_temp.snap();
  v_rows bigint;
begin
  cnt0 := pg_temp.counts();
  has_row := false;
  same_schema := true;
  perform set_config('request.jwt.claim.sub', coalesce(p_sub::text, ''), true);
  perform set_config('request.jwt.claims', '', true);
  begin
    if p_role is not null then
      execute 'set local role ' || quote_ident(p_role);
    end if;
    v_t0 := clock_timestamp();
    execute p_call into stored using p_a, p_b, p_c;
    ms := extract(epoch from clock_timestamp() - v_t0) * 1000;
    state := 'ok';
    get diagnostics v_rows = row_count;
    has_row := v_rows > 0;
    execute 'reset role';
    same_schema := pg_temp.snap() = v_snap0;
    cnt1 := pg_temp.counts();
    if p_read is not null then
      execute p_read into stored using p_a, p_b, p_c;
      get diagnostics v_rows = row_count;
      has_row := v_rows > 0;
    end if;
    -- sentinela: desfaz o efeito da tentativa, as variáveis de saída sobrevivem
    raise exception 'probe_rollback' using errcode = 'ZZ001';
  exception
    when sqlstate 'ZZ001' then
      null;
    when others then
      ms := extract(epoch from clock_timestamp() - v_t0) * 1000;
      state := 'err';
      code := sqlstate;
      msg := sqlerrm;
      stored := null;
      has_row := false;
  end;
end $$;

-- Regra documentada de cada campo: o que deve ser aceito e o valor que deve voltar.
-- As regexes repetem de propósito as constraints (a migration é a autoridade): se
-- alguém afrouxar uma constraint, o teste diverge.
create function pg_temp.expected(p_kind text, p_val text, p_b text, out accept boolean, out stored text)
language plpgsql as $$
declare
  v text;
begin
  accept := false;
  stored := null;
  case p_kind
    when 'name_person', 'name_person_trim' then
      v := case when p_kind = 'name_person_trim' then btrim(p_val) else p_val end;
      if char_length(v) between 2 and 40 and v ~ '^[[:alpha:]][[:alpha:] ''.-]*$' then
        accept := private.name_is_allowed(v);
      end if;
      stored := v;
    when 'name_racha', 'name_racha_trim' then
      v := case when p_kind = 'name_racha_trim' then btrim(p_val) else p_val end;
      if char_length(v) between 2 and 40 and v ~ '^[[:alpha:]][[:alpha:]0-9 ''.-]*$' then
        accept := private.name_is_allowed(v);
      end if;
      stored := v;
    when 'place' then
      v := btrim(p_val);
      accept := char_length(v) between 1 and 120;
      stored := v;
    when 'place_event' then
      v := btrim(p_val);
      accept := char_length(v) between 1 and 120 and v <> 'A definir';
      stored := v;
    when 'details' then
      v := nullif(btrim(p_val), '');
      accept := coalesce(char_length(v), 0) <= 500;
      stored := v;
    when 'token' then
      accept := p_val ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' and length(p_val) <= 200;
      stored := p_val;
    when 'request_key' then
      accept := char_length(p_val) between 1 and 100;
      stored := p_val;
    when 'avatar' then
      v := p_b || '/' || p_val;
      accept := v ~ ('^' || p_b || '/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$') and v !~ '\.\.';
      stored := v;
    when 'year_month' then
      accept := p_val ~ '^\d{4}-(0[1-9]|1[0-2])$';
      stored := p_val;
    when 'reason_profile' then
      accept := p_val in ('photo', 'name', 'harassment', 'spam_scam', 'other');
      stored := p_val;
    when 'kind_profile' then
      accept := p_val = 'profile';
      stored := p_val;
    when 'platform' then
      accept := p_val in ('ios', 'android');
      stored := p_val;
    when 'never' then
      accept := false;
    when 'always_ok' then
      accept := true;
    when 'invite_zero' then
      accept := true;
      stored := '0';
    when 'invite_hit' then
      accept := true;
      stored := case when upper(btrim(p_val)) = p_b then '1' else '0' end;
    when 'email' then
      accept := true;
      stored := case when lower(btrim(p_val)) = lower(p_b) then 'false' else 'true' end;
    when 'name_filter' then
      accept := true;
      stored := case when lower(p_val) ~ '(^|[^[:alnum:]_])(babaca|bicha)($|[^[:alnum:]_])'
        then 'false' else 'true' end;
    else
      raise exception 'kind desconhecido %', p_kind;
  end case;
end $$;

create temp table payload (ord integer primary key, label text not null, val text not null);
insert into pg_temp.payload values
  (1,  'or1',    $fz$' OR '1'='1$fz$),
  (2,  'drop',   $fz$'; drop table public.profile; --$fz$),
  (3,  'sleep',  $fz$" ) ; select pg_sleep(5); --$fz$),
  (4,  'dollar', $fz$$$ x $$$fz$),
  (5,  'param',  $fz$$1$fz$),
  (6,  'pct',    $fz$%$fz$),
  (7,  'under',  $fz$_$fz$),
  (8,  'bslash', $fz$\$fz$),
  (9,  'hex00',  $fz$\x00$fz$),
  (10, 'esc',    $fz$E'\\'$fz$),
  (11, 'xss',    $fz$<script>alert(1)</script>$fz$),
  (12, 'path',   $fz$../../etc/passwd$fz$),
  (13, 'tpl',    $fz${{7*7}}$fz$),
  (14, 'shell',  $fz$${7*7}$fz$),
  (15, 'emoji',  'Joe ' || chr(128512) || chr(128104) || chr(8205) || chr(128105) || chr(8205)
                 || chr(128103) || chr(8238) || 'abc'),
  (16, 'empty',  ''),
  (17, 'spaces', '   '),
  (18, '10k',    repeat('a', 10000)),
  (19, '1M',     repeat('a', 1000000));

-- Roda um alvo contra todos os payloads + controles e afirma as regras.
create function pg_temp.run_target(
  p_target text, p_kind text, p_role text, p_sub uuid,
  p_call text, p_read text, p_b text, p_c text, p_controls text[] default '{}'
) returns void
language plpgsql as $$
declare
  rec record;
  r record;
  e record;
  v_ok boolean;
  v_n integer := 0;
  v_acc integer := 0;
  v_big text := null;
  v_readonly boolean := p_kind in ('always_ok', 'invite_zero', 'invite_hit', 'email', 'name_filter');
  v_where text;
begin
  for rec in
    select ord, label, val from pg_temp.payload
    union all
    select 1000 + i::integer, 'ctrl' || i, c
    from unnest(p_controls) with ordinality as t(c, i)
    order by 1
  loop
    v_n := v_n + 1;
    v_where := p_target || ' payload=' || rec.label || ' (len ' || char_length(rec.val) || ')';
    select * into r from pg_temp.probe(p_role, p_sub, p_call, p_read, rec.val, p_b, p_c);
    select * into e from pg_temp.expected(p_kind, rec.val, p_b);
    v_ok := r.state = 'ok' and r.has_row;

    if not r.same_schema then
      raise exception 'FAIL: % schema alterado pelo payload', v_where;
    end if;
    if r.state = 'err' and r.code not in ('P0001', '23514', '23505', '42501') then
      raise exception 'FAIL: % erro interno % : %', v_where, r.code, left(r.msg, 160);
    end if;
    if rec.label = 'sleep' and r.ms > 1000 then
      raise exception 'FAIL: % pg_sleep executou (% ms)', v_where, round(r.ms);
    end if;
    if r.ms > 1000 and rec.label <> 'sleep' then
      raise notice 'LENTO: % levou % ms', v_where, round(r.ms);
    end if;
    -- texto longo é cortado antes do filtro de nomes: 1 MB não pode custar CPU
    if rec.label = '1M' and r.ms > 500 then
      raise exception 'FAIL: % levou % ms com 1 000 000 caracteres', v_where, round(r.ms);
    end if;
    if e.accept and not v_ok then
      raise exception 'FAIL: % esperava aceitar, obteve % % %', v_where, r.state, r.code, left(r.msg, 160);
    end if;
    if not e.accept and v_ok then
      raise exception 'FAIL: % aceitou o que devia rejeitar (stored len %)', v_where, char_length(r.stored);
    end if;
    if v_ok and p_read is not null and r.stored is distinct from e.stored then
      raise exception 'FAIL: % valor gravado diferente do enviado (esperado len %, gravado len %)',
        v_where, char_length(e.stored), char_length(r.stored);
    end if;
    if v_ok and p_read is null and p_kind <> 'always_ok' and r.stored is distinct from e.stored then
      raise exception 'FAIL: % resultado % diferente do esperado %', v_where, left(r.stored, 40), left(e.stored, 40);
    end if;
    -- rejeição e leitura pura não mudam nenhuma contagem
    if r.state = 'ok' and (not v_ok or v_readonly) and r.cnt0 is distinct from r.cnt1 then
      raise exception 'FAIL: % contagens mudaram em chamada sem efeito: % -> %', v_where, r.cnt0, r.cnt1;
    end if;

    if v_ok then
      v_acc := v_acc + 1;
      if rec.label = '1M' then
        v_big := '1M';
      end if;
    end if;
  end loop;

  if v_big is not null then
    raise notice 'SEM LIMITE: % (aceitou 1 000 000 caracteres%)', p_target,
      case when v_readonly then '; só leitura/comparação' else '' end;
  end if;
  raise notice 'PASS: % [%]: % casos, % aceitos, % rejeitados', p_target, p_kind, v_n, v_acc, v_n - v_acc;
end $$;

create temp table ctx (k text primary key, v text not null);

create function pg_temp.person(p_name text, p_email text default null, p_plays public.plays_as default 'OUTFIELD')
returns uuid language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_id, p_email, jsonb_build_object(
    'display_name', p_name, 'birth_date', '1990-01-01', 'plays_as', p_plays,
    'primary_position', case when p_plays = 'OUTFIELD' then 'ANY' end, 'terms_accepted', true));
  return v_id;
end $$;

-- ============================================================
-- Preparação: usuários, Rachas e uma Partida aberta
-- ============================================================
do $$
declare
  v_owner uuid := pg_temp.person('Dono Fuzz');
  v_player uuid := pg_temp.person('Jogador Fuzz');
  v_creator uuid := pg_temp.person('Criador Fuzz');
  v_target uuid := pg_temp.person('Alvo Fuzz');
  v_mail uuid := pg_temp.person('Email Fuzz', 'wild.card@example.com');
  v_owner_b uuid := pg_temp.person('Dono Evento');
  v_owner_c uuid := pg_temp.person('Dono Partida');
  v_ra uuid;
  v_rb uuid;
  v_rc uuid;
  v_event_b uuid;
  v_event_c uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_i integer;
  v_pid uuid;
  v_gk uuid;
  v_scorer uuid;
  v_match jsonb;
begin
  -- Racha A: sem Evento; tem preço mensal para o set_monthly_pass.
  insert into public.racha (name, invite_code, place, outfield_per_team)
  values ('Racha Fuzz A', 'FZZA23', 'Quadra Fuzz', 3) returning id into v_ra;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_ra, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3),
         (v_ra, v_player, 'PLAYER', 'OUTFIELD', 'ANY', 3);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.update_racha_logistics(
    v_ra, 'Quadra Fuzz', null::smallint, null::time, null::smallint, true,
    1000, 5000, null::smallint, 10);

  -- Racha B: Evento futuro, para update_event e add_guest.
  insert into public.racha (name, invite_code, place, outfield_per_team)
  values ('Racha Fuzz B', 'FZZB23', 'Quadra Fuzz', 3) returning id into v_rb;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_rb, v_owner_b, 'OWNER', 'OUTFIELD', 'ANY', 3);
  perform set_config('request.jwt.claim.sub', v_owner_b::text, true);
  v_event_b := public.create_event(
    v_rb, current_date + 14, time '19:00', 'Quadra Fuzz', false,
    null::integer, null::smallint, null::integer);

  -- Racha C: Evento em andamento, Sorteio confirmado e Partida aberta.
  insert into public.racha (name, invite_code, place, spot_limit, outfield_per_team)
  values ('Racha Fuzz C', 'FZZC23', 'Quadra Fuzz', 50, 3) returning id into v_rc;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_rc, v_owner_c, 'OWNER', 'OUTFIELD', 'ANY', 3);
  insert into public.event (
    racha_id, starts_on, starts_at, place, status, conductor_id, spot_limit,
    reminder_lead_hours, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    v_rc, current_date, time '19:00', 'Quadra Fuzz', 'active', v_owner_c, 50,
    24, 3, 'WINNER_STAYS', 2, 'BOTH_OUT', 'TEAM_ORDER', false, 10
  ) returning id into v_event_c;
  insert into public.event_sort (
    event_id, status, signature, version, leftover_ids, mode, goalkeepers_per_team,
    balance_score, balance_label, balance_diff, super_diff, capped_by_super,
    confirmed_at, confirmed_by
  ) values (v_event_c, 'confirmed', 'fuzz', 1, '{}', 'normal', true,
    80, 'Equilibrado', 0, 0, false, now(), v_owner_c);
  insert into public.event_sort_team (event_id, team_number, queue_order, win_streak)
  values (v_event_c, 1, 1, 0) returning id into v_t1;
  insert into public.event_sort_team (event_id, team_number, queue_order, win_streak)
  values (v_event_c, 2, 2, 0) returning id into v_t2;
  for v_i in 1..6 loop
    v_pid := pg_temp.person('Linha ' || chr(64 + v_i));
    insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
    values (v_rc, v_pid, 'PLAYER', 'OUTFIELD', 'ANY', 3);
    insert into public.event_sort_team_player (
      event_id, team_id, profile_id, stars_snapshot, is_super_star_snapshot, primary_position_snapshot
    ) values (v_event_c, case when v_i <= 3 then v_t1 else v_t2 end, v_pid, 3, false, 'ANY');
    insert into public.event_attendance (event_id, profile_id, status, did_attend)
    values (v_event_c, v_pid, 'confirmed', true);
    if v_i = 4 then
      v_scorer := v_pid;
    end if;
  end loop;
  for v_i in 1..2 loop
    v_gk := pg_temp.person('Goleiro ' || chr(64 + v_i), null, 'GOALKEEPER');
    insert into public.member (racha_id, profile_id, role, plays_as)
    values (v_rc, v_gk, 'PLAYER', 'GOALKEEPER');
    insert into public.event_sort_goalkeeper (event_id, team_id, profile_id)
    values (v_event_c, case when v_i = 1 then v_t1 else v_t2 end, v_gk);
    insert into public.event_attendance (event_id, profile_id, status, did_attend)
    values (v_event_c, v_gk, 'confirmed', true);
  end loop;
  perform set_config('request.jwt.claim.sub', v_owner_c::text, true);
  v_match := public.start_event_match(v_event_c);

  insert into pg_temp.ctx values
    ('owner', v_owner::text), ('player', v_player::text), ('creator', v_creator::text),
    ('target', v_target::text), ('mail', v_mail::text), ('owner_b', v_owner_b::text),
    ('owner_c', v_owner_c::text), ('racha_a', v_ra::text), ('racha_b', v_rb::text),
    ('racha_c', v_rc::text), ('event_b', v_event_b::text), ('event_c', v_event_c::text),
    ('team2', v_t2::text), ('scorer', v_scorer::text),
    ('match', (v_match #>> '{match,id}'));
  raise notice 'preparação: 3 Rachas, Evento futuro, Partida aberta';
end $$;

create function pg_temp.c(p_k text) returns text language sql as $$
  select v from pg_temp.ctx where k = p_k
$$;

-- Denúncia semente para o teste de UPDATE direto em report (fora da contagem do fuzz).
do $$
begin
  perform set_config('request.jwt.claim.sub', pg_temp.c('player'), true);
  perform public.report_content('profile', pg_temp.c('target')::uuid, 'other', 'original');
end $$;

-- Fingerprint e contagens ANTES do fuzz; conferidos no fim.
create temp table before_fuzz as select pg_temp.snap() as snap, pg_temp.counts() as counts;

-- ============================================================
-- 0. Caractere NUL e UTF-8 inválido: o Postgres não aceita texto assim
-- ============================================================
do $$
declare
  v_state text;
  v_cases text[] := array[
    'select chr(0)',
    'select convert_from(decode(''6100'', ''hex''), ''UTF8'')',
    'select convert_from(decode(''ff'', ''hex''), ''UTF8'')',
    'select ''{"display_name":"a\u0000b"}''::jsonb',
    'select (''a'' || chr(0))::text'
  ];
  v_sql text;
begin
  foreach v_sql in array v_cases loop
    begin
      execute v_sql;
      raise exception 'FAIL: NUL/UTF-8 inválido aceito: %', v_sql;
    exception
      when sqlstate 'P0001' then raise;
      when others then
        raise notice 'NUL: % -> % (%)', v_sql, sqlerrm, sqlstate;
    end;
  end loop;
  raise notice 'PASS: NUL e UTF-8 inválido não chegam a nenhum campo (erro na origem)';
end $$;

-- ============================================================
-- 1a. RPCs com parâmetro de texto
-- ============================================================
do $$
declare
  v_owner uuid := pg_temp.c('owner')::uuid;
  v_creator uuid := pg_temp.c('creator')::uuid;
  v_ob uuid := pg_temp.c('owner_b')::uuid;
  v_oc uuid := pg_temp.c('owner_c')::uuid;
  v_player uuid := pg_temp.c('player')::uuid;
  v_target uuid := pg_temp.c('target')::uuid;
  v_longname text;
begin
  -- create_racha(p_name): trim no servidor, regex + 2..40 + filtro de palavras.
  perform pg_temp.run_target(
    'create_racha(p_name)', 'name_racha_trim', 'authenticated', v_creator,
    'select id::text from public.create_racha($1, 3::smallint, ''WINNER_STAYS'', 2::smallint, ''BOTH_OUT'', ''TEAM_ORDER'', false, ''Quadra Fuzz'')',
    'select r.name from public.racha r join public.member m on m.racha_id = r.id where m.profile_id = $2::uuid and m.role = ''OWNER''',
    v_creator::text, null,
    array['FC Amigos 2024', 'Racha d''Água 7', 'Ab', repeat('a', 40), repeat('a', 41), '  Racha Trim  ']);

  -- create_racha(p_place)
  perform pg_temp.run_target(
    'create_racha(p_place)', 'place', 'authenticated', v_creator,
    'select id::text from public.create_racha(''Racha Fuzz Local'', 3::smallint, ''WINNER_STAYS'', 2::smallint, ''BOTH_OUT'', ''TEAM_ORDER'', false, $1)',
    'select r.place from public.racha r join public.member m on m.racha_id = r.id where m.profile_id = $2::uuid and m.role = ''OWNER''',
    v_creator::text, null,
    array['Quadra do Zé, 3', repeat('a', 120), repeat('a', 121), '  Quadra Central  ']);

  -- update_racha_logistics(p_place)
  perform pg_temp.run_target(
    'update_racha_logistics(p_place)', 'place', 'authenticated', v_owner,
    'select public.update_racha_logistics($2::uuid, $1, null::smallint, null::time, null::smallint, true, 1000, 5000, null::smallint, 10)::text',
    'select r.place from public.racha r where r.id = $2::uuid',
    pg_temp.c('racha_a'), null,
    array['Quadra do Zé, 3', repeat('a', 120), repeat('a', 121), '  Quadra Central  ']);

  -- create_event(p_place)
  perform pg_temp.run_target(
    'create_event(p_place)', 'place_event', 'authenticated', v_owner,
    'select public.create_event($2::uuid, current_date + 14, time ''19:00'', $1, false, null::integer, null::smallint, null::integer)::text',
    'select e.place from public.event e where e.racha_id = $2::uuid',
    pg_temp.c('racha_a'), null,
    array['Quadra do Zé, 3', repeat('a', 120), repeat('a', 121), 'A definir', '  Quadra Central  ']);

  -- update_event(p_place)
  perform pg_temp.run_target(
    'update_event(p_place)', 'place_event', 'authenticated', v_ob,
    'select public.update_event($2::uuid, current_date + 14, time ''20:00'', $1, false, null::integer, null::smallint, null::integer)::text',
    'select e.place from public.event e where e.id = $2::uuid',
    pg_temp.c('event_b'), null,
    array['Quadra do Zé, 3', repeat('a', 120), repeat('a', 121), 'A definir', '  Quadra Central  ']);

  -- add_guest(p_display_name): btrim no servidor.
  perform pg_temp.run_target(
    'add_guest(p_display_name)', 'name_person_trim', 'authenticated', v_ob,
    'select public.add_guest($2::uuid, $1, ''OUTFIELD''::public.plays_as, ''ANY''::public."position", null::public."position", 3::smallint, false)::text',
    'select g.display_name from public.event_guest g where g.event_id = $2::uuid',
    pg_temp.c('event_b'), null,
    array['Zé O''Neil-Silva Jr.', 'Ab', repeat('a', 40), repeat('a', 41), '  Zé Trim  ']);

  -- include_event_sort_guest(p_display_name)
  perform pg_temp.run_target(
    'include_event_sort_guest(p_display_name)', 'name_person_trim', 'authenticated', v_oc,
    'select public.include_event_sort_guest($2::uuid, $1, ''OUTFIELD''::public.plays_as, ''ANY''::public."position", null::public."position", 3::smallint, false)::text',
    'select g.display_name from public.event_guest g where g.event_id = $2::uuid',
    pg_temp.c('event_c'), null,
    array['Zé O''Neil-Silva Jr.', 'Ab', repeat('a', 40), repeat('a', 41), '  Zé Trim  ']);

  -- add_event_match_goal(p_request_key): chave de idempotência, limite 100.
  perform pg_temp.run_target(
    'add_event_match_goal(p_request_key)', 'request_key', 'authenticated', v_oc,
    format('select public.add_event_match_goal($2::uuid, $1, %L::uuid, %L::uuid, null::uuid, false)::text',
      pg_temp.c('team2'), pg_temp.c('scorer')),
    'select g.request_key from public.event_match_goal g where g.match_id = $2::uuid',
    pg_temp.c('match'), null,
    array['goal-1', repeat('k', 100), repeat('k', 101), E'a\nb']);

  -- register_push_token(p_token)
  perform pg_temp.run_target(
    'register_push_token(p_token)', 'token', 'authenticated', v_player,
    'select public.register_push_token($1, ''ios'')::text',
    'select t.token from public.push_token t where t.profile_id = $2::uuid',
    v_player::text, null,
    array['ExponentPushToken[abc_-123]', 'ExpoPushToken[x]', 'ExponentPushToken[]',
          E'ExponentPushToken[x]\n', 'ExponentPushToken[' || repeat('a', 181) || ']',
          'ExponentPushToken[' || repeat('a', 182) || ']']);

  -- register_push_token(p_platform)
  perform pg_temp.run_target(
    'register_push_token(p_platform)', 'platform', 'authenticated', v_player,
    'select public.register_push_token(''ExponentPushToken[abc]'', $1)::text',
    'select t.platform from public.push_token t where t.profile_id = $2::uuid',
    v_player::text, null,
    array['ios', 'android', 'IOS', 'web']);

  -- unregister_push_token(p_token): só apaga o token do próprio, nunca erra.
  perform pg_temp.run_target(
    'unregister_push_token(p_token)', 'always_ok', 'authenticated', v_player,
    'select public.unregister_push_token($1)::text', null, null, null,
    array['ExponentPushToken[nao-existe]']);

  -- report_content(p_details): btrim, vazio vira null, limite 500.
  perform pg_temp.run_target(
    'report_content(p_details)', 'details', 'authenticated', v_player,
    'select public.report_content(''profile'', $3::uuid, ''other'', $1)::text',
    'select r.details from public.report r where r.reporter_id = $2::uuid and r.target_profile_id = $3::uuid',
    v_player::text, v_target::text,
    array['Chegou atrasado', repeat('a', 500), repeat('a', 501), E'linha1\nlinha2', '  espaço  ']);

  -- report_content(p_reason): lista fechada.
  perform pg_temp.run_target(
    'report_content(p_reason)', 'reason_profile', 'authenticated', v_player,
    'select public.report_content(''profile'', $3::uuid, $1, null)::text',
    'select r.reason from public.report r where r.reporter_id = $2::uuid and r.target_profile_id = $3::uuid',
    v_player::text, v_target::text,
    array['photo', 'harassment', 'PHOTO', 'scam_charge']);

  -- report_content(p_kind): só 'profile' (e 'racha', coberto pela lista fechada).
  perform pg_temp.run_target(
    'report_content(p_kind)', 'kind_profile', 'authenticated', v_player,
    'select public.report_content($1, $3::uuid, ''other'', null)::text',
    'select r.target_kind from public.report r where r.reporter_id = $2::uuid and r.target_profile_id = $3::uuid',
    v_player::text, v_target::text,
    array['profile', 'Profile', 'profile ']);

  -- set_monthly_pass(p_year_month)
  perform pg_temp.run_target(
    'set_monthly_pass(p_year_month)', 'year_month', 'authenticated', v_owner,
    format('select public.set_monthly_pass(%L::uuid, %L::uuid, $1, true)::text', pg_temp.c('racha_a'), v_player),
    format('select mp.year_month from public.racha_monthly_pass mp where mp.racha_id = %L::uuid and mp.profile_id = %L::uuid',
      pg_temp.c('racha_a'), v_player),
    null, null,
    array['2026-10', '2026-13', '2026-00', E'2026-10\n', '2026-1', ' 2026-10',
          chr(1634) || chr(1632) || chr(1634) || chr(1638) || '-10']);

  -- name_allowed(p_name): puro, sem gravação; authenticated e anon.
  perform pg_temp.run_target(
    'name_allowed(p_name) como authenticated', 'name_filter', 'authenticated', v_player,
    'select public.name_allowed($1)::text', null, null, null,
    array['babaca', 'Um babaca; drop table x', 'ba%aca', 'b_baca', 'BABACA!']);
  perform pg_temp.run_target(
    'name_allowed(p_name) como anon', 'name_filter', 'anon', null,
    'select public.name_allowed($1)::text', null, null, null,
    array['babaca', 'ba%aca']);

  -- email_available(p_email): comparação por igualdade, % e _ são literais.
  perform pg_temp.run_target(
    'email_available(p_email) como anon', 'email', 'anon', null,
    'select public.email_available($1)::text', null, 'wild.card@example.com', null,
    array['wild.card@example.com', ' WILD.CARD@EXAMPLE.COM ', '%@example.com',
          'wild_card@example.com', 'wild.card@example.co_', 'w%', '_____________________']);
  perform pg_temp.run_target(
    'email_available(p_email) como authenticated', 'email', 'authenticated', v_player,
    'select public.email_available($1)::text', null, 'wild.card@example.com', null,
    array['wild.card@example.com', '%@example.com']);

  -- get_invite(p_code): igualdade com upper(trim()); % e _ não casam com nada.
  perform pg_temp.run_target(
    'get_invite(p_code)', 'invite_hit', 'authenticated', v_player,
    'select count(*)::text from public.get_invite($1)', null, 'FZZA23', null,
    array['FZZA23', ' fzza23 ', 'FZZA2%', 'FZ_A23', '%', '______', 'FZZA23%']);
end $$;

-- ============================================================
-- 1b. Colunas text de escrita direta (authenticated, com RLS)
-- ============================================================
do $$
declare
  v_owner uuid := pg_temp.c('owner')::uuid;
  v_player uuid := pg_temp.c('player')::uuid;
  v_target uuid := pg_temp.c('target')::uuid;
begin
  -- profile.avatar_path: regex da pasta própria, arquivo de até 100 caracteres.
  perform pg_temp.run_target(
    'profile.avatar_path (UPDATE direto)', 'avatar', 'authenticated', v_player,
    'update public.profile set avatar_path = $2 || ''/'' || $1 where id = $2::uuid returning avatar_path',
    null, v_player::text, null,
    array['foto.jpg', 'a', '.oculto', 'a..b', 'a/b', 'a b', repeat('a', 255), repeat('a', 256)]);

  -- racha.name: Dono edita; sem trim no servidor (UPDATE direto).
  perform pg_temp.run_target(
    'racha.name (UPDATE direto do Dono)', 'name_racha', 'authenticated', v_owner,
    'update public.racha set name = $1 where id = $2::uuid returning name',
    null, pg_temp.c('racha_a'), null,
    array['FC Amigos 2024', 'Racha d''Água 7', 'Ab', repeat('a', 40), repeat('a', 41), ' Racha ']);

  -- racha.name por quem não é Dono: RLS devolve 0 linhas, nenhum payload grava.
  perform pg_temp.run_target(
    'racha.name (UPDATE direto de Jogador, RLS)', 'never', 'authenticated', v_player,
    'update public.racha set name = $1 where id = $2::uuid returning name',
    null, pg_temp.c('racha_a'), null, array['FC Amigos 2024']);

  -- profile.display_name: sem grant de UPDATE por coluna.
  perform pg_temp.run_target(
    'profile.display_name (UPDATE direto)', 'never', 'authenticated', v_player,
    'update public.profile set display_name = $1 where id = $2::uuid returning display_name',
    null, v_player::text, null, array['Zé Silva']);

  -- profile.display_name no INSERT: sem policy de INSERT.
  perform pg_temp.run_target(
    'profile.display_name (INSERT direto)', 'never', 'authenticated', v_player,
    'insert into public.profile (id, display_name, birth_date, plays_as, terms_accepted_at) values (gen_random_uuid(), $1, date ''1990-01-01'', ''OUTFIELD'', now()) returning display_name',
    null, null, null, array['Zé Silva']);

  -- report.*: grants largos, mas sem policy; só a RPC escreve.
  perform pg_temp.run_target(
    'report.details/reason/status/target_kind (INSERT direto)', 'never', 'authenticated', v_player,
    'insert into public.report (reporter_id, target_kind, target_profile_id, reason, details, status) values ($2::uuid, ''profile'', $3::uuid, ''other'', $1, ''open'') returning details',
    null, v_player::text, v_target::text, array['denúncia comum']);
  perform pg_temp.run_target(
    'report.reason (INSERT direto)', 'never', 'authenticated', v_player,
    'insert into public.report (reporter_id, target_kind, target_profile_id, reason) values ($2::uuid, ''profile'', $3::uuid, $1) returning reason',
    null, v_player::text, v_target::text, array['other']);
end $$;

-- UPDATE direto em report: precisa de uma linha existente; 0 linhas e a linha intacta.
do $$
declare
  v_player uuid := pg_temp.c('player')::uuid;
  v_target uuid := pg_temp.c('target')::uuid;
  v_before text;
begin
  select r.details || '|' || r.status into v_before from public.report r where r.reporter_id = v_player;
  perform pg_temp.run_target(
    'report.details/status/reason/target_kind (UPDATE direto, RLS)', 'never', 'authenticated', v_player,
    'update public.report set details = $1, status = $1, reason = $1, target_kind = $1 where reporter_id = $2::uuid returning id::text',
    null, v_player::text, null, array['dismissed']);
  if (select r.details || '|' || r.status from public.report r where r.reporter_id = v_player) is distinct from v_before then
    raise exception 'FAIL: UPDATE direto alterou a denúncia';
  end if;
end $$;

-- ============================================================
-- 1c. jsonb: nenhuma RPC pública recebe jsonb; a entrada jsonb é raw_user_meta_data
--     do signup (lido por handle_new_user). Texto livre dentro do jsonb:
-- ============================================================
do $$
begin
  perform pg_temp.run_target(
    'signup raw_user_meta_data.display_name', 'name_person', null, null,
    'insert into auth.users (id, raw_user_meta_data) values ($2::uuid, jsonb_build_object(''display_name'', $1, ''birth_date'', ''1990-01-01'', ''plays_as'', ''OUTFIELD'', ''primary_position'', ''ANY'', ''terms_accepted'', true)) returning id::text',
    'select p.display_name from public.profile p where p.id = $2::uuid',
    gen_random_uuid()::text, null,
    array['Zé O''Neil-Silva Jr.', 'Ab', repeat('a', 40), repeat('a', 41)]);
end $$;

-- JSON hostil: estrutura, tipos errados, chaves estranhas. 'cast' = erro cru de cast
-- (22007/22P02): não é injeção, mas é erro não tratado que o app veria como 500.
create temp table hostile (ord integer primary key, label text, doc text, expect text);
insert into pg_temp.hostile values
  (1,  'name_obj',   $fz${"display_name":{"a":"'; drop table public.profile; --"},"birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}$fz$, 'reject'),
  (2,  'name_arr',   $fz${"display_name":["x"],"birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}$fz$, 'reject'),
  (3,  'name_num',   $fz${"display_name":12345,"birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}$fz$, 'reject'),
  (4,  'name_null',  $fz${"display_name":null,"birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}$fz$, 'reject'),
  (5,  'keys_hostis',$fz${"display_name":"Zé Bom","$$":"x","'; drop table public.profile; --":1,"\"":2,"birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}$fz$, 'accept'),
  (6,  'birth_sql',  $fz${"display_name":"Zé Bom","birth_date":"'; drop table public.profile; --","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}$fz$, 'cast'),
  (7,  'birth_obj',  $fz${"display_name":"Zé Bom","birth_date":{"a":1},"plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}$fz$, 'cast'),
  (8,  'terms_sql',  $fz${"display_name":"Zé Bom","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":"'; drop table public.profile; --"}$fz$, 'cast'),
  (9,  'plays_sql',  $fz${"display_name":"Zé Bom","birth_date":"1990-01-01","plays_as":"' OR '1'='1","primary_position":"ANY","terms_accepted":true}$fz$, 'cast'),
  (10, 'pos_sql',    $fz${"display_name":"Zé Bom","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"x'; --","terms_accepted":true}$fz$, 'cast'),
  (11, 'name_rtl',   $fz${"display_name":"Jose‮abc","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}$fz$, 'reject'),
  (12, 'dup_key',    $fz${"display_name":"A1","display_name":"Zé Bom","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}$fz$, 'accept'),
  (13, 'terms_false',$fz${"display_name":"Zé Bom","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":false}$fz$, 'reject'),
  (14, 'empty_obj',  '{}', 'reject'),
  (15, 'extra_role', $fz${"display_name":"Ana Luz","is_admin":true,"role":"service_role","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}$fz$, 'accept'),
  (16, 'name_1M',    '{"display_name":"' || repeat('a', 1000000) || '","birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}', 'reject'),
  (17, 'name_deep',  '{"display_name":' || repeat('[', 500) || repeat(']', 500) || ',"birth_date":"1990-01-01","plays_as":"OUTFIELD","primary_position":"ANY","terms_accepted":true}', 'reject');

do $$
declare
  rec record;
  r record;
  v_id text := gen_random_uuid()::text;
  v_ok boolean;
  v_good boolean;
begin
  for rec in select * from pg_temp.hostile order by ord loop
    select * into r from pg_temp.probe(
      null, null,
      'insert into auth.users (id, raw_user_meta_data) values ($2::uuid, $1::jsonb) returning id::text',
      'select p.display_name from public.profile p where p.id = $2::uuid',
      rec.doc, v_id, null);
    v_ok := r.state = 'ok' and r.has_row;
    if not r.same_schema then
      raise exception 'FAIL: jsonb % schema alterado', rec.label;
    end if;
    v_good := case rec.expect
      when 'accept' then v_ok and r.stored ~ '^[[:alpha:]][[:alpha:] ''.-]*$'
        and r.stored = (rec.doc::jsonb ->> 'display_name')
      when 'reject' then r.state = 'err' and r.code in ('P0001', '23514', '23502')
      when 'cast' then r.state = 'err' and r.code in ('22007', '22P02')
    end;
    if not v_good then
      raise exception 'FAIL: jsonb % esperado % obteve % % %', rec.label, rec.expect, r.state, r.code, left(r.msg, 120);
    end if;
    if rec.expect = 'cast' then
      raise notice 'CAST CRU (não é injeção): jsonb % -> % %', rec.label, r.code, left(r.msg, 100);
    end if;
    if r.ms > 1000 then
      raise notice 'LENTO: jsonb % levou % ms', rec.label, round(r.ms);
    end if;
  end loop;
  raise notice 'PASS: jsonb hostil no signup (% documentos)', (select count(*) from pg_temp.hostile);
end $$;

-- Verificação final do fuzz inteiro.
do $$
declare
  v_b record;
begin
  select * into v_b from pg_temp.before_fuzz;
  if pg_temp.snap() is distinct from v_b.snap then
    raise exception 'FAIL: schema mudou durante o fuzz';
  end if;
  if pg_temp.counts() is distinct from v_b.counts then
    raise exception 'FAIL: contagens mudaram durante o fuzz: % -> %', v_b.counts, pg_temp.counts();
  end if;
  if to_regclass('public.profile') is null or to_regclass('public.racha') is null then
    raise exception 'FAIL: tabela sumiu';
  end if;
  raise notice 'PASS: schema e contagens idênticos antes e depois do fuzz';
end $$;

rollback;
