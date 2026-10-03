-- Sorteio do Evento, etapa 3: Presença depois da confirmação, Saída, Inclusão, Volta,
-- Goleiros, Caixa e Evento legado.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/event_sort_after.sql
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

create function pg_temp.as_(p uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, true);
end $$;

create function pg_temp.id(j jsonb, k text, i integer default null) returns uuid
language plpgsql as $$
begin
  if i is null then
    return (j ->> k)::uuid;
  end if;
  return (j -> k ->> (i - 1))::uuid;
end $$;

-- Racha com 3 de linha por Time. p_line jogadores de linha confirmados, p_extra sem Presença
-- (os p_wait primeiros na fila), p_gk Goleiros confirmados e p_gk_idle sem Presença.
-- Com p_sort, o dono conduz, sorteia e confirma (Evento vira active).
create function pg_temp.fx(
  p_tag text, p_line integer, p_gk integer, p_extra integer, p_limit smallint,
  p_paid boolean default false, p_wait integer default 0, p_gk_idle integer default 0,
  p_sort boolean default true
) returns jsonb
language plpgsql as $$
declare
  v_owner uuid := gen_random_uuid();
  v_out uuid := gen_random_uuid();
  v_line uuid[] := array(select gen_random_uuid() from generate_series(1, p_line + p_extra));
  v_gk uuid[] := array(select gen_random_uuid() from generate_series(1, p_gk + p_gk_idle));
  v_racha uuid;
  v_event uuid;
  v_ver integer;
begin
  insert into auth.users (id, raw_user_meta_data)
  select u.id, jsonb_build_object('display_name', u.name, 'birth_date', '1990-01-01',
    'plays_as', 'OUTFIELD', 'primary_position', 'ANY', 'terms_accepted', true)
  from (
    select v_owner as id, 'Dono Pos' as name
    union all select v_out, 'Fora Pos'
    union all select v_line[i], 'Jogador ' || chr(64 + i) from generate_series(1, cardinality(v_line)) i
    union all select v_gk[i], 'Goleiro ' || chr(64 + i) from generate_series(1, cardinality(v_gk)) i
  ) u;

  insert into public.racha (name, invite_code, place, spot_limit, outfield_per_team)
  values ('Prova Pos ' || p_tag, translate(upper(substr(md5(p_tag), 1, 6)), '01', 'ZY'), 'Quadra Pos', p_limit, 3)
  returning id into v_racha;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, secondary_position, stars)
  select v_racha, v_line[i], 'PLAYER', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER', 1 + i % 5
  from generate_series(1, cardinality(v_line)) i;
  insert into public.member (racha_id, profile_id, role, plays_as)
  select v_racha, v_gk[i], 'PLAYER', 'GOALKEEPER' from generate_series(1, cardinality(v_gk)) i;

  insert into public.event (
    racha_id, starts_on, starts_at, place, status, spot_limit, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule, tie_return_order,
    consider_position, match_duration_min, is_paid, price, payer_target)
  select r.id, current_date + 14, time '19:00', 'Quadra Pos', 'upcoming', p_limit, r.reminder_lead_hours,
    3, r.game_mode, r.max_consecutive_wins, r.tie_rule, r.tie_return_order, false, r.match_duration_min,
    p_paid, case when p_paid then 20 end, case when p_paid then 3 end
  from public.racha r where r.id = v_racha
  returning id into v_event;

  -- o Sorteio só considera quem veio: com p_sort os confirmados já vêm marcados
  insert into public.event_attendance (event_id, profile_id, status, did_attend)
  select v_event, v_line[i], 'confirmed', p_sort from generate_series(1, p_line) i;
  insert into public.event_attendance (event_id, profile_id, status, did_attend)
  select v_event, v_gk[i], 'confirmed', p_sort from generate_series(1, p_gk) i;
  insert into public.event_attendance (event_id, profile_id, status, waitlisted_at)
  select v_event, v_line[p_line + i], 'waitlisted', now() + i * interval '1 second' from generate_series(1, p_wait) i;

  if p_sort then
    perform pg_temp.as_(v_owner);
    perform public.assume_event_conduction(v_event);
    v_ver := (public.prepare_event_sort(v_event) ->> 'version')::integer;
    perform public.confirm_event_sort(v_event, v_ver);
    -- depois de sortear, "veio" volta a ser o que o Dono marca na hora do jogo: os cenários
    -- de Caixa abaixo contam presença marcada, não o pré-requisito do Sorteio
    update public.event_attendance ea set did_attend = false where ea.event_id = v_event;
  end if;

  return jsonb_build_object('owner', v_owner, 'out', v_out, 'racha', v_racha, 'event', v_event,
    'line', to_jsonb(v_line), 'gk', to_jsonb(v_gk));
end $$;

-- número do Time em que a pessoa está agora (nulo se não está em nenhum)
create function pg_temp.team_of(p_event uuid, p_person uuid) returns integer
language sql as $$
  select t.team_number from public.event_sort_team_player p
  join public.event_sort_team t on t.id = p.team_id
  where p.event_id = p_event and p.person_id = p_person and p.left_at is null;
$$;

create function pg_temp.passes(p_event uuid, p_person uuid) returns integer
language sql as $$
  select count(*)::integer from public.event_sort_team_player p
  where p.event_id = p_event and p.person_id = p_person;
$$;

create function pg_temp.active_in(p_event uuid, p_team_number integer) returns integer
language sql as $$
  select count(*)::integer from public.event_sort_team_player p
  join public.event_sort_team t on t.id = p.team_id
  where p.event_id = p_event and t.team_number = p_team_number and p.left_at is null;
$$;

create function pg_temp.queue_of(p_event uuid, p_team_number integer) returns integer
language sql as $$
  select t.queue_order from public.event_sort_team t where t.event_id = p_event and t.team_number = p_team_number;
$$;

create function pg_temp.att(p_event uuid, p_person uuid) returns text
language sql as $$
  select ea.status::text from public.event_attendance ea where ea.event_id = p_event and ea.profile_id = p_person;
$$;

-- Goleiros: com Time / na fila
create function pg_temp.gk_team(p_event uuid) returns integer
language sql as $$
  select count(*)::integer from public.event_sort_goalkeeper k where k.event_id = p_event and k.team_id is not null;
$$;

create function pg_temp.gk_queue(p_event uuid) returns integer
language sql as $$
  select count(*)::integer from public.event_sort_goalkeeper k where k.event_id = p_event and k.queue_order is not null;
$$;

create function pg_temp.gk_of_team(p_event uuid, p_team_number integer) returns uuid
language sql as $$
  select k.person_id from public.event_sort_goalkeeper k
  join public.event_sort_team t on t.id = k.team_id
  where k.event_id = p_event and t.team_number = p_team_number;
$$;

-- nenhum Goleiro na linha, nenhum jogador ativo em dois lugares, nenhum Time ativo vazio
create function pg_temp.invariants(p_event uuid, p_label text) returns void
language plpgsql as $$
begin
  perform pg_temp.assert_that(not exists (
    select 1 from public.event_sort_team_player p
    join public.event_sort_goalkeeper k on k.event_id = p.event_id and k.person_id = p.person_id
  ), p_label || ': Goleiro nunca na linha');
  perform pg_temp.assert_that(not exists (
    select 1 from public.event_sort_team t where t.event_id = p_event and t.queue_order is not null
      and not exists (select 1 from public.event_sort_team_player p where p.team_id = t.id and p.left_at is null)
  ), p_label || ': Time ativo nunca vazio');
  perform pg_temp.assert_that(not exists (
    select 1 from public.event_sort_team t where t.event_id = p_event and t.queue_order is null
      and exists (select 1 from public.event_sort_team_player p where p.team_id = t.id and p.left_at is null)
  ), p_label || ': Time arquivado sem jogador ativo');
  perform pg_temp.assert_that((
    select coalesce(array_agg(t.queue_order order by t.queue_order), '{}') from public.event_sort_team t
    where t.event_id = p_event and t.queue_order is not null
  ) = array(select generate_series(1, (select count(*) from public.event_sort_team t
    where t.event_id = p_event and t.queue_order is not null))::smallint), p_label || ': fila contígua');
  perform pg_temp.assert_that(not exists (
    select 1 from public.event_sort_team_player p
    join public.event_attendance ea on ea.event_id = p.event_id and ea.profile_id = p.person_id
    where p.left_at is null and ea.status <> 'confirmed'
  ), p_label || ': jogador ativo no Time sempre confirmed');
  perform pg_temp.assert_that(not exists (
    select 1 from public.event_sort_team_player p
    join public.event_guest g on g.id = p.person_id
    where p.left_at is null and g.left_at is not null
  ), p_label || ': Avulso que saiu fora do Time');
  perform pg_temp.assert_that(not exists (
    select 1 from public.event_sort_goalkeeper k
    join public.event_attendance ea on ea.event_id = k.event_id and ea.profile_id = k.person_id
    where ea.status <> 'confirmed'
  ), p_label || ': Goleiro na fila/Time sempre confirmed');
