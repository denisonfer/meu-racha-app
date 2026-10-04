-- Subdivisão de posição em Times grandes: coleta, camada, bloqueio por pendência e preenchimento por camada.
-- Rode com: docker exec -i supabase_db_meu-racha-app psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/position_detail.sql
begin;

create function pg_temp.err(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;

-- mensagem + detail: o bloqueio por pendência leva os nomes no detail
create function pg_temp.err_detail(p_sql text) returns text
language plpgsql as $$
declare
  v_detail text;
begin
  execute p_sql;
  return 'ok';
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return sqlerrm || ' ' || coalesce(v_detail, '');
end $$;

create function pg_temp.assert_that(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_msg;
  end if;
end $$;

create function pg_temp.new_user(p_id uuid, p_name text, p_plays_as text, p_main text, p_sec text)
returns void language sql as $$
  insert into auth.users (id, raw_user_meta_data)
  values (p_id, jsonb_strip_nulls(jsonb_build_object('display_name', p_name, 'birth_date', '1990-01-01',
    'plays_as', p_plays_as, 'primary_position', p_main, 'secondary_position', p_sec, 'terms_accepted', true)));
$$;

create function pg_temp.new_racha(p_code text, p_per_team integer, p_owner uuid) returns uuid
language plpgsql as $$
declare
  v_racha uuid;
begin
  insert into public.racha (name, invite_code, place, outfield_per_team)
  values ('Prova Subdivisao', p_code, 'Quadra Subdivisao', p_per_team) returning id into v_racha;
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, p_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);
  return v_racha;
end $$;

-- Evento com o tamanho de Time copiado do Racha no momento da criação, como create_event faz
create function pg_temp.new_event(p_racha uuid, p_days integer, p_position boolean) returns uuid
language sql as $$
  insert into public.event (racha_id, starts_on, starts_at, place, status, reminder_lead_hours,
    outfield_per_team, game_mode, max_consecutive_wins, tie_rule, tie_return_order, consider_position)
  select r.id, current_date + p_days, time '19:00', 'Quadra Subdivisao', 'upcoming', r.reminder_lead_hours,
    r.outfield_per_team, r.game_mode, r.max_consecutive_wins, r.tie_rule, r.tie_return_order, p_position
  from public.racha r where r.id = p_racha
  returning id;
$$;

-- Presença confirmada pelo próprio Membro; "veio" marcado pelo Dono quando p_came
create function pg_temp.attend(p_event uuid, p_profile uuid, p_owner uuid, p_came boolean) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_profile::text, true);
  perform public.confirm_attendance(p_event);
  if p_came then
    perform set_config('request.jwt.claim.sub', p_owner::text, true);
    perform public.set_attendance_attended(p_event, p_profile, null, true);
  end if;
end $$;

-- Maior diferença, entre os Times do resultado, na contagem de uma mesma camada (main do elenco)
create function pg_temp.layer_spread(p_result jsonb, p_players jsonb) returns integer language sql as $$
  select coalesce(max(hi - lo), 0) from (
    select l.layer, max(c.n) as hi, min(c.n) as lo
    from (select distinct p ->> 'main' as layer from jsonb_array_elements(p_players) p) l
    cross join jsonb_array_elements(p_result -> 'teams') t
    cross join lateral (
      select count(*)::integer as n from jsonb_array_elements_text(t -> 'player_ids') x
      join jsonb_array_elements(p_players) p on p ->> 'id' = x
      where p ->> 'main' = l.layer
    ) c
    group by l.layer
  ) s;
$$;

create function pg_temp.layer_of(p_rows jsonb, p_id uuid) returns text language sql as $$
  select pl ->> 'primary_layer'
  from jsonb_array_elements(p_rows) t, jsonb_array_elements(t -> 'players') pl
  where coalesce(pl ->> 'profile_id', pl ->> 'guest_id') = p_id::text;
$$;

-- ============================================================
-- 1–4. Solicitação e aprovação
-- ============================================================
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_dm uuid := gen_random_uuid();
  v_dm2 uuid := gen_random_uuid();
  v_any uuid := gen_random_uuid();
  v_fd uuid := gen_random_uuid();
  v_r7 uuid;
  v_r8 uuid;
  v_req uuid;
  v_m public.member%rowtype;
