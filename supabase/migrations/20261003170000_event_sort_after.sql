-- Sorteio do Evento, etapa 3: Presença depois da confirmação, Saída, Inclusão e Volta
-- (regras 6.3, 6.4, 7.3, 8.3, 11.4 e 11.5; plano do Sorteio de 03/10/2026).
-- Só vale para Evento com Sorteio confirmado: `active` legado e `upcoming` seguem o fluxo antigo.

-- Avulso que saiu fica na tabela (pagamento e comparecimento são fatos do Evento);
-- left_at é o estado equivalente ao `left` do Membro.
alter table public.event_guest add column left_at timestamptz;

-- Saída do Membro ou do Avulso não apaga o vínculo com o Time: o histórico vive em
-- event_sort_team_player.left_at. Só a ocupação de vagas muda.
create or replace function private.event_occupancy(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.event_confirmed_count(p_event_id)
    + (select count(*)::integer from public.event_guest g
       where g.event_id = p_event_id and g.left_at is null);
$$;

create function private.event_sort_confirmed(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_sort s where s.event_id = p_event_id and s.status = 'confirmed'
  );
$$;

-- Presença livre e promoção automática acabam quando o Sorteio é confirmado.
create function private.assert_no_confirmed_sort(p_event_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.event_sort_confirmed(p_event_id) then
    raise exception 'sort_confirmed';
  end if;
end $$;

-- Saída, Inclusão e Volta só existem com Times publicados e o Evento em andamento.
create function private.assert_event_sort_operable(p_event public.event)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.event_sort_confirmed(p_event.id) then
    raise exception 'sort_not_confirmed';
  end if;
  if p_event.status <> 'active' then
    raise exception 'event_not_active';
  end if;
end $$;

revoke execute on function
  private.event_sort_confirmed(uuid),
  private.assert_no_confirmed_sort(uuid),
  private.assert_event_sort_operable(public.event)
  from public, anon, authenticated;

-- A fila fica sem buracos quando um Time sai dela (o "fim da fila" é max + 1).
-- Uma instrução só: a chave única adiável confere no fim dela.
create function private.event_sort_compact_queue(p_event_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.event_sort_team t set queue_order = r.n
  from (
    select x.id, row_number() over (order by x.queue_order)::smallint as n
    from public.event_sort_team x
    where x.event_id = p_event_id and x.queue_order is not null
  ) r
  where t.id = r.id and t.queue_order is distinct from r.n;
$$;

-- Regime de Goleiros (8.3) com os Times ativos de agora. Sem Partida, só se persiste
-- a ordem: Goleiro de Time ativo fica com o Time (quando o regime é "cada um com o seu"),
-- Goleiro de Time arquivado vai para o fim da fila, e Times sem Goleiro pegam o primeiro
-- da fila. No rodízio ninguém é de Time: quem estava num Time ativo vira o começo da fila
-- (é quem está no gol), depois a fila antiga, depois os de Times arquivados.
create function private.event_sort_rebalance_goalkeepers(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teams integer;
  v_gks integer;
  v_per_team boolean;
begin
  select count(*) into v_teams from public.event_sort_team t
  where t.event_id = p_event_id and t.queue_order is not null;
  select count(*) into v_gks from public.event_sort_goalkeeper k where k.event_id = p_event_id;
  v_per_team := v_gks >= v_teams;

  with gk as (
    select k.id, k.team_id,
      case when tm.queue_order is not null then 0 when k.team_id is null then 1 else 2 end as grp,
      row_number() over (
        order by case when tm.queue_order is not null then 0 when k.team_id is null then 1 else 2 end,
          tm.queue_order, k.queue_order, k.id
      ) as pos
    from public.event_sort_goalkeeper k
    left join public.event_sort_team tm on tm.id = k.team_id
    where k.event_id = p_event_id
  ), free_teams as (
    select tm.id, row_number() over (order by tm.queue_order) as n
    from public.event_sort_team tm
    where v_per_team and tm.event_id = p_event_id and tm.queue_order is not null
      and not exists (select 1 from gk where gk.team_id = tm.id and gk.grp = 0)
  ), loose as (
    select gk.id, row_number() over (order by gk.pos) as n
    from gk where not (v_per_team and gk.grp = 0)
  ), plan as (
    select gk.id, gk.team_id, null::smallint as queue_order
    from gk where v_per_team and gk.grp = 0
    union all
    select l.id, ft.id,
      case when ft.id is null then (l.n - (select count(*) from free_teams))::smallint end
    from loose l left join free_teams ft on ft.n = l.n
  )
  update public.event_sort_goalkeeper k set team_id = p.team_id, queue_order = p.queue_order
  from plan p where k.id = p.id;
end $$;

-- Fecha a passagem da pessoa: sai do Time (histórico em left_at) e da fila do gol.
-- Time sem jogador de linha ativo sai da fila ativa e fica no histórico (decisão do dono);
-- o Goleiro que era dele é recolocado pelo recálculo.
create function private.event_sort_close_player(p_event_id uuid, p_profile_id uuid, p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  update public.event_sort_team_player p set left_at = now()
  where p.event_id = p_event_id and p.person_id = coalesce(p_profile_id, p_guest_id)
    and p.left_at is null
  returning p.team_id into v_team_id;

  delete from public.event_sort_goalkeeper k
  where k.event_id = p_event_id and k.person_id = coalesce(p_profile_id, p_guest_id);

  if v_team_id is not null and not exists (
    select 1 from public.event_sort_team_player p where p.team_id = v_team_id and p.left_at is null
  ) then
    update public.event_sort_team t set queue_order = null where t.id = v_team_id;
    perform private.event_sort_compact_queue(p_event_id);
  end if;

  perform private.event_sort_rebalance_goalkeepers(p_event_id);
end $$;

-- Destino da Inclusão e da Volta: o primeiro Time incompleto da fila ou um Time novo
-- no fim. Goleiro nunca vai para a linha: entra no fim da fila do gol e o recálculo decide.
-- Os atributos são os de agora (a pessoa pode ter mudado desde o Sorteio); o retrato
-- da passagem anterior fica no histórico.
create function private.event_sort_place_player(
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

    select t.id into v_team_id
    from public.event_sort_team t
    where t.event_id = p_event_id and t.queue_order is not null
      and (select count(*) from public.event_sort_team_player p
           where p.team_id = t.id and p.left_at is null) < v_per_team
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
      is_super_star_snapshot, primary_position_snapshot, secondary_position_snapshot
    ) values (
      p_event_id, v_team_id, p_profile_id, p_guest_id, p_stars, p_super, p_main, p_sec
    );
  end if;

  perform private.event_sort_rebalance_goalkeepers(p_event_id);
end $$;

revoke execute on function
  private.event_sort_compact_queue(uuid),
  private.event_sort_rebalance_goalkeepers(uuid),
  private.event_sort_close_player(uuid, uuid, uuid),
  private.event_sort_place_player(uuid, uuid, uuid, public.plays_as, smallint, boolean, public.position, public.position)
  from public, anon, authenticated;

-- --- Presença e Avulso: bloqueio com Sorteio confirmado ---

-- Sem promoção automática depois do Sorteio: quem esperava fica Aguardando inclusão,
-- mesmo quando uma Saída abre vaga. Um ponto só cobre todos os chamadores.
create or replace function private.promote_waitlist_for_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_slots integer;
  v_profile_id uuid;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found or private.event_sort_confirmed(p_event_id) then
    return;
  end if;

  loop
    if v_event.spot_limit is not null then
      v_slots := v_event.spot_limit - private.event_occupancy(p_event_id);
      if v_slots <= 0 then
        exit;
      end if;
    end if;

    select ea.profile_id into v_profile_id
    from public.event_attendance ea
    where ea.event_id = p_event_id and ea.status = 'waitlisted'
    order by
      case when private.member_has_event_monthly_pass(p_event_id, ea.profile_id) then 0 else 1 end,
      ea.waitlisted_at,
      ea.profile_id
    limit 1
    for update of ea;

    if not found then
      exit;
    end if;

    update public.event_attendance ea set
      status = 'confirmed',
      waitlisted_at = null
    where ea.event_id = p_event_id and ea.profile_id = v_profile_id;

    perform private.sync_monthly_coverage_for_member(p_event_id, v_profile_id);
    perform private.mark_paid_fact_had_slot(p_event_id, v_profile_id);
  end loop;
end $$;

create or replace function public.confirm_attendance(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_uid uuid := (select auth.uid());
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_member';
  end if;
  perform private.assert_no_confirmed_sort(p_event_id);

  perform private.try_confirm_member(p_event_id, v_uid);
end $$;

create or replace function public.cancel_attendance(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_uid uuid := (select auth.uid());
  v_row public.event_attendance%rowtype;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_member';
  end if;
  perform private.assert_no_confirmed_sort(p_event_id);

  select * into v_row from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = v_uid
  for update;

  if not found or v_row.status not in ('confirmed', 'waitlisted') then
    raise exception 'not_allowed';
  end if;

  update public.event_attendance ea set
    status = 'cancelled',
    waitlisted_at = null
  where ea.event_id = p_event_id and ea.profile_id = v_uid;

  if v_row.status = 'confirmed' then
    perform private.promote_waitlist_for_event(p_event_id);
  end if;
end $$;

create or replace function public.set_attendance_for_member(
  p_event_id uuid,
  p_profile_id uuid,
  p_status public.attendance_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_was_confirmed boolean;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;
  perform private.assert_no_confirmed_sort(p_event_id);

  if not exists (
    select 1 from public.member m
    where m.racha_id = v_event.racha_id and m.profile_id = p_profile_id and m.is_active
  ) then
    raise exception 'not_member';
  end if;

  if p_status = 'confirmed' then
    perform private.try_confirm_member(p_event_id, p_profile_id);
  elsif p_status = 'cancelled' then
    select exists (
      select 1 from public.event_attendance ea
      where ea.event_id = p_event_id
        and ea.profile_id = p_profile_id
        and ea.status = 'confirmed'
    ) into v_was_confirmed;

    update public.event_attendance ea set
      status = 'cancelled',
      waitlisted_at = null
    where ea.event_id = p_event_id and ea.profile_id = p_profile_id
      and ea.status in ('confirmed', 'waitlisted');

    if v_was_confirmed then
      perform private.promote_waitlist_for_event(p_event_id);
    end if;
  else
    raise exception 'not_allowed';
  end if;
end $$;

create or replace function public.add_guest(
  p_event_id uuid,
  p_display_name text,
  p_plays_as public.plays_as,
  p_primary_position public."position",
  p_secondary_position public."position",
  p_stars smallint,
  p_is_super_star boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_guest_id uuid;
  v_stars smallint;
  v_super boolean;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;
  -- depois do Sorteio, Avulso novo só entra por Inclusão
  perform private.assert_no_confirmed_sort(p_event_id);

  perform private.promote_waitlist_for_event(p_event_id);

  if private.event_has_waitlist(p_event_id) then
    raise exception 'spot_limit';
  end if;

  if v_event.spot_limit is not null
     and private.event_occupancy(p_event_id) >= v_event.spot_limit then
    raise exception 'spot_limit';
  end if;

  if p_plays_as = 'GOALKEEPER' then
    v_stars := null;
    v_super := false;
  else
    v_stars := p_stars;
    v_super := coalesce(p_is_super_star, false);
  end if;

  insert into public.event_guest (
    event_id, display_name, plays_as, primary_position, secondary_position, stars, is_super_star
  ) values (
    p_event_id, btrim(p_display_name), p_plays_as, p_primary_position, p_secondary_position,
    v_stars, v_super
  ) returning id into v_guest_id;

  return v_guest_id;
end $$;

-- Com Sorteio confirmado remover Avulso é Saída: o vínculo com o Time (em cascade) e o
-- pagamento ficam; só o Condutor registra, como em leave_event_sort.
create or replace function public.remove_guest(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.event_guest%rowtype;
  v_event public.event;
begin
  select * into v_guest from public.event_guest g where g.id = p_guest_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(v_guest.event_id);
  perform private.assert_open_attendance_event(v_event);

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if private.event_sort_confirmed(v_guest.event_id) then
    if v_event.conductor_id is distinct from (select auth.uid()) then
      raise exception 'not_conductor';
    end if;
    -- relê sob a trava: outra Saída pode ter passado na frente
    select * into v_guest from public.event_guest g where g.id = p_guest_id;
    if v_guest.left_at is null then
      update public.event_guest g set left_at = now() where g.id = p_guest_id;
      perform private.event_sort_close_player(v_guest.event_id, null, p_guest_id);
    end if;
    return;
  end if;

  delete from public.event_guest g where g.id = p_guest_id;
  perform private.promote_waitlist_for_event(v_guest.event_id);
end $$;

-- Membro que sai do Racha ou é expulso também sai do Time: sem isso ficaria jogador
-- ativo de Time sem ser Membro. A Presença segue sendo apagada, como antes.
create or replace function private.cleanup_member_attendance(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_was_confirmed boolean;
begin
  for v_event_id in
    select e.id
    from public.event e
    where e.racha_id = p_racha_id and e.status in ('upcoming', 'active')
  loop
    select exists (
      select 1 from public.event_attendance ea
      where ea.event_id = v_event_id
        and ea.profile_id = p_profile_id
        and ea.status = 'confirmed'
    ) into v_was_confirmed;

    if private.event_sort_confirmed(v_event_id) then
      perform private.event_sort_close_player(v_event_id, p_profile_id, null);
    end if;

    delete from public.event_attendance ea
    where ea.event_id = v_event_id and ea.profile_id = p_profile_id;

    if v_was_confirmed then
      perform private.promote_waitlist_for_event(v_event_id);
    end if;
  end loop;
end $$;

-- --- Caixa: quem saiu continua sendo fato do Evento ---

-- `left` pode ser marcado como veio (jogou e saiu cedo) e como pagou; o critério
-- had_slot_since_payment segue o mesmo: só `confirmed` agora ou o fato já marcado.
create or replace function public.set_attendance_attended(
  p_event_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_did_attend boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_attendance public.event_attendance%rowtype;
  v_fact public.event_payment_fact%rowtype;
begin
  if (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(p_event_id);

  if v_event.status not in ('upcoming', 'active', 'finished') then
    raise exception 'not_allowed';
  end if;

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if p_guest_id is not null then
    if v_event.status <> 'finished' then
      perform private.assert_open_attendance_event(v_event);
    end if;
    update public.event_guest g set did_attend = p_did_attend
    where g.id = p_guest_id and g.event_id = p_event_id;
    if not found then
      raise exception 'not_allowed';
    end if;
    if v_event.status = 'finished' then
      perform private.settle_event_credits(p_event_id);
    end if;
    return;
  end if;

  select * into v_attendance from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id;
  select * into v_fact from public.event_payment_fact f
  where f.event_id = p_event_id and f.profile_id = p_profile_id;

  if v_event.status = 'finished' then
    if v_attendance.profile_id is null and v_fact.profile_id is null then
      raise exception 'not_allowed';
    end if;
    if p_did_attend
       and coalesce(v_attendance.status::text, 'cancelled') not in ('confirmed', 'left')
       and not coalesce(v_fact.had_slot_since_payment, false) then
      raise exception 'not_confirmed';
    end if;

    if v_attendance.profile_id is not null then
      update public.event_attendance ea set did_attend = p_did_attend
      where ea.event_id = p_event_id and ea.profile_id = p_profile_id;
    end if;
    if v_fact.profile_id is not null then
      update public.event_payment_fact f set did_attend = p_did_attend
      where f.event_id = p_event_id and f.profile_id = p_profile_id;
    end if;

    perform private.settle_event_credits(p_event_id);
    return;
  end if;

  perform private.assert_open_attendance_event(v_event);

  if p_did_attend
     and (v_attendance.profile_id is null or v_attendance.status not in ('confirmed', 'left')) then
    raise exception 'not_confirmed';
  end if;

  update public.event_attendance ea set did_attend = p_did_attend
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id;

  update public.event_payment_fact f set did_attend = p_did_attend
  where f.event_id = p_event_id and f.profile_id = p_profile_id;
end $$;

create or replace function public.set_attendance_paid(
  p_event_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_paid boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_attendance public.event_attendance%rowtype;
  v_fact public.event_payment_fact%rowtype;
  v_year_month text;
  v_apply integer;
  v_cash integer;
  v_cycle uuid;
  v_had_slot boolean;
begin
  if (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(p_event_id);

  if v_event.status not in ('upcoming', 'active', 'finished') then
    raise exception 'not_allowed';
  end if;

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  if not v_event.is_paid or v_event.price is null then
    raise exception 'not_allowed';
  end if;

  v_year_month := private.event_civil_year_month(v_event.starts_on, v_event.starts_at);

  if p_guest_id is not null then
    if v_event.status <> 'finished' then
      perform private.assert_open_attendance_event(v_event);
    end if;
    update public.event_guest g set is_paid = p_paid
    where g.id = p_guest_id and g.event_id = p_event_id;
    if not found then
      raise exception 'not_allowed';
    end if;
    if v_event.status = 'finished' then
      perform private.settle_event_credits(p_event_id);
    end if;
    return;
  end if;

  select * into v_attendance from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id;
  select * into v_fact from public.event_payment_fact f
  where f.event_id = p_event_id and f.profile_id = p_profile_id;

  if v_event.status = 'finished' then
    if v_attendance.profile_id is null and v_fact.profile_id is null then
      raise exception 'not_confirmed';
    end if;
  else
    perform private.assert_open_attendance_event(v_event);
    if v_attendance.profile_id is null
       or v_attendance.status not in ('confirmed', 'waitlisted', 'left') then
      raise exception 'not_confirmed';
    end if;
  end if;

  if private.member_has_event_monthly_pass(p_event_id, p_profile_id)
     or coalesce(v_fact.monthly_coverage_month = v_year_month, false) then
    if not p_paid then
      raise exception 'mensalista_paid';
    end if;
    return;
  end if;

  if not p_paid then
    if v_event.status = 'finished'
       and v_fact.payment_cycle_id is not null
       and private.settlement_consumed(
         p_event_id, p_profile_id, v_fact.payment_cycle_id
       ) then
      raise exception 'credit_already_used';
    end if;

    if v_fact.payment_cycle_id is not null then
      perform private.clear_settlement_entries(
        p_event_id, p_profile_id, v_fact.payment_cycle_id
      );
    end if;

    if coalesce(v_fact.credit_applied_amount, 0) > 0 then
      perform private.lock_credit_balance(v_event.racha_id, p_profile_id);
      delete from public.racha_credit_entry c
      where c.racha_id = v_event.racha_id
        and c.profile_id = p_profile_id
        and c.source_event_id = p_event_id
        and c.entry_kind = 'apply';
    end if;

    delete from public.event_payment_fact f
    where f.event_id = p_event_id and f.profile_id = p_profile_id
      and f.paid_marked_at is not null;

    if v_event.status = 'finished' then
      perform private.settle_event_credits(p_event_id);
    end if;
    return;
  end if;

  if v_fact.paid_marked_at is not null then
    if v_event.status = 'finished' then
      perform private.settle_event_credits(p_event_id);
    end if;
    return;
  end if;

  v_cycle := gen_random_uuid();
  v_had_slot := coalesce(v_attendance.status = 'confirmed', false)
    or coalesce(v_fact.had_slot_since_payment, false);

  v_apply := private.apply_credit_fifo(
    v_event.racha_id,
    p_profile_id,
    p_event_id,
    format('mark_paid:%s:apply:%s:%s', p_event_id, p_profile_id, v_cycle),
    v_event.price
  );
  v_cash := v_event.price - v_apply;

  insert into public.event_payment_fact (
    event_id, racha_id, profile_id, event_year_month, daily_amount_snapshot,
    cash_paid_amount, credit_applied_amount, did_attend, paid_marked_at,
    had_slot_since_payment, payment_cycle_id
  ) values (
    p_event_id, v_event.racha_id, p_profile_id, v_year_month, v_event.price,
    v_cash, v_apply,
    coalesce(v_attendance.did_attend, v_fact.did_attend, false),
    now(),
    v_had_slot,
    v_cycle
  )
  on conflict (event_id, profile_id) do update set
    daily_amount_snapshot = excluded.daily_amount_snapshot,
    cash_paid_amount = excluded.cash_paid_amount,
    credit_applied_amount = excluded.credit_applied_amount,
    did_attend = excluded.did_attend,
    paid_marked_at = excluded.paid_marked_at,
    had_slot_since_payment = excluded.had_slot_since_payment,
    payment_cycle_id = excluded.payment_cycle_id;

  if v_event.status = 'finished' then
    perform private.settle_event_credits(p_event_id);
  end if;
end $$;

-- --- Saída, Inclusão e Volta ---

-- Saída: o Membro registra a própria; o Condutor, a de qualquer participante (Avulso
-- inclusive). Repetir é inofensivo. Pagamento, comparecimento e Crédito não mudam.
create function public.leave_event_sort(
  p_event_id uuid,
  p_profile_id uuid default null,
  p_guest_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_uid uuid := (select auth.uid());
  v_att public.event_attendance%rowtype;
  v_guest public.event_guest%rowtype;
begin
  if (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(p_event_id);
  if public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_member';
  end if;
  perform private.assert_event_sort_operable(v_event);

  if v_event.conductor_id is distinct from v_uid
     and (p_guest_id is not null or p_profile_id is distinct from v_uid) then
    raise exception 'not_conductor';
  end if;

  if p_profile_id is not null then
    select * into v_att from public.event_attendance ea
    where ea.event_id = p_event_id and ea.profile_id = p_profile_id
    for update;
    if not found or v_att.status not in ('confirmed', 'left') then
      raise exception 'not_confirmed';
    end if;

    if v_att.status = 'confirmed' then
      update public.event_attendance ea set status = 'left', waitlisted_at = null
      where ea.event_id = p_event_id and ea.profile_id = p_profile_id;
      perform private.event_sort_close_player(p_event_id, p_profile_id, null);
    end if;
  else
    select * into v_guest from public.event_guest g
    where g.id = p_guest_id and g.event_id = p_event_id
    for update;
    if not found then
      raise exception 'not_allowed';
    end if;

    if v_guest.left_at is null then
      update public.event_guest g set left_at = now() where g.id = p_guest_id;
      perform private.event_sort_close_player(p_event_id, null, p_guest_id);
    end if;
  end if;

  return private.event_sort_published_json(p_event_id);
end $$;

-- Inclusão de Membro: quem não tem Time (sem Presença, cancelado ou na fila).
create function public.include_event_sort_member(p_event_id uuid, p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_member public.member%rowtype;
  v_att public.event_attendance%rowtype;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

  select * into v_member from public.member m
  where m.racha_id = v_event.racha_id and m.profile_id = p_profile_id and m.is_active;
  if not found then
    raise exception 'not_member';
  end if;

  select * into v_att from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id
  for update;
  if found and v_att.status = 'confirmed' then
    raise exception 'already_participating';
  end if;
  if found and v_att.status = 'left' then
    raise exception 'use_return';
  end if;

  if v_event.spot_limit is not null
     and private.event_occupancy(p_event_id) >= v_event.spot_limit then
    raise exception 'spot_limit';
  end if;

  insert into public.event_attendance (event_id, profile_id, status)
  values (p_event_id, p_profile_id, 'confirmed')
  on conflict (event_id, profile_id) do update set status = 'confirmed', waitlisted_at = null;
  perform private.sync_monthly_coverage_for_member(p_event_id, p_profile_id);
  perform private.mark_paid_fact_had_slot(p_event_id, p_profile_id);

  perform private.event_sort_place_player(
    p_event_id, p_profile_id, null, v_member.plays_as, v_member.stars,
    v_member.is_super_star, v_member.primary_position, v_member.secondary_position
  );

  return private.event_sort_published_json(p_event_id);
end $$;

-- Inclusão de Avulso novo (Avulso não entra em fila de espera: sem vaga, não entra).
create function public.include_event_sort_guest(
  p_event_id uuid,
  p_display_name text,
  p_plays_as public.plays_as,
  p_primary_position public."position",
  p_secondary_position public."position",
  p_stars smallint,
  p_is_super_star boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_guest public.event_guest%rowtype;
  v_stars smallint;
  v_super boolean;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

  if v_event.spot_limit is not null
     and private.event_occupancy(p_event_id) >= v_event.spot_limit then
    raise exception 'spot_limit';
  end if;

  if p_plays_as = 'GOALKEEPER' then
    v_stars := null;
    v_super := false;
  else
    v_stars := p_stars;
    v_super := coalesce(p_is_super_star, false);
  end if;

  insert into public.event_guest (
    event_id, display_name, plays_as, primary_position, secondary_position, stars, is_super_star
  ) values (
    p_event_id, btrim(p_display_name), p_plays_as, p_primary_position, p_secondary_position,
    v_stars, v_super
  ) returning * into v_guest;

  perform private.event_sort_place_player(
    p_event_id, null, v_guest.id, v_guest.plays_as, v_guest.stars,
    v_guest.is_super_star, v_guest.primary_position, v_guest.secondary_position
  );

  return private.event_sort_published_json(p_event_id);
end $$;

-- Volta: quem já integrou um Time e saiu. Mesmo destino da Inclusão; o Time antigo
-- não é recuperado (a passagem antiga fica no histórico).
create function public.return_event_sort_player(
  p_event_id uuid,
  p_profile_id uuid default null,
  p_guest_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_member public.member%rowtype;
  v_att public.event_attendance%rowtype;
  v_guest public.event_guest%rowtype;
begin
  if (p_profile_id is null) = (p_guest_id is null) then
    raise exception 'not_allowed';
  end if;

  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

  if p_profile_id is not null then
    select * into v_att from public.event_attendance ea
    where ea.event_id = p_event_id and ea.profile_id = p_profile_id
    for update;
    if not found or v_att.status <> 'left' then
      raise exception 'not_left';
    end if;
    select * into v_member from public.member m
    where m.racha_id = v_event.racha_id and m.profile_id = p_profile_id and m.is_active;
    if not found then
      raise exception 'not_member';
    end if;
    -- Goleiro não tem passagem por Time; os demais precisam ter integrado um
    if v_member.plays_as = 'OUTFIELD' and not exists (
      select 1 from public.event_sort_team_player p
      where p.event_id = p_event_id and p.person_id = p_profile_id
    ) then
      raise exception 'not_left';
    end if;
  else
    select * into v_guest from public.event_guest g
    where g.id = p_guest_id and g.event_id = p_event_id
    for update;
    if not found or v_guest.left_at is null then
      raise exception 'not_left';
    end if;
  end if;

  if v_event.spot_limit is not null
     and private.event_occupancy(p_event_id) >= v_event.spot_limit then
    raise exception 'spot_limit';
  end if;

  if p_profile_id is not null then
    update public.event_attendance ea set status = 'confirmed', waitlisted_at = null
    where ea.event_id = p_event_id and ea.profile_id = p_profile_id;
    perform private.sync_monthly_coverage_for_member(p_event_id, p_profile_id);
    perform private.mark_paid_fact_had_slot(p_event_id, p_profile_id);
    perform private.event_sort_place_player(
      p_event_id, p_profile_id, null, v_member.plays_as, v_member.stars,
      v_member.is_super_star, v_member.primary_position, v_member.secondary_position
    );
  else
    update public.event_guest g set left_at = null where g.id = p_guest_id;
    perform private.event_sort_place_player(
      p_event_id, null, p_guest_id, v_guest.plays_as, v_guest.stars,
      v_guest.is_super_star, v_guest.primary_position, v_guest.secondary_position
    );
  end if;

  return private.event_sort_published_json(p_event_id);
end $$;

revoke execute on function
  public.leave_event_sort(uuid, uuid, uuid),
  public.include_event_sort_member(uuid, uuid),
  public.include_event_sort_guest(uuid, text, public.plays_as, public."position", public."position", smallint, boolean),
  public.return_event_sort_player(uuid, uuid, uuid)
  from public, anon;
grant execute on function
  public.leave_event_sort(uuid, uuid, uuid),
  public.include_event_sort_member(uuid, uuid),
  public.include_event_sort_guest(uuid, text, public.plays_as, public."position", public."position", smallint, boolean),
  public.return_event_sort_player(uuid, uuid, uuid)
  to authenticated;

-- --- leitura ---

-- Elenco do rascunho: Avulso que saiu não conta (só ocorre depois da confirmação).
create or replace function private.event_sort_roster(p_event_id uuid)
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
    where g.event_id = p_event_id and g.left_at is null
  ) r;
$$;

-- Times publicados + Aguardando inclusão (fila anterior, sem promoção), quem saiu (para a
-- Volta) e as permissões de quem lê. Saída não é cancelamento: nada financeiro aqui.
create or replace function private.event_sort_published_json(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_sort public.event_sort%rowtype;
  v_uid uuid := (select auth.uid());
  v_is_conductor boolean;
  v_my_status public.attendance_status;
  v_operable boolean;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  select * into v_sort from public.event_sort s
  where s.event_id = p_event_id and s.status = 'confirmed';
  if not found then
    return jsonb_build_object('state', 'none');
  end if;

  v_is_conductor := v_event.conductor_id is not distinct from v_uid;
  v_operable := v_event.status = 'active';
  select ea.status into v_my_status from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = v_uid;

  return jsonb_build_object(
    'state', 'published',
    'event_id', p_event_id,
    'event_status', v_event.status,
    'conductor_id', v_event.conductor_id,
    'is_conductor', v_is_conductor,
    'confirmed_at', v_sort.confirmed_at,
    'outfield_per_team', v_event.outfield_per_team,
    'mode', v_sort.mode,
    'balance', private.event_sort_balance_json(v_sort),
    'super_warning', v_sort.super_warning,
    'teams', private.event_sort_teams_json(p_event_id),
    'goalkeepers_per_team', v_sort.goalkeepers_per_team,
    'goalkeeper_queue', private.event_sort_goalkeeper_queue_json(p_event_id),
    -- único bloco que depende de quem lê; o resto é igual para todos
    'viewer', jsonb_build_object(
      'my_status', v_my_status,
      'can_include', v_is_conductor and v_operable,
      'can_return', v_is_conductor and v_operable,
      'can_leave_any', v_is_conductor and v_operable,
      'can_leave_self', coalesce(v_my_status = 'confirmed', false) and v_operable
    ),
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
    ),
    -- Saiu e pode voltar pela Volta; o Condutor é quem vê o comando
    'left', (
      select coalesce(jsonb_agg(x.obj order by x.name, x.id), '[]'::jsonb)
      from (
        select p.display_name as name, ea.profile_id as id,
          jsonb_build_object(
            'kind', 'member', 'profile_id', ea.profile_id, 'guest_id', null,
            'display_name', p.display_name, 'avatar_path', p.avatar_path,
            'plays_as', m.plays_as, 'did_attend', ea.did_attend
          ) as obj
        from public.event_attendance ea
        join public.profile p on p.id = ea.profile_id
        join public.member m
          on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
        where ea.event_id = p_event_id and ea.status = 'left'
        union all
        select g.display_name, g.id,
          jsonb_build_object(
            'kind', 'guest', 'profile_id', null, 'guest_id', g.id,
            'display_name', g.display_name, 'avatar_path', null,
            'plays_as', g.plays_as, 'did_attend', g.did_attend
          )
        from public.event_guest g
        where g.event_id = p_event_id and g.left_at is not null
      ) x
    )
  );
end $$;

-- Presença: `left` aparece na lista (com o pagamento e o comparecimento de sempre),
-- Avulso que saiu também; sort_confirmed diz ao app que confirmar/cancelar livre acabou.
drop function public.list_event_attendance(uuid);

create function public.list_event_attendance(p_event_id uuid)
returns table (
  kind text,
  profile_id uuid,
  guest_id uuid,
  status public.attendance_status,
  queue_position integer,
  display_name text,
  did_attend boolean,
  is_paid_effective boolean,
  is_monthly_pass boolean,
  cash_paid_amount integer,
  credit_applied_amount integer,
  plays_as public.plays_as,
  stars smallint,
  is_super_star boolean,
  avatar_path text,
  primary_position public."position",
  secondary_position public."position",
  role public.member_role,
  credit_balance integer,
  present_payer_count integer,
  payer_target integer,
  event_status public.event_status,
  my_credit_balance integer,
  sort_confirmed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_role public.member_role;
  v_year_month text;
  v_uid uuid := (select auth.uid());
  v_present integer;
  v_my_credit integer;
  v_sorted boolean;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  if public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_member';
  end if;

  v_role := public.my_racha_role(v_event.racha_id);
  v_year_month := private.event_civil_year_month(v_event.starts_on, v_event.starts_at);
  v_present := private.count_present_payers(p_event_id);
  v_my_credit := private.credit_balance(v_event.racha_id, v_uid);
  v_sorted := private.event_sort_confirmed(p_event_id);

  return query
    select
      'member'::text,
      ea.profile_id,
      null::uuid,
      ea.status,
      case when ea.status = 'waitlisted'
        then private.my_waitlist_position(p_event_id, ea.profile_id)
        else null
      end,
      p.display_name,
      ea.did_attend,
      (
        private.member_has_event_monthly_pass(p_event_id, ea.profile_id)
        or coalesce(f.paid_marked_at is not null, false)
        or coalesce(f.monthly_coverage_month = v_year_month, false)
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false)
      ),
      private.member_has_event_monthly_pass(p_event_id, ea.profile_id),
      f.cash_paid_amount,
      f.credit_applied_amount,
      m.plays_as,
      m.stars,
      m.is_super_star,
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role,
      case
        when v_role in ('OWNER', 'ADMIN') then private.credit_balance(v_event.racha_id, ea.profile_id)
        when ea.profile_id = v_uid then v_my_credit
        else null
      end,
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit,
      v_sorted
    from public.event_attendance ea
    join public.profile p on p.id = ea.profile_id
    join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = ea.profile_id
    where ea.event_id = p_event_id
      and ea.status in ('confirmed', 'waitlisted', 'left')
    union all
    select
      'member'::text,
      ea.profile_id,
      null::uuid,
      ea.status,
      null::integer,
      p.display_name,
      ea.did_attend,
      coalesce(f.paid_marked_at is not null, false)
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false),
      false,
      f.cash_paid_amount,
      f.credit_applied_amount,
      m.plays_as,
      m.stars,
      m.is_super_star,
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role,
      case
        when v_role in ('OWNER', 'ADMIN') then private.credit_balance(v_event.racha_id, ea.profile_id)
        when ea.profile_id = v_uid then v_my_credit
        else null
      end,
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit,
      v_sorted
    from public.event_attendance ea
    join public.profile p on p.id = ea.profile_id
    join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = ea.profile_id
    where ea.event_id = p_event_id
      and ea.status = 'cancelled'
      and coalesce(v_role in ('OWNER', 'ADMIN'), false)
    union all
    -- fatos sem attendance (saída/expulsão), só admin
    select
      'member'::text,
      f.profile_id,
      null::uuid,
      null::public.attendance_status,
      null::integer,
      p.display_name,
      f.did_attend,
      (
        f.paid_marked_at is not null
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false)
        or f.monthly_coverage_month is not null
      ),
      coalesce(f.monthly_coverage_month = v_year_month, false),
      f.cash_paid_amount,
      f.credit_applied_amount,
      coalesce(m.plays_as, 'OUTFIELD'::public.plays_as),
      m.stars,
      coalesce(m.is_super_star, false),
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role,
      private.credit_balance(v_event.racha_id, f.profile_id),
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit,
      v_sorted
    from public.event_payment_fact f
    join public.profile p on p.id = f.profile_id
    left join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = f.profile_id
    where f.event_id = p_event_id
      and coalesce(v_role in ('OWNER', 'ADMIN'), false)
      and not exists (
        select 1 from public.event_attendance ea
        where ea.event_id = p_event_id and ea.profile_id = f.profile_id
      )
    union all
    select
      'guest'::text,
      null::uuid,
      g.id,
      case when g.left_at is null then 'confirmed' else 'left' end::public.attendance_status,
      null::integer,
      g.display_name,
      g.did_attend,
      g.is_paid,
      false,
      case when g.is_paid then v_event.price else null end,
      null::integer,
      g.plays_as,
      g.stars,
      g.is_super_star,
      null::text,
      g.primary_position,
      g.secondary_position,
      null::public.member_role,
      null::integer,
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit,
      v_sorted
    from public.event_guest g
    where g.event_id = p_event_id
    order by 1, 4 nulls last, 5 nulls last, 6;
end $$;

revoke execute on function public.list_event_attendance(uuid) from public, anon;
grant execute on function public.list_event_attendance(uuid) to authenticated;

-- Cartões do Evento: `left` chega em my_status; sort_confirmed separa "Times definidos"
-- do `active` legado ("Evento em curso") e troca "na fila" por Aguardando inclusão.
drop function public.list_my_racha_events();

create function public.list_my_racha_events()
returns table (
  racha_id uuid,
  id uuid,
  status public.event_status,
  starts_on date,
  starts_at time,
  place text,
  confirmed_count integer,
  spot_limit smallint,
  my_status text,
  my_queue_position integer,
  sort_confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.racha_id, selected.id, selected.status, selected.starts_on,
    selected.starts_at, selected.place,
    private.event_occupancy(selected.id), selected.spot_limit,
    ea.status::text,
    case when ea.status = 'waitlisted'
      then private.my_waitlist_position(selected.id, m.profile_id)
      else null
    end,
    private.event_sort_confirmed(selected.id)
  from public.member m
  join lateral (
    select e.id, e.status, e.starts_on, e.starts_at, e.place, e.spot_limit
    from public.event e
    where e.racha_id = m.racha_id
      and e.status in ('active'::public.event_status, 'upcoming'::public.event_status)
    order by case when e.status = 'active' then 0 else 1 end,
      e.starts_on, e.starts_at, e.id
    limit 1
  ) selected on true
  left join public.event_attendance ea
    on ea.event_id = selected.id and ea.profile_id = m.profile_id
  where m.profile_id = (select auth.uid())
    and m.is_active;
$$;

revoke execute on function public.list_my_racha_events() from public, anon;
grant execute on function public.list_my_racha_events() to authenticated;

drop function public.list_open_events(uuid);

create function public.list_open_events(p_racha_id uuid)
returns table (
  id uuid,
  status public.event_status,
  starts_on date,
  starts_at time,
  place text,
  is_paid boolean,
  price integer,
  spot_limit smallint,
  payer_target integer,
  outfield_per_team smallint,
  conductor_id uuid,
  conductor_name text,
  confirmed_count integer,
  my_status text,
  my_queue_position integer,
  sort_confirmed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if public.my_racha_role(p_racha_id) is null then
    raise exception 'not_member';
  end if;

  return query
    select e.id, e.status, e.starts_on, e.starts_at, e.place, e.is_paid, e.price,
      e.spot_limit, e.payer_target, e.outfield_per_team, e.conductor_id, p.display_name,
      private.event_occupancy(e.id),
      ea.status::text,
      case when ea.status = 'waitlisted' then private.my_waitlist_position(e.id, v_uid) else null end,
      private.event_sort_confirmed(e.id)
    from public.event e
    left join public.profile p on p.id = e.conductor_id
    left join public.event_attendance ea
      on ea.event_id = e.id and ea.profile_id = v_uid
    where e.racha_id = p_racha_id
      and e.status in ('upcoming', 'active')
    order by
      case e.status when 'active' then 0 else 1 end,
      e.starts_on,
      e.starts_at,
      e.id;
end $$;

revoke execute on function public.list_open_events(uuid) from public, anon;
grant execute on function public.list_open_events(uuid) to authenticated;