end $$;

-- ============================================================
-- 1. Limite cheio, fila paga sem promoção, vaga reaberta e Inclusão
-- ============================================================
do $$
declare
  j jsonb := pg_temp.fx('um', 6, 2, 3, 8::smallint, true, 2);
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_r uuid := pg_temp.id(j, 'racha');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 9) i);
  v_g uuid[] := array(select pg_temp.id(j, 'gk', i) from generate_series(1, 2) i);
  v_pub jsonb;
begin
  perform pg_temp.assert_that(private.event_occupancy(v_e) = 8 and (select spot_limit from public.event where id = v_e) = 8,
    'limite cheio: 6 de linha + 2 Goleiros = 8');

  -- Presença livre acabou
  perform pg_temp.as_(v_l[1]);
  perform pg_temp.assert_that(pg_temp.err(format('select public.cancel_attendance(%L)', v_e)) = 'sort_confirmed', 'confirmado não cancela livre');
  perform pg_temp.as_(v_l[7]);
  perform pg_temp.assert_that(pg_temp.err(format('select public.cancel_attendance(%L)', v_e)) = 'sort_confirmed', 'fila não cancela livre');
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_attendance(%L)', v_e)) = 'sort_confirmed', 'fila não reconfirma');
  perform pg_temp.as_(v_l[9]);
  perform pg_temp.assert_that(pg_temp.err(format('select public.confirm_attendance(%L)', v_e)) = 'sort_confirmed', 'atrasado não confirma livre');
  perform pg_temp.as_(v_o);
  perform pg_temp.assert_that(pg_temp.err(format('select public.set_attendance_for_member(%L, %L, ''confirmed'')', v_e, v_l[9])) = 'sort_confirmed',
    'Dono não confirma em nome de ninguém');
  perform pg_temp.assert_that(pg_temp.err(format('select public.set_attendance_for_member(%L, %L, ''cancelled'')', v_e, v_l[1])) = 'sort_confirmed',
    'Dono não cancela em nome de ninguém');
  perform pg_temp.assert_that(pg_temp.err(format('select public.add_guest(%L, ''Avulso Novo'', ''OUTFIELD'', ''ANY'', null, 3::smallint, false)', v_e)) = 'sort_confirmed',
    'add_guest fechado depois do Sorteio');
  raise notice 'PASS: confirmar/cancelar/add_guest livres bloqueados com sort_confirmed';

  -- pagar na fila segue valendo; vira fato sem vaga
  perform public.set_attendance_paid(v_e, v_l[7], null, true);
  perform pg_temp.assert_that((select not had_slot_since_payment and cash_paid_amount = 20 from public.event_payment_fact
    where event_id = v_e and profile_id = v_l[7]), 'pagou na fila: fato sem vaga');

  -- Saída própria abre vaga mas a fila NÃO sobe
  perform pg_temp.as_(v_l[1]);
  v_pub := public.leave_event_sort(v_e, v_l[1]);
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[1]) = 'left', 'Saída marca left');
  perform pg_temp.assert_that(private.event_occupancy(v_e) = 7, 'left não ocupa vaga');
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[7]) = 'waitlisted' and pg_temp.att(v_e, v_l[8]) = 'waitlisted',
    'a fila segue aguardando com a vaga aberta');
  perform pg_temp.assert_that(jsonb_array_length(v_pub -> 'waiting_for_inclusion') = 2, 'Aguardando inclusão lista os 2');
  perform pg_temp.assert_that(v_pub -> 'left' -> 0 ->> 'profile_id' = v_l[1]::text, 'left lista quem saiu');
  perform pg_temp.assert_that((select count(*) from public.list_event_attendance(v_e) where profile_id = v_l[1] and status = 'left') = 1,
    'list_event_attendance mostra left');
  perform pg_temp.assert_that((select confirmed_count from public.list_open_events(v_r) where id = v_e) = 7
    and (select sort_confirmed from public.list_open_events(v_r) where id = v_e)
    and (select my_status from public.list_open_events(v_r) where id = v_e) = 'left', 'list_open_events: contagem, flag e left');
  perform pg_temp.assert_that((select confirmed_count from public.list_my_racha_events() where id = v_e) = 7
    and (select my_status from public.list_my_racha_events() where id = v_e) = 'left', 'list_my_racha_events: left e vaga');

  -- aumentar o Limite não promove a fila
  perform pg_temp.as_(v_o);
  perform public.update_event(v_e, current_date + 14, time '19:00', 'Quadra Pos', true, 20, 10::smallint, 3);
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[7]) = 'waitlisted' and pg_temp.att(v_e, v_l[8]) = 'waitlisted',
    'aumentar o Limite também não promove');
  perform public.update_event(v_e, current_date + 14, time '19:00', 'Quadra Pos', true, 20, 8::smallint, 3);

  -- Inclusão respeita o Limite: 7/8 -> entra um, o outro bate no teto
  perform pg_temp.as_(v_l[2]);
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_l[7])) = 'not_conductor', 'Jogador não inclui');
  perform pg_temp.as_(v_o);
  v_pub := public.include_event_sort_member(v_e, v_l[7]);
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[7]) = 'confirmed' and pg_temp.team_of(v_e, v_l[7]) is not null, 'quem estava na fila entrou num Time');
  perform pg_temp.assert_that((select had_slot_since_payment from public.event_payment_fact where event_id = v_e and profile_id = v_l[7]),
    'pago na fila ganha vaga: had_slot_since_payment');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_l[8])) = 'spot_limit', 'teto cheio barra a Inclusão');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_guest(%L, ''Avulso Beta'', ''OUTFIELD'', ''ANY'', null, 3::smallint, false)', v_e)) = 'spot_limit',
    'teto cheio barra o Avulso');
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[8]) = 'waitlisted' and jsonb_array_length(v_pub -> 'waiting_for_inclusion') = 1, 'o outro segue Aguardando inclusão');
  perform pg_temp.invariants(v_e, 'cenário 1');
  raise notice 'PASS: limite cheio, fila paga sem promoção, Saída abre vaga sem subir a fila, Inclusão respeita o teto';
end $$;

-- ============================================================
-- 2. Saída: própria, de terceiro, pelo Condutor, idempotente, estados do Evento
-- ============================================================
do $$
declare
  j jsonb := pg_temp.fx('dois', 6, 1, 2, null, false, 1);
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_x uuid := pg_temp.id(j, 'out');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 8) i);
  v_n integer;
  v_pub jsonb;
  v_before jsonb;