begin
  perform pg_temp.new_user(v_owner, 'Dono Subdivisao', 'OUTFIELD', 'ANY', null);
  perform pg_temp.new_user(v_dm, 'Defensor Meia', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER');
  perform pg_temp.new_user(v_dm2, 'Defensor Mudou', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER');
  perform pg_temp.new_user(v_any, 'Todas Posicoes', 'OUTFIELD', 'ANY', null);
  perform pg_temp.new_user(v_fd, 'Atacante Defensor', 'OUTFIELD', 'FORWARD', 'DEFENDER');
  v_r7 := pg_temp.new_racha('ZZZPD7', 7, v_owner);
  v_r8 := pg_temp.new_racha('ZZZPD8', 8, v_owner);

  -- o app insere direto pela RLS: tudo abaixo roda como authenticated
  set local role authenticated;

  -- 1. Racha 7: aceito sem subdivisão; mesmo se vier, grava nulo
  perform set_config('request.jwt.claim.sub', v_dm::text, true);
  insert into public.join_request (racha_id) values (v_r7);
  perform set_config('request.jwt.claim.sub', v_dm2::text, true);
  insert into public.join_request (racha_id, primary_position_detail, secondary_position_detail)
  values (v_r7, 'CENTER_BACK', 'ATTACKING_MID');

  -- 2. Racha 8: exige para cada zona DEFENSOR/MEIO_CAMPO e recusa a que não combina
  perform set_config('request.jwt.claim.sub', v_dm::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('insert into public.join_request (racha_id) values (%L)', v_r8))
    = 'position_detail_required', 'Racha 8 sem subdivisão: position_detail_required');
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.join_request (racha_id, primary_position_detail)
    values (%L, 'CENTER_BACK')$f$, v_r8)) = 'position_detail_required', 'Racha 8 sem a da secundária: position_detail_required');
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.join_request (racha_id, primary_position_detail,
    secondary_position_detail) values (%L, 'DEFENSIVE_MID', 'ATTACKING_MID')$f$, v_r8)) = 'position_detail_mismatch',
    'Volante na zona DEFENSOR: position_detail_mismatch');
  insert into public.join_request (racha_id, primary_position_detail, secondary_position_detail)
  values (v_r8, 'CENTER_BACK', 'ATTACKING_MID');

  -- 3. TODAS não tem subdivisão; ATACANTE só responde pela secundária DEFENSOR
  perform set_config('request.jwt.claim.sub', v_any::text, true);
  insert into public.join_request (racha_id) values (v_r8);
  perform set_config('request.jwt.claim.sub', v_fd::text, true);
  perform pg_temp.assert_that(pg_temp.err(format('insert into public.join_request (racha_id) values (%L)', v_r8))
    = 'position_detail_required', 'ATACANTE/DEFENSOR em Racha 8 responde pela secundária');
  perform pg_temp.assert_that(pg_temp.err(format($f$insert into public.join_request (racha_id, primary_position_detail,
    secondary_position_detail) values (%L, 'CENTER_BACK', 'FULL_BACK')$f$, v_r8)) = 'position_detail_mismatch',
    'subdivisão na zona ATACANTE: position_detail_mismatch');
  insert into public.join_request (racha_id, secondary_position_detail) values (v_r8, 'FULL_BACK');

  perform set_config('request.jwt.claim.sub', v_dm2::text, true);
  insert into public.join_request (racha_id, primary_position_detail, secondary_position_detail)
  values (v_r8, 'FULL_BACK', 'DEFENSIVE_MID');

  reset role;

  perform pg_temp.assert_that((select count(*) from public.join_request
    where racha_id = v_r7 and primary_position_detail is null and secondary_position_detail is null) = 2,
    'Racha 7: as duas Solicitações com subdivisões nulas');
  perform pg_temp.assert_that((select primary_position_detail = 'CENTER_BACK' and secondary_position_detail = 'ATTACKING_MID'
    from public.join_request where racha_id = v_r8 and profile_id = v_dm), 'Racha 8: Zagueiro/Meia gravados');
  perform pg_temp.assert_that((select primary_position_detail is null and secondary_position_detail is null
    from public.join_request where racha_id = v_r8 and profile_id = v_any), 'TODAS: nada gravado');
  raise notice 'PASS: Solicitação em Racha 7 (nulo) e Racha 8 (exige, recusa incompatível, TODAS/ATACANTE)';

  -- 4. Aprovação copia; se a zona do Perfil mudou, a que não combina entra nula
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  select id into v_req from public.join_request where racha_id = v_r8 and profile_id = v_dm;
  perform public.approve_join_request(v_req, 3::smallint, false);
  select * into v_m from public.member where racha_id = v_r8 and profile_id = v_dm;
  perform pg_temp.assert_that(v_m.primary_position_detail = 'CENTER_BACK' and v_m.secondary_position_detail = 'ATTACKING_MID',
    'aprovação copia Zagueiro/Meia');

  select id into v_req from public.join_request where racha_id = v_r8 and profile_id = v_fd;
  perform public.approve_join_request(v_req, 3::smallint, false);
  select * into v_m from public.member where racha_id = v_r8 and profile_id = v_fd;
  perform pg_temp.assert_that(v_m.primary_position_detail is null and v_m.secondary_position_detail = 'FULL_BACK',
    'ATACANTE/DEFENSOR: só a secundária');

  update public.profile set primary_position = 'MIDFIELDER', secondary_position = 'FORWARD' where id = v_dm2;
  select id into v_req from public.join_request where racha_id = v_r8 and profile_id = v_dm2;
  perform public.approve_join_request(v_req, 3::smallint, false);
  select * into v_m from public.member where racha_id = v_r8 and profile_id = v_dm2;
  perform pg_temp.assert_that(v_m.is_active and v_m.primary_position = 'MIDFIELDER'
    and v_m.primary_position_detail is null and v_m.secondary_position_detail is null,
    'Perfil mudou de zona: aprovação conclui com subdivisões nulas');
  perform pg_temp.assert_that((select status from public.join_request where id = v_req) = 'APPROVED', 'pedido aprovado');

  -- reativação sobrescreve as duas subdivisões
  update public.member set is_active = false where racha_id = v_r8 and profile_id = v_dm;
  delete from public.join_request where racha_id = v_r8 and profile_id = v_dm;
  insert into public.join_request (racha_id, profile_id, primary_position_detail, secondary_position_detail)
  values (v_r8, v_dm, 'FULL_BACK', 'DEFENSIVE_MID') returning id into v_req;
  perform public.approve_join_request(v_req, 3::smallint, false);
  select * into v_m from public.member where racha_id = v_r8 and profile_id = v_dm;
  perform pg_temp.assert_that(v_m.is_active and v_m.primary_position_detail = 'FULL_BACK'
    and v_m.secondary_position_detail = 'DEFENSIVE_MID', 'reativação sobrescreve as subdivisões');
  raise notice 'PASS: aprovação copia, zera a que não combina com a zona atual e sobrescreve na reativação';
end $$;

-- ============================================================
-- 5. set_member_position_details
-- ============================================================
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_m uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_racha uuid;
  v_profile_before jsonb;