begin
  perform pg_temp.as_(v_l[2]);
  v_pub := public.get_event_sort(v_e);
  perform pg_temp.assert_that((v_pub -> 'viewer' ->> 'can_leave_self')::boolean and not (v_pub -> 'viewer' ->> 'can_include')::boolean
    and not (v_pub -> 'viewer' ->> 'can_leave_any')::boolean, 'permissões do Jogador: só a própria Saída');
  perform pg_temp.assert_that(pg_temp.err(format('select public.leave_event_sort(%L, %L)', v_e, v_l[3])) = 'not_conductor', 'Jogador não tira o outro');
  perform pg_temp.assert_that(pg_temp.err(format('select public.leave_event_sort(%L, null, %L)', v_e, gen_random_uuid())) = 'not_conductor', 'Jogador não tira Avulso');
  perform pg_temp.assert_that(pg_temp.err(format('select public.leave_event_sort(%L)', v_e)) = 'not_allowed', 'sem alvo: not_allowed');
  perform pg_temp.assert_that(pg_temp.err(format('select public.leave_event_sort(%L, %L, %L)', v_e, v_l[2], gen_random_uuid())) = 'not_allowed', 'dois alvos: not_allowed');
  perform pg_temp.as_(v_x);
  perform pg_temp.assert_that(pg_temp.err(format('select public.leave_event_sort(%L, %L)', v_e, v_x)) = 'not_member', 'não Membro não sai');
  perform pg_temp.as_(v_l[7]);
  perform pg_temp.assert_that(pg_temp.err(format('select public.leave_event_sort(%L, %L)', v_e, v_l[7])) = 'not_confirmed', 'quem está na fila não tem Saída');
  perform pg_temp.as_(v_l[8]);
  perform pg_temp.assert_that(pg_temp.err(format('select public.leave_event_sort(%L, %L)', v_e, v_l[8])) = 'not_confirmed', 'quem nunca confirmou não tem Saída');

  -- própria
  perform pg_temp.as_(v_l[2]);
  v_n := pg_temp.team_of(v_e, v_l[2]);
  perform public.leave_event_sort(v_e, v_l[2]);
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[2]) = 'left' and pg_temp.team_of(v_e, v_l[2]) is null
    and pg_temp.passes(v_e, v_l[2]) = 1 and (select left_at is not null from public.event_sort_team_player where event_id = v_e and person_id = v_l[2]),
    'Saída própria fecha a passagem e preserva o histórico');
  -- idempotente
  v_before := (select jsonb_agg(to_jsonb(p) order by p.id) from public.event_sort_team_player p where p.event_id = v_e);
  perform public.leave_event_sort(v_e, v_l[2]);
  perform public.leave_event_sort(v_e, v_l[2]);
  perform pg_temp.assert_that(v_before = (select jsonb_agg(to_jsonb(p) order by p.id) from public.event_sort_team_player p where p.event_id = v_e)
    and pg_temp.passes(v_e, v_l[2]) = 1, 'repetir a Saída não cria nem altera período');
  perform pg_temp.as_(v_o);
  perform public.leave_event_sort(v_e, v_l[2]);
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[2]) = 'left' and pg_temp.passes(v_e, v_l[2]) = 1, 'Condutor repetindo também é inofensivo');

  -- pelo Condutor
  perform public.leave_event_sort(v_e, v_l[3]);
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[3]) = 'left' and pg_temp.team_of(v_e, v_l[3]) is null, 'Condutor registra a Saída de outro');
  v_pub := public.get_event_sort(v_e);
  perform pg_temp.assert_that((v_pub -> 'viewer' ->> 'can_include')::boolean and (v_pub -> 'viewer' ->> 'can_leave_any')::boolean
    and (v_pub -> 'viewer' ->> 'can_return')::boolean, 'permissões do Condutor');
  perform pg_temp.assert_that(jsonb_array_length(v_pub -> 'left') = 2, 'dois na lista de quem saiu');

  -- um Admin que não conduz também não tira ninguém
  perform pg_temp.as_(v_x);
  perform pg_temp.assert_that(pg_temp.err(format('select public.leave_event_sort(%L, %L)', v_e, v_l[4])) = 'not_member', 'estranho não tira ninguém');

  -- Evento fora de active: finished recusa
  perform pg_temp.as_(v_o);
  perform public.finish_event(v_e);
  perform pg_temp.assert_that(pg_temp.err(format('select public.leave_event_sort(%L, %L)', v_e, v_l[4])) = 'event_not_active', 'Evento encerrado: sem Saída');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_l[8])) = 'event_not_active', 'Evento encerrado: sem Inclusão');
  perform pg_temp.assert_that(pg_temp.err(format('select public.return_event_sort_player(%L, %L)', v_e, v_l[2])) = 'event_not_active', 'Evento encerrado: sem Volta');
  raise notice 'PASS: Saída própria, de terceiro proibida, pelo Condutor, idempotente e com Evento encerrado';
end $$;

-- ============================================================
-- 3. Avulso: Inclusão, Saída, remove_guest vira Saída, Volta e pagamento preservado
-- ============================================================
do $$
declare
  j jsonb := pg_temp.fx('tres', 6, 0, 0, null, true);
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 6) i);
  v_pub jsonb;
  v_guest uuid;
  v_guest2 uuid;
  v_gkg uuid;
  v_team integer;
begin
  perform pg_temp.as_(v_o);
  v_pub := public.include_event_sort_guest(v_e, 'Avulso Alfa', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  select g.id into v_guest from public.event_guest g where g.event_id = v_e and g.display_name = 'Avulso Alfa';
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_guest) = 3 and pg_temp.queue_of(v_e, 3) = 3, 'Avulso novo abre Time 3 no fim da fila');
  perform public.set_attendance_paid(v_e, null, v_guest, true);
  perform public.set_attendance_attended(v_e, null, v_guest, true);
  perform pg_temp.assert_that(private.event_occupancy(v_e) = 7, 'Avulso ocupa vaga');

  -- Admin que não conduz não registra Saída pelo remove_guest
  perform pg_temp.assert_that((public.get_event_sort(v_e) -> 'viewer' ->> 'can_leave_any')::boolean, 'Condutor pode');

  -- remove_guest com Sorteio confirmado vira Saída: o Avulso não é apagado
  perform public.remove_guest(v_guest);
  perform pg_temp.assert_that(exists (select 1 from public.event_guest where id = v_guest and left_at is not null), 'Avulso preservado com left_at');
  perform pg_temp.assert_that(pg_temp.passes(v_e, v_guest) = 1 and pg_temp.team_of(v_e, v_guest) is null,
    'histórico do Time preservado, fora do Time');
  perform pg_temp.assert_that(private.event_occupancy(v_e) = 6, 'Avulso que saiu não ocupa vaga');
  perform pg_temp.assert_that(pg_temp.queue_of(v_e, 3) is null and pg_temp.queue_of(v_e, 1) = 1, 'Time esvaziado saiu da fila ativa');
  perform pg_temp.assert_that((select is_paid and did_attend from public.event_guest where id = v_guest), 'pagamento e comparecimento do Avulso mantidos');
  perform pg_temp.assert_that(exists (select 1 from public.list_event_attendance(v_e) where guest_id = v_guest and status = 'left' and is_paid_effective and did_attend),
    'list_event_attendance mostra o Avulso como left, pago e presente');
  perform public.remove_guest(v_guest);
  perform pg_temp.assert_that(pg_temp.passes(v_e, v_guest) = 1, 'remove_guest repetido é idempotente');
  perform pg_temp.assert_that((public.get_event_sort(v_e) -> 'left' -> 0 ->> 'guest_id') = v_guest::text, 'lista quem saiu inclui o Avulso');

  -- Volta do Avulso: Time novo (3 já arquivado) e passagem nova
  v_pub := public.return_event_sort_player(v_e, null, v_guest);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_guest) = 4 and pg_temp.passes(v_e, v_guest) = 2 and pg_temp.queue_of(v_e, 4) = 3,
    'Volta do Avulso cria o Time 4 no fim; sem retorno ao antigo');
  perform pg_temp.assert_that(pg_temp.err(format('select public.return_event_sort_player(%L, null, %L)', v_e, v_guest)) = 'not_left', 'Volta de quem não saiu');
  perform pg_temp.assert_that(pg_temp.err(format('select public.return_event_sort_player(%L, null, %L)', v_e, gen_random_uuid())) = 'not_left', 'Volta de Avulso inexistente');

  -- Avulso Goleiro entra na fila do gol, nunca na linha
  perform public.include_event_sort_guest(v_e, 'Avulso Gol', 'GOALKEEPER', null, null, null, false);
  select g.id into v_gkg from public.event_guest g where g.event_id = v_e and g.display_name = 'Avulso Gol';
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_gkg) is null and pg_temp.passes(v_e, v_gkg) = 0
    and exists (select 1 from public.event_sort_goalkeeper where event_id = v_e and guest_id = v_gkg), 'Avulso Goleiro vai para o gol');
  perform public.leave_event_sort(v_e, null, v_gkg);
  perform pg_temp.assert_that(not exists (select 1 from public.event_sort_goalkeeper where event_id = v_e and guest_id = v_gkg)
    and exists (select 1 from public.event_guest where id = v_gkg and left_at is not null), 'Saída de Goleiro Avulso tira do gol e preserva a linha');
  perform public.return_event_sort_player(v_e, null, v_gkg);
  perform pg_temp.assert_that(exists (select 1 from public.event_sort_goalkeeper where event_id = v_e and guest_id = v_gkg)
    and pg_temp.passes(v_e, v_gkg) = 0, 'Volta de Goleiro Avulso volta ao gol');
  perform pg_temp.invariants(v_e, 'cenário 3');
  raise notice 'PASS: Avulso: Inclusão, Saída, remove_guest sem apagar, Volta e Goleiro Avulso';
end $$;

-- ============================================================
-- 4. Inclusão (null, cancelled, waitlisted), Time incompleto, Time novo, Volta e histórico
-- ============================================================
do $$
declare
  j jsonb := pg_temp.fx('quatro', 6, 1, 5, null, false, 1);
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_r uuid := pg_temp.id(j, 'racha');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 11) i);
  v_k integer;
  v_old integer;
  v_stars smallint;
begin
  -- v_l[7] está na fila; v_l[8] cancelou antes do Sorteio; v_l[9..11] sem Presença
  insert into public.event_attendance (event_id, profile_id, status) values (v_e, v_l[8], 'cancelled');
  perform pg_temp.as_(v_o);

  perform public.include_event_sort_member(v_e, v_l[9]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[9]) = 3 and pg_temp.queue_of(v_e, 3) = 3, 'sem Presença: Time novo (3) no fim');
  perform public.include_event_sort_member(v_e, v_l[8]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[8]) = 3 and pg_temp.att(v_e, v_l[8]) = 'confirmed', 'cancelled: entra no Time incompleto');
  perform public.include_event_sort_member(v_e, v_l[7]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[7]) = 3 and pg_temp.active_in(v_e, 3) = 3
    and (select waitlisted_at is null from public.event_attendance where event_id = v_e and profile_id = v_l[7]), 'waitlisted: completa o Time 3');
  perform public.include_event_sort_member(v_e, v_l[10]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[10]) = 4 and pg_temp.queue_of(v_e, 4) = 4, 'Time completo: cria o Time 4 no fim');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_l[10])) = 'already_participating', 'confirmado não é incluído');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, (pg_temp.id(j, 'out')))) = 'not_member', 'não Membro não é incluído');
  perform pg_temp.assert_that((select count(*) from public.event_sort_team_player p where p.event_id = v_e and p.person_id = pg_temp.id(j, 'gk', 1)) = 0,
    'Goleiro nunca na linha');

  -- Saída e Inclusão preenchendo o primeiro Time incompleto da fila
  v_k := pg_temp.team_of(v_e, v_l[1]);
  perform public.leave_event_sort(v_e, v_l[1]);
  perform pg_temp.assert_that(pg_temp.active_in(v_e, v_k) = 2, 'Time perdeu um');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_l[1])) = 'use_return', 'quem saiu volta só pela Volta');
  perform public.include_event_sort_member(v_e, v_l[11]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[11]) = v_k, 'Inclusão vai para o primeiro Time incompleto da fila (antes do Time 4)');

  -- Volta: mesmo destino da Inclusão, sem retorno ao Time antigo; dado atual na entrada
  perform pg_temp.assert_that(pg_temp.err(format('select public.return_event_sort_player(%L, %L)', v_e, v_l[2])) = 'not_left', 'Volta de quem não saiu');
  perform pg_temp.assert_that(pg_temp.err(format('select public.return_event_sort_player(%L, %L)', v_e, pg_temp.id(j, 'out'))) = 'not_left', 'Volta de quem nunca esteve');
  perform pg_temp.as_(v_l[2]);
  perform pg_temp.assert_that(pg_temp.err(format('select public.return_event_sort_player(%L, %L)', v_e, v_l[1])) = 'not_conductor', 'Jogador não faz Volta');
  perform pg_temp.as_(v_o);
  update public.member set stars = 5 where racha_id = v_r and profile_id = v_l[1];
  select p.stars_snapshot into v_old from public.event_sort_team_player p where p.event_id = v_e and p.person_id = v_l[1];
  perform public.return_event_sort_player(v_e, v_l[1]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[1]) = 4, 'Volta vai para o Time 4 (o único incompleto), não para o antigo');
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[1]) <> v_k, 'sem retorno automático');
  perform pg_temp.assert_that(pg_temp.passes(v_e, v_l[1]) = 2, 'histórico: duas passagens');
  select p.stars_snapshot into v_stars from public.event_sort_team_player p
  where p.event_id = v_e and p.person_id = v_l[1] and p.left_at is null;
  perform pg_temp.assert_that(v_old = 2 and v_stars = 5, 'snapshot antigo preservado, novo com o dado atual');
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[1]) = 'confirmed', 'Volta confirma a Presença');
  perform pg_temp.invariants(v_e, 'cenário 4');

  -- a leitura publicada reflete os Times ativos, em ordem de fila
  perform pg_temp.assert_that((select count(*) from jsonb_array_elements(public.get_event_sort(v_e) -> 'teams') t where (t ->> 'is_active')::boolean) = 4,
    'quatro Times ativos na leitura');
  raise notice 'PASS: Inclusão (sem Presença, cancelled, waitlisted), Time incompleto, Time novo, Volta e histórico';
end $$;

-- ============================================================
-- 5. Time esvaziado sai da fila ativa; Membro que sai do Racha ou é expulso sai do Time
-- ============================================================
do $$
declare
  j jsonb := pg_temp.fx('cinco', 6, 2, 2, null);
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_r uuid := pg_temp.id(j, 'racha');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 8) i);
  v_two uuid[];
  v_one uuid[];
  v_gk_t1 uuid;
  v_i integer;