begin
  perform pg_temp.new_user(v_owner, 'Dono Edicao', 'OUTFIELD', 'ANY', null);
  perform pg_temp.new_user(v_admin, 'Admin Edicao', 'OUTFIELD', 'ANY', null);
  perform pg_temp.new_user(v_m, 'Membro Edicao', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER');
  perform pg_temp.new_user(v_other, 'Outro Membro', 'OUTFIELD', 'ANY', null);
  v_racha := pg_temp.new_racha('ZZZPE8', 8, v_owner);
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, secondary_position, stars)
  values (v_racha, v_admin, 'ADMIN', 'OUTFIELD', 'ANY', null, 3),
         (v_racha, v_m, 'PLAYER', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER', 3),
         (v_racha, v_other, 'PLAYER', 'OUTFIELD', 'ANY', null, 3);
  select to_jsonb(p) into v_profile_before from public.profile p where p.id = v_m;

  perform set_config('request.jwt.claim.sub', v_m::text, true);
  perform public.set_member_position_details(v_racha, v_m, 'CENTER_BACK', 'DEFENSIVE_MID');
  perform pg_temp.assert_that((select primary_position_detail = 'CENTER_BACK' and secondary_position_detail = 'DEFENSIVE_MID'
    from public.member where racha_id = v_racha and profile_id = v_m), 'o próprio Membro completa');

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.set_member_position_details(v_racha, v_m, 'FULL_BACK', 'ATTACKING_MID');
  perform pg_temp.assert_that((select primary_position_detail = 'FULL_BACK' and secondary_position_detail = 'ATTACKING_MID'
    from public.member where racha_id = v_racha and profile_id = v_m), 'o Admin edita');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.set_member_position_details(v_racha, v_m, 'CENTER_BACK', 'ATTACKING_MID');

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform pg_temp.assert_that(pg_temp.err(format($f$select public.set_member_position_details(%L, %L, 'FULL_BACK', 'DEFENSIVE_MID')$f$,
    v_racha, v_m)) = 'not_allowed', 'outro Membro: not_allowed');
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  perform pg_temp.assert_that(pg_temp.err(format($f$select public.set_member_position_details(%L, %L, 'FULL_BACK', 'DEFENSIVE_MID')$f$,
    v_racha, v_m)) = 'not_allowed', 'não Membro: not_allowed');

  perform set_config('request.jwt.claim.sub', v_m::text, true);
  perform pg_temp.assert_that(pg_temp.err(format($f$select public.set_member_position_details(%L, %L, 'DEFENSIVE_MID', 'ATTACKING_MID')$f$,
    v_racha, v_m)) = 'position_detail_mismatch', 'Volante na zona DEFENSOR: position_detail_mismatch');
  perform pg_temp.assert_that(pg_temp.err(format($f$select public.set_member_position_details(%L, %L, null, 'CENTER_BACK')$f$,
    v_racha, v_m)) = 'position_detail_mismatch', 'Zagueiro na zona MEIO_CAMPO: position_detail_mismatch');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform pg_temp.assert_that(pg_temp.err(format($f$select public.set_member_position_details(%L, %L, 'CENTER_BACK', null)$f$,
    v_racha, v_other)) = 'position_detail_mismatch', 'subdivisão em TODAS: position_detail_mismatch');

  perform pg_temp.assert_that((select primary_position_detail = 'CENTER_BACK' and secondary_position_detail = 'ATTACKING_MID'
    from public.member where racha_id = v_racha and profile_id = v_m), 'recusas não gravam');
  perform pg_temp.assert_that((select to_jsonb(p) from public.profile p where p.id = v_m) = v_profile_before, 'o Perfil não muda');

  -- o banco também recusa direto, pela check constraint
  perform pg_temp.assert_that(pg_temp.err(format($f$update public.member set primary_position_detail = 'ATTACKING_MID'
    where racha_id = %L and profile_id = %L$f$, v_racha, v_m)) like '%member_position_detail_fits%',
    'check constraint em member');
  raise notice 'PASS: set_member_position_details (próprio, Admin, Dono; outros not_allowed; incompatível recusado; Perfil intacto)';
end $$;

-- ============================================================
-- 6. Camada e encaixe
-- ============================================================
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('DEFENDER', 'CENTER_BACK', 7, 'DEFENDER'),
      ('DEFENDER', null, 7, 'DEFENDER'),
      ('MIDFIELDER', 'ATTACKING_MID', 7, 'MIDFIELDER'),
      ('MIDFIELDER', null, 7, 'MIDFIELDER'),
      ('FORWARD', null, 7, 'FORWARD'),
      ('ANY', null, 7, 'ANY'),
      ('DEFENDER', 'CENTER_BACK', 3, 'DEFENDER'),
      ('DEFENDER', 'CENTER_BACK', 8, 'CENTER_BACK'),
      ('DEFENDER', 'FULL_BACK', 8, 'FULL_BACK'),
      ('DEFENDER', null, 8, null),
      ('MIDFIELDER', 'DEFENSIVE_MID', 8, 'DEFENSIVE_MID'),
      ('MIDFIELDER', 'ATTACKING_MID', 8, 'ATTACKING_MID'),
      ('MIDFIELDER', null, 8, null),
      ('FORWARD', null, 8, 'FORWARD'),
      ('ANY', null, 8, 'ANY'),
      ('DEFENDER', 'FULL_BACK', 10, 'FULL_BACK'),
      ('MIDFIELDER', null, 10, null),
      (null, null, 8, null)
    ) as x(zone, detail, per_team, expected)
  loop
    perform pg_temp.assert_that(
      private.position_layer(r.zone::public.position, r.detail::public.position_detail, r.per_team)
        is not distinct from r.expected,
      format('position_layer(%s, %s, %s) = %s', r.zone, r.detail, r.per_team, coalesce(r.expected, 'null')));
  end loop;

  for r in
    select * from (values
      ('DEFENDER', null, true), ('DEFENDER', 'CENTER_BACK', true), ('DEFENDER', 'FULL_BACK', true),
      ('DEFENDER', 'DEFENSIVE_MID', false), ('MIDFIELDER', 'ATTACKING_MID', true), ('MIDFIELDER', 'FULL_BACK', false),
      ('FORWARD', 'CENTER_BACK', false), ('ANY', 'ATTACKING_MID', false), ('FORWARD', null, true),
      (null, 'CENTER_BACK', false), (null, null, true)
    ) as x(zone, detail, expected)
  loop
    perform pg_temp.assert_that(
      private.position_detail_fits(r.zone::public.position, r.detail::public.position_detail) = r.expected,
      format('position_detail_fits(%s, %s) = %s', r.zone, r.detail, r.expected));
  end loop;
  raise notice 'PASS: position_layer (3, 7, 8 e 10 por Time) e position_detail_fits';