begin
  perform pg_temp.assert_that(pg_temp.gk_team(v_e) = 2 and pg_temp.gk_queue(v_e) = 0, '2 Goleiros, 2 Times: cada um com o seu');
  v_gk_t1 := pg_temp.gk_of_team(v_e, 1);
  select array_agg(p.person_id order by p.person_id) into v_two from public.event_sort_team_player p
    join public.event_sort_team t on t.id = p.team_id where p.event_id = v_e and t.team_number = 2;
  select array_agg(p.person_id order by p.person_id) into v_one from public.event_sort_team_player p
    join public.event_sort_team t on t.id = p.team_id where p.event_id = v_e and t.team_number = 1;
  perform pg_temp.as_(v_o);
  perform public.leave_event_sort(v_e, v_two[1]);
  perform public.leave_event_sort(v_e, v_two[2]);
  perform pg_temp.assert_that(pg_temp.queue_of(v_e, 2) = 2, 'Time com 1 ativo segue na fila');
  perform public.leave_event_sort(v_e, v_two[3]);
  perform pg_temp.assert_that(pg_temp.queue_of(v_e, 2) is null and pg_temp.queue_of(v_e, 1) = 1, 'Time sem ninguém ativo sai da fila ativa');
  perform pg_temp.assert_that((select count(*) from public.event_sort_team_player p join public.event_sort_team t on t.id = p.team_id
      where p.event_id = v_e and t.team_number = 2 and p.left_at is not null) = 3, 'histórico do Time arquivado preservado');
  perform pg_temp.assert_that(exists (select 1 from jsonb_array_elements(public.get_event_sort(v_e) -> 'teams') t
      where (t ->> 'team_number') = '2' and not (t ->> 'is_active')::boolean and (t ->> 'player_count') = '0'), 'leitura marca o Time 2 como inativo');
  perform pg_temp.assert_that(pg_temp.gk_of_team(v_e, 1) = v_gk_t1 and pg_temp.gk_queue(v_e) = 1 and pg_temp.gk_team(v_e) = 1,
    'recálculo: Goleiro do Time ativo fica; o do Time arquivado vai para a fila');

  -- quem entra depois cria Time novo no fim da fila (não reativa o arquivado)
  perform public.include_event_sort_member(v_e, v_l[7]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[7]) = 3 and pg_temp.queue_of(v_e, 3) = 2 and pg_temp.queue_of(v_e, 2) is null,
    'Time novo (3) em vez de reativar o 2');
  perform pg_temp.assert_that(pg_temp.gk_team(v_e) = 2 and pg_temp.gk_queue(v_e) = 0 and pg_temp.gk_of_team(v_e, 1) = v_gk_t1,
    'Time novo recebe o Goleiro da fila');
  perform pg_temp.invariants(v_e, 'cenário 5a');

  -- Membro sai do Racha: sai do Time (Presença apagada como antes)
  perform pg_temp.as_(v_one[1]);
  perform public.leave_racha(v_r);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_one[1]) is null and pg_temp.att(v_e, v_one[1]) is null
    and pg_temp.passes(v_e, v_one[1]) = 1, 'leave_racha: sai do Time, histórico mantido');
  -- expulso também
  perform pg_temp.as_(v_o);
  perform public.expel_member(v_r, v_one[2]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_one[2]) is null and pg_temp.att(v_e, v_one[2]) is null, 'expulsão: sai do Time');
  perform pg_temp.assert_that(pg_temp.active_in(v_e, 1) = 1, 'Time 1 com 1 ativo');
  perform pg_temp.invariants(v_e, 'cenário 5b');
  -- sem promoção mesmo com o evento cheio de vagas abertas
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[8]) is null, 'ninguém é promovido sozinho');
  raise notice 'PASS: Time esvaziado arquivado, Time novo no fim, Goleiros recalculados; leave_racha e expulsão fecham a passagem';
end $$;

-- ============================================================
-- 6. Goleiros: regime por Time x rodízio, entrada e saída, nunca na linha
-- ============================================================
do $$
declare
  j jsonb := pg_temp.fx('seis', 9, 3, 4, null, false, 0, 1);
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 13) i);
  v_g uuid[] := array(select pg_temp.id(j, 'gk', i) from generate_series(1, 4) i);
  v_m1 uuid; v_m2 uuid; v_m3 uuid;
  v_t4 uuid[];
  v_gks uuid;
begin
  perform pg_temp.as_(v_o);
  perform pg_temp.assert_that(pg_temp.gk_team(v_e) = 3 and pg_temp.gk_queue(v_e) = 0, '3 Goleiros em 3 Times: cada um com o seu');

  -- Goleiro sai: 2 < 3 Times, rodízio (todos na fila, nenhum de Time)
  perform pg_temp.as_(v_g[1]);
  perform public.leave_event_sort(v_e, v_g[1]);
  perform pg_temp.assert_that(pg_temp.att(v_e, v_g[1]) = 'left' and pg_temp.gk_team(v_e) = 0 and pg_temp.gk_queue(v_e) = 2
    and not exists (select 1 from public.event_sort_goalkeeper where event_id = v_e and person_id = v_g[1]), 'Goleiro saiu: 2 Goleiros, 3 Times, rodízio');
  perform pg_temp.assert_that(pg_temp.passes(v_e, v_g[1]) = 0, 'Goleiro não tem passagem por Time');
  perform pg_temp.assert_that(private.event_occupancy(v_e) = 11, 'Goleiro que saiu libera a vaga');
  perform pg_temp.invariants(v_e, 'cenário 6a');

  -- Goleiro volta: 3 >= 3, cada Time com o seu de novo
  perform pg_temp.as_(v_o);
  perform public.return_event_sort_player(v_e, v_g[1]);
  perform pg_temp.assert_that(pg_temp.gk_team(v_e) = 3 and pg_temp.gk_queue(v_e) = 0 and pg_temp.passes(v_e, v_g[1]) = 0,
    'Goleiro voltou: volta o regime por Time; nunca na linha');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_g[1])) = 'already_participating', 'Goleiro confirmado não é incluído');

  -- chega gente e forma o Time 4: 3 < 4, rodízio
  perform public.include_event_sort_member(v_e, v_l[10]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[10]) = 4 and pg_temp.gk_team(v_e) = 0 and pg_temp.gk_queue(v_e) = 3,
    'Time novo sem Goleiro sobrando: rodízio, fila com 3');

  -- chega o 4º Goleiro (Inclusão): 4 >= 4, cada Time com o seu
  perform public.include_event_sort_member(v_e, v_g[4]);
  perform pg_temp.assert_that(pg_temp.gk_team(v_e) = 4 and pg_temp.gk_queue(v_e) = 0 and pg_temp.passes(v_e, v_g[4]) = 0,
    'Goleiro incluído entra na distribuição, não na linha');
  perform pg_temp.assert_that(pg_temp.att(v_e, v_g[4]) = 'confirmed', 'Goleiro incluído confirmado');

  -- o Time 4 esvazia: 4 Goleiros, 3 Times; Times 1-3 ficam com os seus; o do Time 4 espera na fila
  v_m1 := pg_temp.gk_of_team(v_e, 1);
  v_m2 := pg_temp.gk_of_team(v_e, 2);
  v_m3 := pg_temp.gk_of_team(v_e, 3);
  v_gks := pg_temp.gk_of_team(v_e, 4);
  perform public.leave_event_sort(v_e, v_l[10]);
  perform pg_temp.assert_that(pg_temp.queue_of(v_e, 4) is null and pg_temp.gk_of_team(v_e, 1) = v_m1 and pg_temp.gk_of_team(v_e, 2) = v_m2
    and pg_temp.gk_of_team(v_e, 3) = v_m3 and pg_temp.gk_team(v_e) = 3 and pg_temp.gk_queue(v_e) = 1
    and exists (select 1 from public.event_sort_goalkeeper where event_id = v_e and person_id = v_gks and queue_order = 1),
    'Goleiro sobrando espera na fila; quem está num Time ativo fica com ele');

  -- Goleiro Avulso entra na fila
  perform public.include_event_sort_guest(v_e, 'Avulso Gol', 'GOALKEEPER', null, null, null, false);
  perform pg_temp.assert_that(pg_temp.gk_team(v_e) = 3 and pg_temp.gk_queue(v_e) = 2, 'Goleiro Avulso na fila do gol');

  -- Goleiro de um Time ativo sai: o primeiro da fila assume o Time
  perform public.leave_event_sort(v_e, v_m2);
  perform pg_temp.assert_that(pg_temp.gk_team(v_e) = 3 and pg_temp.gk_queue(v_e) = 1 and pg_temp.gk_of_team(v_e, 2) = v_gks
    and pg_temp.gk_of_team(v_e, 1) = v_m1 and pg_temp.gk_of_team(v_e, 3) = v_m3, 'Time sem Goleiro pega o primeiro da fila do gol');
  perform pg_temp.assert_that(not exists (
    select 1 from public.event_sort_team_player p where p.event_id = v_e and p.person_id = any (v_g)
  ), 'nenhum Goleiro na linha em todo o cenário');
  perform pg_temp.invariants(v_e, 'cenário 6b');
  raise notice 'PASS: Goleiros: por Time x rodízio, entrada, saída, Time arquivado e nunca na linha';
end $$;

-- ============================================================
-- 7. Evento active legado e upcoming seguem o fluxo antigo
-- ============================================================
do $$
declare
  j jsonb := pg_temp.fx('sete', 0, 0, 8, 6::smallint, false, 0, 0, false);
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 8) i);
  v_guest uuid;
  v_i integer;