end $$;

-- ============================================================
-- 7–8. Bloqueio por pendência no Sorteio e na Inclusão
-- ============================================================
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_d uuid := gen_random_uuid();
  v_f uuid[] := array(select gen_random_uuid() from generate_series(1, 5));
  v_racha uuid;
  v_event uuid;
  v_pr jsonb;
  v_pub jsonb;
  v_att jsonb;
  v_i integer;
begin
  perform pg_temp.new_user(v_owner, 'Dono Bloqueio', 'OUTFIELD', 'ANY', null);
  perform pg_temp.new_user(v_a, 'Ana Completa', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER');
  perform pg_temp.new_user(v_b, 'Bia Pendente', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER');
  perform pg_temp.new_user(v_c, 'Caio Faltou', 'OUTFIELD', 'MIDFIELDER', 'FORWARD');
  perform pg_temp.new_user(v_d, 'Davi Depois', 'OUTFIELD', 'MIDFIELDER', 'DEFENDER');
  for v_i in 1..5 loop
    perform pg_temp.new_user(v_f[v_i], 'Todas ' || chr(64 + v_i), 'OUTFIELD', 'ANY', null);
  end loop;
  v_racha := pg_temp.new_racha('ZZZPB8', 8, v_owner);
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, secondary_position, stars,
    primary_position_detail, secondary_position_detail)
  values (v_racha, v_a, 'PLAYER', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER', 4, 'CENTER_BACK', 'ATTACKING_MID'),
         (v_racha, v_b, 'PLAYER', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER', 3, null, null),
         (v_racha, v_c, 'PLAYER', 'OUTFIELD', 'MIDFIELDER', 'FORWARD', 3, null, null),
         (v_racha, v_d, 'PLAYER', 'OUTFIELD', 'MIDFIELDER', 'DEFENDER', 2, null, null);
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  select v_racha, v_f[i], 'PLAYER', 'OUTFIELD', 'ANY', 1 + i % 5 from generate_series(1, 5) i;

  v_event := pg_temp.new_event(v_racha, 14, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.assume_event_conduction(v_event);
  perform pg_temp.attend(v_event, v_a, v_owner, true);
  perform pg_temp.attend(v_event, v_b, v_owner, true);
  perform pg_temp.attend(v_event, v_c, v_owner, false);
  for v_i in 1..5 loop
    perform pg_temp.attend(v_event, v_f[v_i], v_owner, true);
  end loop;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  -- a Presença já mostra a camada (nula = pendente) com o tamanho de Time do Evento
  select jsonb_object_agg(a.profile_id::text, a.primary_layer) into v_att
  from public.list_event_attendance(v_event) a where a.profile_id is not null;
  perform pg_temp.assert_that(v_att ->> v_a::text = 'CENTER_BACK' and v_att ->> v_f[1]::text = 'ANY'
    and v_att ? v_b::text and v_att ->> v_b::text is null and v_att ? v_c::text and v_att ->> v_c::text is null,
    'list_event_attendance: primary_layer por pessoa (Zagueiro, Todas, pendentes nulos)');

  -- 7. só B bloqueia (C não veio), com Posição ligada e desligada
  perform pg_temp.assert_that(pg_temp.err_detail(format('select public.prepare_event_sort(%L)', v_event))
    = 'position_detail_pending ["Bia Pendente"]', 'Posição ligada: bloqueia nomeando só B');
  update public.event set consider_position = false where id = v_event;
  perform pg_temp.assert_that(pg_temp.err_detail(format('select public.prepare_event_sort(%L)', v_event))
    = 'position_detail_pending ["Bia Pendente"]', 'Posição desligada: também bloqueia');
  update public.event set consider_position = true where id = v_event;
  perform pg_temp.assert_that(not exists (select 1 from public.event_sort where event_id = v_event), 'nada foi gravado');

  perform public.set_member_position_details(v_racha, v_b, 'FULL_BACK', 'DEFENSIVE_MID');
  v_pr := public.prepare_event_sort(v_event);
  perform pg_temp.assert_that(v_pr ->> 'state' = 'ready' and (v_pr ->> 'line_count')::integer = 7, 'completo, prepara com 7 de linha');
  perform pg_temp.assert_that(pg_temp.layer_of(v_pr -> 'teams', v_a) = 'CENTER_BACK'
    and pg_temp.layer_of(v_pr -> 'teams', v_b) = 'FULL_BACK' and pg_temp.layer_of(v_pr -> 'teams', v_f[1]) = 'ANY',
    'proposta: primary_layer de cada jogador');
  perform pg_temp.assert_that((select primary_position_detail_snapshot = 'CENTER_BACK' and secondary_position_detail_snapshot = 'ATTACKING_MID'
    from public.event_sort_team_player where event_id = v_event and profile_id = v_a), 'retrato das subdivisões de A');

  -- a subdivisão está na assinatura; apagar bloqueia a confirmação pelo nome, restaurar volta a valer
  perform public.set_member_position_details(v_racha, v_b, null, null);
  perform pg_temp.assert_that(public.get_event_sort_proposal(v_event) ->> 'state' = 'stale', 'mudar subdivisão invalida a proposta');
  perform pg_temp.assert_that(pg_temp.err_detail(format('select public.confirm_event_sort(%L, %s)', v_event, v_pr ->> 'version'))
    = 'position_detail_pending ["Bia Pendente"]', 'confirmar com pendente: position_detail_pending');
  perform public.set_member_position_details(v_racha, v_b, 'FULL_BACK', 'DEFENSIVE_MID');
  v_pub := public.confirm_event_sort(v_event, (v_pr ->> 'version')::integer);
  perform pg_temp.assert_that(v_pub ->> 'state' = 'published', 'confirma depois de completar');
  perform pg_temp.assert_that(not exists (select 1 from public.event_sort_team_player where event_id = v_event and profile_id = v_c),
    'C (sem veio) continua fora');
  perform pg_temp.assert_that(pg_temp.layer_of(public.get_event_sort(v_event) -> 'teams', v_b) = 'FULL_BACK',
    'Times publicados: primary_layer');
  raise notice 'PASS: bloqueio por pendência no preparo e na confirmação (só elegíveis, com Posição ligada e desligada)';

  -- 8. Inclusão depois do Sorteio: quem entra pendente é recusado pelo nome
  perform pg_temp.assert_that(pg_temp.err_detail(format('select public.include_event_sort_member(%L, %L)', v_event, v_d))
    = 'position_detail_pending ["Davi Depois"]', 'Inclusão de Membro pendente: position_detail_pending');
  perform pg_temp.assert_that(pg_temp.err_detail(format('select public.include_event_sort_member(%L, %L)', v_event, v_c))
    = 'position_detail_pending ["Caio Faltou"]', 'Inclusão do confirmado sem veio pendente: position_detail_pending');
  perform pg_temp.assert_that(not exists (select 1 from public.event_attendance where event_id = v_event and profile_id = v_d),
    'recusa não deixa Presença');
  perform public.set_member_position_details(v_racha, v_c, 'DEFENSIVE_MID', null);
  v_pub := public.include_event_sort_member(v_event, v_c);
  perform pg_temp.assert_that((select primary_position_detail_snapshot from public.event_sort_team_player
    where event_id = v_event and profile_id = v_c) = 'DEFENSIVE_MID', 'completo, entra com o retrato da subdivisão');
  -- Avulso por Inclusão: subdivisão como em add_guest (exige e valida em Evento 8+)
  perform pg_temp.assert_that(pg_temp.err(format($f$select public.include_event_sort_guest(%L, 'Avulso Zaga', 'OUTFIELD',
    'DEFENDER', 'FORWARD', 3::smallint, false)$f$, v_event)) = 'position_detail_required',
    'Inclusão de Avulso DEFENSOR sem subdivisão em Evento 8: position_detail_required');
  perform pg_temp.assert_that(pg_temp.err(format($f$select public.include_event_sort_guest(%L, 'Avulso Zaga', 'OUTFIELD',
    'DEFENDER', 'FORWARD', 3::smallint, false, 'ATTACKING_MID', null)$f$, v_event)) = 'position_detail_mismatch',
    'Inclusão de Avulso com Meia na zona DEFENSOR: position_detail_mismatch');
  perform pg_temp.assert_that(pg_temp.err(format($f$select public.include_event_sort_guest(%L, 'Avulso Meia', 'OUTFIELD',
    'FORWARD', 'MIDFIELDER', 3::smallint, false)$f$, v_event)) = 'position_detail_required',
    'Inclusão de Avulso: secundária MEIO_CAMPO também exige');
  perform pg_temp.assert_that(not exists (select 1 from public.event_guest where event_id = v_event
    and display_name in ('Avulso Zaga', 'Avulso Meia')), 'recusa não deixa Avulso');
  v_pub := public.include_event_sort_guest(v_event, 'Avulso Zaga', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER', 3::smallint, false,
    'FULL_BACK', 'DEFENSIVE_MID');
  perform pg_temp.assert_that((select g.primary_position_detail = 'FULL_BACK' and g.secondary_position_detail = 'DEFENSIVE_MID'
      and tp.primary_position_detail_snapshot = 'FULL_BACK' and tp.secondary_position_detail_snapshot = 'DEFENSIVE_MID'
    from public.event_guest g join public.event_sort_team_player tp on tp.guest_id = g.id
    where g.event_id = v_event and g.display_name = 'Avulso Zaga'), 'Avulso incluído com subdivisões gravadas e no retrato');
  perform pg_temp.assert_that((select primary_layer from public.list_event_attendance(v_event) a join public.event_guest g on g.id = a.guest_id
    where g.event_id = v_event and g.display_name = 'Avulso Zaga') = 'FULL_BACK', 'Presença: camada do Avulso incluído');
  v_pub := public.include_event_sort_guest(v_event, 'Avulso Todas', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  perform pg_temp.assert_that(exists (select 1 from public.event_sort_team_player tp join public.event_guest g on g.id = tp.guest_id
    where tp.event_id = v_event and g.display_name = 'Avulso Todas'), 'Avulso TODAS incluído');
  raise notice 'PASS: Inclusão depois do Sorteio recusa quem entra pendente; Avulso incluído exige e valida a subdivisão';
end $$;

-- ============================================================
-- 9. add_guest
-- ============================================================
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_racha8 uuid;
  v_racha7 uuid;
  v_event8 uuid;
  v_event7 uuid;
  v_guest uuid;
  v_g public.event_guest%rowtype;
begin
  perform pg_temp.new_user(v_owner, 'Dono Avulso', 'OUTFIELD', 'ANY', null);
  v_racha8 := pg_temp.new_racha('ZZZPG8', 8, v_owner);
  v_racha7 := pg_temp.new_racha('ZZZPG7', 7, v_owner);
  v_event8 := pg_temp.new_event(v_racha8, 14, true);
  v_event7 := pg_temp.new_event(v_racha7, 14, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  perform pg_temp.assert_that(pg_temp.err(format($f$select public.add_guest(%L, 'Avulso Zaga', 'OUTFIELD', 'DEFENDER', 'FORWARD',
    3::smallint, false)$f$, v_event8)) = 'position_detail_required', 'Evento 8, DEFENSOR sem subdivisão: position_detail_required');
  perform pg_temp.assert_that(pg_temp.err(format($f$select public.add_guest(%L, 'Avulso Zaga', 'OUTFIELD', 'DEFENDER', 'FORWARD',
    3::smallint, false, 'DEFENSIVE_MID', null)$f$, v_event8)) = 'position_detail_mismatch', 'Volante na zona DEFENSOR: position_detail_mismatch');
  perform pg_temp.assert_that(pg_temp.err(format($f$select public.add_guest(%L, 'Avulso Meia', 'OUTFIELD', 'FORWARD', 'MIDFIELDER',
    3::smallint, false)$f$, v_event8)) = 'position_detail_required', 'secundária MEIO_CAMPO também exige');

  v_guest := public.add_guest(v_event8, 'Avulso Zaga', 'OUTFIELD', 'DEFENDER', 'FORWARD', 3::smallint, false, 'CENTER_BACK', null);
  select * into v_g from public.event_guest where id = v_guest;
  perform pg_temp.assert_that(v_g.primary_position_detail = 'CENTER_BACK' and v_g.secondary_position_detail is null, 'Zagueiro gravado');
  v_guest := public.add_guest(v_event8, 'Avulso Gol', 'GOALKEEPER', null, null, null, false);
  select * into v_g from public.event_guest where id = v_guest;
  perform pg_temp.assert_that(v_g.primary_position_detail is null and v_g.secondary_position_detail is null, 'Goleiro sem subdivisão');
  v_guest := public.add_guest(v_event8, 'Avulso Gol Dois', 'GOALKEEPER', null, null, null, false, 'CENTER_BACK', 'ATTACKING_MID');
  select * into v_g from public.event_guest where id = v_guest;
  perform pg_temp.assert_that(v_g.primary_position_detail is null and v_g.secondary_position_detail is null,
    'Goleiro recebe nulo mesmo se vier subdivisão');
  v_guest := public.add_guest(v_event8, 'Avulso Todas', 'OUTFIELD', 'ANY', null, 3::smallint, false);
  perform pg_temp.assert_that((select primary_layer from public.list_event_attendance(v_event8) where guest_id = v_guest) = 'ANY',
    'TODAS sem subdivisão');
  perform pg_temp.assert_that((select primary_layer from public.list_event_attendance(v_event8) a join public.event_guest g on g.id = a.guest_id
    where a.guest_id is not null and g.display_name = 'Avulso Zaga') = 'CENTER_BACK', 'Presença: camada do Avulso');

  -- Evento 7 não pergunta e não guarda
  v_guest := public.add_guest(v_event7, 'Avulso Sete', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER', 3::smallint, false);
  select * into v_g from public.event_guest where id = v_guest;
  perform pg_temp.assert_that(v_g.primary_position_detail is null, 'Evento 7: sem subdivisão');
  v_guest := public.add_guest(v_event7, 'Avulso Sete Dois', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER', 3::smallint, false,
    'CENTER_BACK', 'ATTACKING_MID');
  select * into v_g from public.event_guest where id = v_guest;
  perform pg_temp.assert_that(v_g.primary_position_detail is null and v_g.secondary_position_detail is null, 'Evento 7: grava nulo');
  perform pg_temp.assert_that((select primary_layer from public.list_event_attendance(v_event7) where guest_id = v_guest) = 'DEFENDER',
    'Evento 7: camada é a zona');
  raise notice 'PASS: add_guest exige e valida em Evento 8; Goleiro e Evento 7 sem subdivisão';
end $$;

-- ============================================================
-- 10. Racha 7 -> 8: o Evento já criado mantém o tamanho dele
-- ============================================================
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_p uuid[] := array(select gen_random_uuid() from generate_series(1, 6));
  v_racha uuid;
  v_event7 uuid;
  v_event8 uuid;
  v_pr jsonb;
  v_i integer;
  v_msg text;
begin
  perform pg_temp.new_user(v_owner, 'Dono Mudanca', 'OUTFIELD', 'ANY', null);
  for v_i in 1..6 loop
    perform pg_temp.new_user(v_p[v_i], 'Linha ' || chr(64 + v_i), 'OUTFIELD', 'DEFENDER', 'MIDFIELDER');
  end loop;
  v_racha := pg_temp.new_racha('ZZZPM7', 7, v_owner);
  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, secondary_position, stars)
  select v_racha, v_p[i], 'PLAYER', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER', 1 + i % 5 from generate_series(1, 6) i;

  v_event7 := pg_temp.new_event(v_racha, 14, true);
  update public.racha set outfield_per_team = 8 where id = v_racha;
  perform pg_temp.assert_that((select outfield_per_team from public.event where id = v_event7) = 7, 'Evento criado em 7 continua 7');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.assume_event_conduction(v_event7);
  for v_i in 1..6 loop
    perform pg_temp.attend(v_event7, v_p[v_i], v_owner, true);
  end loop;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_pr := public.prepare_event_sort(v_event7);
  perform pg_temp.assert_that(v_pr ->> 'state' = 'ready' and pg_temp.layer_of(v_pr -> 'teams', v_p[1]) = 'DEFENDER',
    'Evento 7 sorteia sem subdivisão, camada = zona');
  perform public.confirm_event_sort(v_event7, (v_pr ->> 'version')::integer);
  -- Inclusão de Avulso em Evento 7 não guarda subdivisão, como add_guest
  perform public.include_event_sort_guest(v_event7, 'Avulso Sete', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER', 3::smallint, false,
    'CENTER_BACK', 'ATTACKING_MID');
  perform pg_temp.assert_that((select primary_position_detail is null and secondary_position_detail is null
    from public.event_guest where event_id = v_event7 and display_name = 'Avulso Sete'), 'Inclusão em Evento 7: grava nulo');

  v_event8 := pg_temp.new_event(v_racha, 21, true);
  perform pg_temp.assert_that((select outfield_per_team from public.event where id = v_event8) = 8, 'próximo Evento nasce com 8');
  perform public.assume_event_conduction(v_event8);
  for v_i in 1..6 loop
    perform pg_temp.attend(v_event8, v_p[v_i], v_owner, true);
  end loop;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_msg := pg_temp.err_detail(format('select public.prepare_event_sort(%L)', v_event8));
  perform pg_temp.assert_that(v_msg = 'position_detail_pending ["Linha A", "Linha B", "Linha C", "Linha D", "Linha E", "Linha F"]',
    'Evento 8 exige subdivisão: ' || v_msg);
  raise notice 'PASS: Racha 7 -> 8 não afeta o Evento já criado (Inclusão de Avulso nele sem subdivisão); o próximo exige subdivisão';
end $$;

-- ============================================================
-- 11. Motor: preenchimento por camada e Posição desligada intacta
-- ============================================================
do $$
declare
  v_pl jsonb;
  v_r jsonb;
  v_seed integer;
  r record;
begin
  -- 2 Times de 3. CENTER_BACK (1) vai para o Time 1; na serpentina contínua os dois FULL_BACK
  -- caíam na virada, ambos no Time 2, e o ajuste fino não troca dentro do mesmo Time.
  v_pl := jsonb_build_array(
    jsonb_build_object('id', md5('zc1')::uuid, 'stars', 3, 'super', false, 'main', 'CENTER_BACK', 'sec', null),
    jsonb_build_object('id', md5('zl1')::uuid, 'stars', 3, 'super', false, 'main', 'FULL_BACK', 'sec', null),
    jsonb_build_object('id', md5('zl2')::uuid, 'stars', 3, 'super', false, 'main', 'FULL_BACK', 'sec', null),
    jsonb_build_object('id', md5('zf1')::uuid, 'stars', 3, 'super', false, 'main', 'FORWARD', 'sec', null),
    jsonb_build_object('id', md5('zf2')::uuid, 'stars', 3, 'super', false, 'main', 'FORWARD', 'sec', null),
    jsonb_build_object('id', md5('zf3')::uuid, 'stars', 3, 'super', false, 'main', 'FORWARD', 'sec', null));
  for v_seed in 1..20 loop
    v_r := private.sort_teams(v_pl, '{}', 3, true, null, v_seed / 100.0);
    perform pg_temp.assert_that((select bool_and(n = 1) from (
        select count(*) filter (where x::uuid in (md5('zl1')::uuid, md5('zl2')::uuid)) as n
        from jsonb_array_elements(v_r -> 'teams') t, jsonb_array_elements_text(t -> 'player_ids') x
        group by t ->> 'index') s),
      format('seed %s: cada Time com 1 Lateral', v_seed));
  end loop;
  raise notice 'PASS: preenchimento por camada reparte a camada que cairia na virada';

  -- Regressão do pior caso da serpentina por camada (camadas ímpares, sem secundária): o
  -- jogador a mais de cada camada caía sempre no mesmo Time e o ataque ia 4 contra 0. No
  -- preenchimento por camada, nenhuma camada fica com 2+ de diferença entre Times, em 50 sementes.
  -- Mesmos elencos de .scratch/subdivisoes/worst-case.ts (Estrelas 1 + (i * 7) % 5).
  for r in
    select * from (values
      ('16/8 ZAG3 LAT3 VOL3 MEIA3 ATA4', 8,
        array['CENTER_BACK', 'FULL_BACK', 'DEFENSIVE_MID', 'ATTACKING_MID', 'FORWARD'], array[3, 3, 3, 3, 4]),
      ('24/8 ZAG5 LAT5 VOL4 MEIA5 ATA5', 8,
        array['CENTER_BACK', 'FULL_BACK', 'DEFENSIVE_MID', 'ATTACKING_MID', 'FORWARD'], array[5, 5, 4, 5, 5]),
      ('10/5 DEF3 MEI3 ATA4', 5, array['DEFENDER', 'MIDFIELDER', 'FORWARD'], array[3, 3, 4])
    ) as x(label, per_team, layers, sizes)
  loop
    v_pl := (select jsonb_agg(jsonb_build_object('id', md5(r.label || g.i)::uuid, 'stars', 1 + ((g.i - 1) * 7) % 5,
              'super', false, 'main', g.layer, 'sec', null) order by g.i)
             from (select row_number() over () as i, l.layer
                   from unnest(r.layers, r.sizes) as l(layer, n), generate_series(1, l.n)) g);
    for v_seed in 1..50 loop
      v_r := private.sort_teams(v_pl, '{}', r.per_team, true, null, v_seed / 100.0);
      perform pg_temp.assert_that(pg_temp.layer_spread(v_r, v_pl) <= 1,
        format('%s, seed %s: diferença por camada <= 1 (veio %s)', r.label, v_seed, pg_temp.layer_spread(v_r, v_pl)));
    end loop;
  end loop;

  -- Elencos variados de 16, 2 Times de 8, sem secundária nem TODAS: mesma propriedade
  for v_seed in 1..40 loop
    v_pl := (select jsonb_agg(jsonb_build_object('id', md5('e8' || i)::uuid, 'stars', 1 + (i * v_seed) % 5,
              'super', i % 7 = v_seed % 7,
              'main', (array['CENTER_BACK', 'FULL_BACK', 'DEFENSIVE_MID', 'ATTACKING_MID', 'FORWARD'])[1 + (i * 3 + v_seed) % 5],
              'sec', null) order by i)
             from generate_series(1, 16) i);
    v_r := private.sort_teams(v_pl, '{}', 8, true, null, v_seed / 50.0);
    perform pg_temp.assert_that(pg_temp.layer_spread(v_r, v_pl) <= 1,
      format('elenco %s: diferença por camada <= 1', v_seed));
  end loop;
  raise notice 'PASS: preenchimento por camada: diferença <= 1 por camada no pior caso e em elencos variados';

  -- Posição desligada: mesmo resultado de antes da migration (md5 capturado no banco antes de aplicá-la)
  v_pl := (select jsonb_agg(jsonb_build_object('id', md5('pd' || i)::uuid, 'stars', 1 + (i * 3 % 5), 'super', i in (2, 9),
            'main', (array['CENTER_BACK', 'FULL_BACK', 'DEFENSIVE_MID', 'ATTACKING_MID', 'FORWARD', 'ANY'])[1 + i % 6],
            'sec', null) order by i)
           from generate_series(1, 16) i);
  perform pg_temp.assert_that(md5(private.sort_teams(v_pl, '{}', 8, false, null, 0.42)::text) = 'ba4cb082dfba1a02929f9d61ee64d8c5',
    'Posição desligada, 8 por Time, seed 0.42: igual a antes');
  perform pg_temp.assert_that(md5(private.sort_teams(v_pl, '{}', 5, false, null, 0.7)::text) = 'd82fe87c7e86de2f52c56000d4f03207',
    'Posição desligada, 5 por Time, seed 0.7: igual a antes');
  raise notice 'PASS: Posição desligada inalterada com p_seed fixo';
end $$;

-- ============================================================
-- 12. Grants e fronteiras
-- ============================================================
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.set_member_position_details(uuid, uuid, public.position_detail, public.position_detail)',
    'public.add_guest(uuid, text, public.plays_as, public.position, public.position, smallint, boolean, public.position_detail, public.position_detail)',
    'public.include_event_sort_guest(uuid, text, public.plays_as, public.position, public.position, smallint, boolean, public.position_detail, public.position_detail)',
    'public.list_event_attendance(uuid)', 'public.list_racha_members(uuid)'] loop
    perform pg_temp.assert_that(has_function_privilege('authenticated', v_fn, 'execute'), v_fn || ' para authenticated');
    perform pg_temp.assert_that(not has_function_privilege('anon', v_fn, 'execute'), v_fn || ' negada a anon');
  end loop;
  foreach v_fn in array array[
    'private.position_detail_fits(public.position, public.position_detail)',
    'private.position_layer(public.position, public.position_detail, integer)',
    'private.assert_no_position_detail_pending(uuid, jsonb)',
    'private.join_request_position_details()'] loop
    perform pg_temp.assert_that(not has_function_privilege('authenticated', v_fn, 'execute')
      and not has_function_privilege('anon', v_fn, 'execute'), v_fn || ' sem grant a clientes');
  end loop;
  perform pg_temp.assert_that(to_regprocedure('public.add_guest(uuid, text, public.plays_as, public.position, public.position, smallint, boolean)') is null,
    'assinatura antiga de add_guest removida');
  perform pg_temp.assert_that(to_regprocedure('public.include_event_sort_guest(uuid, text, public.plays_as, public.position, public.position, smallint, boolean)') is null,
    'assinatura antiga de include_event_sort_guest removida');
  perform pg_temp.assert_that(has_column_privilege('authenticated', 'public.join_request', 'primary_position_detail', 'insert')
    and has_column_privilege('authenticated', 'public.join_request', 'secondary_position_detail', 'insert')
    and not has_column_privilege('authenticated', 'public.join_request', 'status', 'insert'),
    'Solicitação: insert só nas colunas do app');
  raise notice 'PASS: grants das RPCs novas, funções privadas fechadas e insert por coluna na Solicitação';
end $$;

-- ============================================================
-- 13. Convite diz o tamanho de Time a quem ainda não é Membro
-- ============================================================
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_out uuid := gen_random_uuid();
  v_racha uuid;
  v_inv record;
begin
  perform pg_temp.new_user(v_owner, 'Dono Convite', 'OUTFIELD', 'ANY', null);
  perform pg_temp.new_user(v_out, 'Fora Convite', 'OUTFIELD', 'DEFENDER', 'MIDFIELDER');
  v_racha := pg_temp.new_racha('ZZZPDC', 9, v_owner);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_out::text, true);
  -- a RLS esconde o Racha; o convite é o único caminho
  perform pg_temp.assert_that(not exists (select 1 from public.racha r where r.id = v_racha),
    'não-Membro não lê o Racha pela RLS');
  select * into v_inv from public.get_invite('zzzpdc');
  perform pg_temp.assert_that(v_inv.racha_id = v_racha and v_inv.outfield_per_team = 9
    and v_inv.my_status is null, 'get_invite devolve outfield_per_team ao não-Membro');
  reset role;

  perform pg_temp.assert_that(has_function_privilege('authenticated', 'public.get_invite(text)', 'execute')
    and not has_function_privilege('anon', 'public.get_invite(text)', 'execute'), 'get_invite: grants mantidos');
  raise notice 'PASS: get_invite devolve outfield_per_team a quem ainda não é Membro';
end $$;

rollback;