begin
  -- upcoming: confirmar, fila, cancelar promove, Avulso remove
  for v_i in 1..8 loop
    perform pg_temp.as_(v_l[v_i]);
    perform public.confirm_attendance(v_e);
  end loop;
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[7]) = 'waitlisted' and pg_temp.att(v_e, v_l[8]) = 'waitlisted', 'upcoming: 7º e 8º na fila');
  perform pg_temp.as_(v_l[1]);
  perform public.cancel_attendance(v_e);
  -- a ordem de quem entrou na mesma transação é o desempate por id: o teste não depende dela
  perform pg_temp.assert_that((pg_temp.att(v_e, v_l[7]) = 'confirmed') <> (pg_temp.att(v_e, v_l[8]) = 'confirmed'), 'upcoming: cancelar promove um da fila');

  -- legado: active sem Sorteio
  update public.event set status = 'active', conductor_id = v_o where id = v_e;
  perform pg_temp.as_(v_l[2]);
  perform public.cancel_attendance(v_e);
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[7]) = 'confirmed' and pg_temp.att(v_e, v_l[8]) = 'confirmed', 'legado: cancelar promove o restante da fila');
  perform public.confirm_attendance(v_e);
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[2]) = 'waitlisted', 'legado: confirmar volta para a fila quando cheio');
  perform pg_temp.as_(v_o);
  perform public.set_attendance_for_member(v_e, v_l[3], 'cancelled');
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[2]) = 'confirmed', 'legado: Dono cancelar em nome de outro promove a fila');
  perform public.set_attendance_for_member(v_e, v_l[4], 'cancelled');
  v_guest := public.add_guest(v_e, 'Avulso Legado', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  perform pg_temp.assert_that(pg_temp.err(format('select public.add_guest(%L, ''Outro Avulso'', ''OUTFIELD'', ''ANY'', null, 3::smallint, false)', v_e)) = 'spot_limit', 'legado: teto cheio barra Avulso');
  perform pg_temp.as_(v_l[4]);
  perform public.confirm_attendance(v_e);
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[4]) = 'waitlisted', 'legado: Avulso ocupou a vaga, 4 na fila');
  perform pg_temp.as_(v_o);
  perform public.remove_guest(v_guest);
  perform pg_temp.assert_that(not exists (select 1 from public.event_guest where id = v_guest), 'legado: remove_guest apaga o Avulso');
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[4]) = 'confirmed', 'legado: remover Avulso promove a fila');
  perform public.set_attendance_for_member(v_e, v_l[3], 'confirmed');
  perform pg_temp.assert_that(not private.event_sort_confirmed(v_e), 'sem Sorteio confirmado');
  -- Saída/Inclusão/Volta não existem sem Sorteio
  perform pg_temp.assert_that(pg_temp.err(format('select public.leave_event_sort(%L, %L)', v_e, v_l[3])) = 'sort_not_confirmed', 'legado: sem Saída');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_l[1])) = 'sort_not_confirmed', 'legado: sem Inclusão');
  perform pg_temp.assert_that(pg_temp.err(format('select public.return_event_sort_player(%L, %L)', v_e, v_l[1])) = 'sort_not_confirmed', 'legado: sem Volta');
  perform pg_temp.assert_that((select not sort_confirmed from public.list_my_racha_events() where id = v_e), 'leitura marca legado como sem Sorteio');
  raise notice 'PASS: upcoming e active legado seguem o fluxo antigo; Saída/Inclusão/Volta só com Sorteio';
end $$;

-- ============================================================
-- 8. Caixa: quem saiu, voltou e pagou; apuração uma única vez (manual e automática)
-- ============================================================
create function pg_temp.cash_flow(j jsonb) returns void
language plpgsql as $$
declare
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 7) i);
begin
  perform pg_temp.as_(v_o);
  -- A (1): pagou, saiu, não veio. B (2): saiu, voltou, pagou, veio. C (3) e D (4): pagaram e vieram.
  -- F (5): saiu e só depois pagou, não veio. L6: não pagou, não veio. E (7): pagou na fila, nunca entrou.
  perform public.set_attendance_paid(v_e, v_l[1], null, true);
  perform public.set_attendance_paid(v_e, v_l[7], null, true);
  perform public.leave_event_sort(v_e, v_l[1]);
  perform pg_temp.as_(v_l[2]);
  perform public.leave_event_sort(v_e, v_l[2]);
  perform pg_temp.as_(v_o);
  perform public.return_event_sort_player(v_e, v_l[2]);
  perform public.set_attendance_paid(v_e, v_l[2], null, true);
  perform public.set_attendance_paid(v_e, v_l[3], null, true);
  perform public.set_attendance_paid(v_e, v_l[4], null, true);
  perform public.set_attendance_attended(v_e, v_l[2], null, true);
  perform public.set_attendance_attended(v_e, v_l[3], null, true);
  perform public.set_attendance_attended(v_e, v_l[4], null, true);
  perform public.leave_event_sort(v_e, v_l[5]);
  perform public.set_attendance_paid(v_e, v_l[5], null, true);
end $$;

create function pg_temp.credit_summary(p_racha uuid) returns text
language sql as $$
  select coalesce(string_agg(c.entry_kind || ':' || c.amount_delta || ':' || c.profile_id::text, ',' order by c.entry_kind, c.profile_id), '')
  from public.racha_credit_entry c where c.racha_id = p_racha;
$$;

do $$
declare
  j jsonb := pg_temp.fx('oito', 6, 0, 1, null, true, 1);
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_r uuid := pg_temp.id(j, 'racha');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 7) i);
  v_after text;
begin
  perform pg_temp.cash_flow(j);
  perform pg_temp.assert_that(pg_temp.credit_summary(v_r) = '', 'Saída não cria Crédito');
  perform pg_temp.assert_that((select had_slot_since_payment from public.event_payment_fact where event_id = v_e and profile_id = v_l[1])
    and (select had_slot_since_payment from public.event_payment_fact where event_id = v_e and profile_id = v_l[2])
    and not (select had_slot_since_payment from public.event_payment_fact where event_id = v_e and profile_id = v_l[5])
    and not (select had_slot_since_payment from public.event_payment_fact where event_id = v_e and profile_id = v_l[7]),
    'had_slot_since_payment: pagou antes de sair e voltou = true; pagou depois de sair e na fila = false');
  perform pg_temp.assert_that((select count(*) from public.event_payment_fact where event_id = v_e) = 6
    and (select cash_paid_amount from public.event_payment_fact where event_id = v_e and profile_id = v_l[1]) = 20, 'pagamento de quem saiu mantido');
  perform pg_temp.assert_that(exists (select 1 from public.list_event_attendance(v_e) where profile_id = v_l[1] and status = 'left'
    and is_paid_effective and cash_paid_amount = 20), 'lista mostra left pago');
  perform pg_temp.assert_that((select present_payer_count from public.list_event_attendance(v_e) limit 1) = 3, 'três pagantes presentes (Meta 3)');

  -- Evento pago só encerra com a conferência; a recusa sai antes de qualquer efeito
  perform pg_temp.assert_that(pg_temp.err(format('select public.finish_event(%L)', v_e)) = 'payments_not_reviewed'
    and pg_temp.err(format('select public.finish_event(%L, false)', v_e)) = 'payments_not_reviewed'
    and (select status = 'active' and ended_at is null from public.event where id = v_e)
    and pg_temp.credit_summary(v_r) = '', 'encerrar pago sem conferência: payments_not_reviewed, nada muda');
  perform public.finish_event(v_e, true);
  v_after := pg_temp.credit_summary(v_r);
  perform pg_temp.assert_that(v_after = (
    select string_agg(x, ',' order by x) from (
      select 'absence_daily:20:' || v_l[1]::text as x
      union all select 'waitlist_daily:20:' || v_l[5]::text
      union all select 'waitlist_daily:20:' || v_l[7]::text) q),
    'apuração: faltou com vaga e Meta batida; sem vaga desde o pagamento: Crédito; quem veio, não: ' || v_after);
  -- reapurar não duplica
  perform private.settle_event_credits(v_e);
  perform public.set_attendance_attended(v_e, v_l[3], null, true);
  perform public.set_attendance_attended(v_e, v_l[2], null, true);
  perform pg_temp.assert_that(pg_temp.credit_summary(v_r) = v_after, 'apuração acontece uma única vez');
  -- quem saiu e veio pode ser corrigido depois do encerramento (left conta como vaga)
  perform public.set_attendance_attended(v_e, v_l[1], null, true);
  perform pg_temp.assert_that(pg_temp.credit_summary(v_r) not like '%absence_daily%', 'corrigir o veio de quem saiu reapura sem duplicar');
  perform public.set_attendance_attended(v_e, v_l[1], null, false);
  perform pg_temp.assert_that(pg_temp.credit_summary(v_r) = v_after, 'desfazer a correção volta à apuração original');
  raise notice 'PASS: Caixa manual: saiu/voltou/pagou, sem Crédito na Saída, apuração única';
end $$;

do $$
declare
  j jsonb := pg_temp.fx('nove', 6, 0, 1, null, true, 1);
  v_e uuid := pg_temp.id(j, 'event');
  v_r uuid := pg_temp.id(j, 'racha');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 7) i);
  v_after text;
begin
  perform pg_temp.cash_flow(j);
  perform private.process_overdue_events(now() + interval '60 days');
  perform pg_temp.assert_that((select status = 'finished' and ended_by_system from public.event where id = v_e), 'encerramento automático');
  v_after := pg_temp.credit_summary(v_r);
  perform pg_temp.assert_that(v_after = (
    select string_agg(x, ',' order by x) from (
      select 'absence_daily:20:' || v_l[1]::text as x
      union all select 'waitlist_daily:20:' || v_l[5]::text
      union all select 'waitlist_daily:20:' || v_l[7]::text) q), 'automático apura igual ao manual: ' || v_after);
  perform private.process_overdue_events(now() + interval '61 days');
  perform pg_temp.assert_that(pg_temp.credit_summary(v_r) = v_after, 'segunda passada não duplica');
  raise notice 'PASS: Caixa automático igual ao manual, uma vez só';
end $$;

-- ============================================================
-- 10. Confirmado que não veio: Aguardando inclusão (not_attended) e Inclusão estendida
-- ============================================================
-- Sorteio de um Evento montado com p_sort = false: só quem o teste marca como veio entra.
create function pg_temp.sort_now(p_event uuid, p_owner uuid) returns void
language plpgsql as $$
begin
  perform pg_temp.as_(p_owner);
  perform public.assume_event_conduction(p_event);
  perform public.confirm_event_sort(p_event, (public.prepare_event_sort(p_event) ->> 'version')::integer);
end $$;

create function pg_temp.came(p_event uuid, p_person uuid) returns boolean
language sql as $$
  select ea.did_attend from public.event_attendance ea where ea.event_id = p_event and ea.profile_id = p_person;
$$;

do $$
declare
  j jsonb := pg_temp.fx('dez', 8, 2, 1, 11::smallint, false, 1, 0, false);
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 9) i);
  v_g uuid[] := array(select pg_temp.id(j, 'gk', i) from generate_series(1, 2) i);
  v_guest uuid;
  v_guest2 uuid;
  v_i integer;
  v_pub jsonb;
  v_w jsonb;
begin
  -- l1..l8 e g1, g2 confirmados; l9 na fila; um Avulso: 11/11. Só l1..l6 e g1 vieram.
  perform pg_temp.as_(v_o);
  -- direto na tabela: add_guest recusa com fila de espera, e aqui o Avulso já estava lá
  insert into public.event_guest (event_id, display_name, plays_as, primary_position, stars)
  values (v_e, 'Avulso Faltou', 'OUTFIELD', 'ANY', 3) returning id into v_guest;
  for v_i in 1..6 loop
    perform public.set_attendance_attended(v_e, v_l[v_i], null, true);
  end loop;
  perform public.set_attendance_attended(v_e, v_g[1], null, true);
  perform pg_temp.sort_now(v_e, v_o);

  v_pub := public.get_event_sort(v_e);
  perform pg_temp.assert_that((select count(*) from public.event_sort_team_player where event_id = v_e) = 6
    and not exists (select 1 from public.event_sort_team_player where event_id = v_e and person_id in (v_l[7], v_l[8], v_l[9], v_guest)),
    'só quem veio foi sorteado');
  v_w := v_pub -> 'waiting_for_inclusion';
  perform pg_temp.assert_that(jsonb_array_length(v_w) = 4
    and v_w -> 0 ->> 'profile_id' = v_l[9]::text and v_w -> 0 ->> 'reason' = 'waitlisted' and (v_w -> 0 ->> 'queue_position')::integer = 1
    and (select array_agg(x ->> 'profile_id' order by x ->> 'display_name') from jsonb_array_elements(v_w) x where x ->> 'reason' = 'not_attended')
      = array[v_g[2]::text, v_l[7]::text, v_l[8]::text]
    and (select bool_and(x -> 'queue_position' = 'null'::jsonb) from jsonb_array_elements(v_w) x where x ->> 'reason' = 'not_attended'),
    'Aguardando inclusão: fila primeiro (waitlisted), depois quem não veio (not_attended, sem posição); Avulso e Goleiro que veio fora');

  -- quem saiu NÃO entra em Aguardando inclusão: tem a Volta
  perform public.leave_event_sort(v_e, v_l[1]);
  v_pub := public.get_event_sort(v_e);
  perform pg_temp.assert_that(jsonb_array_length(v_pub -> 'waiting_for_inclusion') = 4
    and not exists (select 1 from jsonb_array_elements(v_pub -> 'waiting_for_inclusion') x where x ->> 'profile_id' = v_l[1]::text)
    and v_pub -> 'left' -> 0 ->> 'profile_id' = v_l[1]::text, 'left fica em Saíram, não em Aguardando inclusão');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_l[1])) = 'use_return',
    'confirmado que já saiu ainda exige use_return');
  perform pg_temp.assert_that(pg_temp.att(v_e, v_l[1]) = 'left' and pg_temp.passes(v_e, v_l[1]) = 1, 'use_return não mexeu em nada');

  -- Inclusão de confirmado que não veio: entra num Time, "veio" na Presença
  perform pg_temp.as_(v_l[2]);
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_l[7])) = 'not_conductor', 'Jogador não inclui');
  perform pg_temp.as_(v_o);
  perform pg_temp.assert_that(not pg_temp.came(v_e, v_l[7]) and pg_temp.team_of(v_e, v_l[7]) is null, 'antes: sem veio e sem Time');
  v_pub := public.include_event_sort_member(v_e, v_l[7]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[7]) is not null and pg_temp.came(v_e, v_l[7]) and pg_temp.att(v_e, v_l[7]) = 'confirmed'
    and pg_temp.passes(v_e, v_l[7]) = 1, 'incluído: Time, veio e passagem única');
  perform pg_temp.assert_that(jsonb_array_length(v_pub -> 'waiting_for_inclusion') = 3
    and not exists (select 1 from jsonb_array_elements(v_pub -> 'waiting_for_inclusion') x where x ->> 'profile_id' = v_l[7]::text),
    'saiu de Aguardando inclusão');
  -- repetir (concorrência simulada: a segunda chamada chega depois da primeira e vê a passagem)
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_l[7])) = 'already_participating',
    'segunda Inclusão da mesma pessoa: already_participating');
  perform pg_temp.assert_that(pg_temp.passes(v_e, v_l[7]) = 1 and pg_temp.active_in(v_e, pg_temp.team_of(v_e, v_l[7])) <= 3, 'uma passagem só');

  -- Goleiro confirmado que não veio entra no gol, nunca na linha
  perform public.include_event_sort_member(v_e, v_g[2]);
  perform pg_temp.assert_that(exists (select 1 from public.event_sort_goalkeeper where event_id = v_e and person_id = v_g[2])
    and pg_temp.passes(v_e, v_g[2]) = 0 and pg_temp.came(v_e, v_g[2]), 'Goleiro incluído: no gol e com veio');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_g[2])) = 'already_participating',
    'Goleiro repetido: already_participating');

  -- confirmado já tem a vaga: o Limite (11/11) não o barra. A fila e o Avulso novo, sim.
  perform pg_temp.assert_that(private.event_occupancy(v_e) = 10, 'l1 saiu: 10/11');
  perform public.include_event_sort_member(v_e, v_l[8]);
  perform pg_temp.assert_that(pg_temp.team_of(v_e, v_l[8]) is not null and private.event_occupancy(v_e) = 10,
    'confirmado sem veio entra sem ocupar vaga nova');
  perform public.include_event_sort_guest(v_e, 'Avulso Novo', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  select g.id into v_guest2 from public.event_guest g where g.event_id = v_e and g.display_name = 'Avulso Novo';
  perform pg_temp.assert_that((select did_attend from public.event_guest where id = v_guest2) and pg_temp.team_of(v_e, v_guest2) is not null,
    'Avulso incluído nasce com veio e entra no Time');
  perform pg_temp.assert_that(private.event_occupancy(v_e) = 11, '11/11');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_member(%L, %L)', v_e, v_l[9])) = 'spot_limit',
    'fila (waitlisted) continua respeitando o Limite');
  perform pg_temp.assert_that(pg_temp.err(format('select public.include_event_sort_guest(%L, ''Avulso Extra'', ''OUTFIELD'', ''ANY'', null, 3::smallint, false)', v_e)) = 'spot_limit',
    'Avulso novo respeita o Limite');
  perform pg_temp.assert_that(not pg_temp.came(v_e, v_l[9]) and pg_temp.att(v_e, v_l[9]) = 'waitlisted', 'recusa não marcou veio nem confirmou');
  -- o Avulso que faltou (já existia, sem veio) segue fora: o Dono marca "veio" nele se quiser
  perform pg_temp.assert_that(not (select did_attend from public.event_guest where id = v_guest) and pg_temp.team_of(v_e, v_guest) is null,
    'Avulso sem veio segue fora do Time');
  perform pg_temp.invariants(v_e, 'cenário 10');
  raise notice 'PASS: Aguardando inclusão com reason, Inclusão de confirmado sem veio (Membro, Goleiro, limite, idempotência) e Avulso com veio';
end $$;

-- Evento pago: Inclusão marca "veio" também no fato de pagamento; encerrar exige conferência
do $$
declare
  j jsonb := pg_temp.fx('onze', 6, 0, 1, null, true, 0, 0, false);
  v_o uuid := pg_temp.id(j, 'owner');
  v_e uuid := pg_temp.id(j, 'event');
  v_r uuid := pg_temp.id(j, 'racha');
  v_l uuid[] := array(select pg_temp.id(j, 'line', i) from generate_series(1, 7) i);
  v_i integer;
  v_events integer;
begin
  insert into public.event_attendance (event_id, profile_id, status) values (v_e, v_l[7], 'confirmed');
  update public.event_attendance set did_attend = true where event_id = v_e and profile_id = any (v_l[1:6]);
  perform pg_temp.as_(v_o);
  perform public.set_attendance_paid(v_e, v_l[7], null, true);
  perform pg_temp.assert_that((select not did_attend and paid_marked_at is not null from public.event_payment_fact where event_id = v_e and profile_id = v_l[7]),
    'pagou mas não veio: fato sem veio');
  perform pg_temp.sort_now(v_e, v_o);

  perform pg_temp.as_(v_o);
  perform public.include_event_sort_member(v_e, v_l[7]);
  perform pg_temp.assert_that(pg_temp.came(v_e, v_l[7]) and (select did_attend from public.event_payment_fact where event_id = v_e and profile_id = v_l[7])
    and pg_temp.team_of(v_e, v_l[7]) is not null, 'Inclusão marca veio na Presença e no fato de pagamento');

  -- sem conferência: erro estável, nada muda (status, apuração, próximo Evento)
  select count(*) into v_events from public.event where racha_id = v_r;
  perform pg_temp.assert_that(pg_temp.err(format('select public.finish_event(%L)', v_e)) = 'payments_not_reviewed', 'pago sem parâmetro: payments_not_reviewed');
  perform pg_temp.assert_that(pg_temp.err(format('select public.finish_event(%L, null)', v_e)) = 'payments_not_reviewed', 'pago com null: payments_not_reviewed');
  perform pg_temp.assert_that((select status = 'active' and ended_at is null and ended_by is null from public.event where id = v_e)
    and (select count(*) from public.event where racha_id = v_r) = v_events, 'recusa não muda o Evento nem cria o próximo');
  perform pg_temp.as_(v_l[1]);
  perform pg_temp.assert_that(pg_temp.err(format('select public.finish_event(%L, true)', v_e)) = 'not_allowed', 'quem não conduz segue not_allowed');
  perform pg_temp.as_(v_o);
  perform public.finish_event(v_e, true);
  perform pg_temp.assert_that((select status = 'finished' and not ended_by_system and ended_by = v_o from public.event where id = v_e), 'com conferência encerra');
  -- a correção posterior de veio/pagou continua permitida
  perform public.set_attendance_attended(v_e, v_l[7], null, false);
  perform public.set_attendance_attended(v_e, v_l[7], null, true);
  raise notice 'PASS: Evento pago: Inclusão marca veio no fato; encerrar sem conferência é recusado antes de qualquer efeito';
end $$;

-- Evento grátis ignora o parâmetro; o encerramento automático de Evento pago não é bloqueado
do $$
declare
  j jsonb := pg_temp.fx('doze', 6, 0, 0, null, false);
  v_free uuid := pg_temp.id(j, 'event');
  j2 jsonb := pg_temp.fx('treze', 6, 0, 0, null, true);
  v_paid uuid := pg_temp.id(j2, 'event');
  j3 jsonb := pg_temp.fx('catorze', 6, 0, 0, null, false);
  v_free2 uuid := pg_temp.id(j3, 'event');
begin
  perform pg_temp.as_(pg_temp.id(j, 'owner'));
  perform public.finish_event(v_free);
  perform pg_temp.assert_that((select status from public.event where id = v_free) = 'finished', 'grátis encerra sem o parâmetro');
  perform pg_temp.as_(pg_temp.id(j3, 'owner'));
  perform public.finish_event(v_free2, false);
  perform pg_temp.assert_that((select status from public.event where id = v_free2) = 'finished', 'grátis encerra com false');
  perform private.process_overdue_events(now() + interval '60 days');
  perform pg_temp.assert_that((select status = 'finished' and ended_by_system from public.event where id = v_paid),
    'encerramento automático de pago segue sem conferência');
  raise notice 'PASS: grátis ignora p_payments_reviewed; automático de pago não é bloqueado';
end $$;

-- ============================================================
-- 9. Trava comum, grants e leitura
-- ============================================================
do $$
declare
  v_fn text;
begin
  -- toda mutação nova entra pela trava do Racha antes de qualquer leitura/escrita
  foreach v_fn in array array['leave_event_sort', 'include_event_sort_member', 'include_event_sort_guest',
    'return_event_sort_player', 'remove_guest', 'confirm_attendance', 'cancel_attendance', 'set_attendance_for_member', 'add_guest']
  loop
    perform pg_temp.assert_that((select p.prosrc like '%lock_event_for_attendance%' from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = v_fn), v_fn || ' usa a trava comum');
  end loop;
  foreach v_fn in array array['leave_event_sort', 'include_event_sort_member', 'include_event_sort_guest', 'return_event_sort_player']
  loop
    perform pg_temp.assert_that((select has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')
        and not has_function_privilege('public', p.oid, 'execute')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = v_fn), v_fn || ': grants');
    perform pg_temp.assert_that((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = v_fn), v_fn || ': security definer, search_path vazio');
  end loop;
  perform pg_temp.assert_that((select has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')
      and not has_function_privilege('public', p.oid, 'execute') and p.prosecdef and p.proconfig @> array['search_path=""']
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'finish_event')
    and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'finish_event') = 1,
    'finish_event: uma assinatura, grants e search_path');
  perform pg_temp.assert_that(not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('event_sort_close_player', 'event_sort_place_player', 'event_sort_rebalance_goalkeepers',
      'event_sort_compact_queue', 'event_sort_confirmed', 'assert_no_confirmed_sort', 'assert_event_sort_operable')
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
  ), 'auxiliares privados não são chamáveis pelo cliente');
  raise notice 'PASS: trava comum, grants e search_path';
end $$;

rollback;
