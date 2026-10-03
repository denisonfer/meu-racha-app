-- Sorteio só com quem veio (did_attend), Inclusão de confirmado que não veio e conferência
-- ao encerrar Evento pago (decisões do dono de 03/10/2026).
-- Perde-se o Sorteio "na véspera": sem "veio" marcado ninguém entra na proposta.

-- O Sorteio só considera quem tem "veio" (did_attend): presença confirmada é intenção, "veio" é o
-- fato. Marcar ou desmarcar muda o elenco e portanto a assinatura da proposta, que fica obsoleta.
-- Este helper mantém Presença e fato de pagamento em sincronia; quem o chama já tem a trava do Racha.
create function private.set_member_attended(p_event_id uuid, p_profile_id uuid, p_did_attend boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_attendance ea set did_attend = p_did_attend
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id;

  update public.event_payment_fact f set did_attend = p_did_attend
  where f.event_id = p_event_id and f.profile_id = p_profile_id;
end $$;

revoke execute on function private.set_member_attended(uuid, uuid, boolean)
  from public, anon, authenticated;

-- Mesmo comportamento de antes; a escrita de Presença/fato passa pelo helper.
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

  perform private.set_member_attended(p_event_id, p_profile_id, p_did_attend);
end $$;

-- Só entra no Sorteio quem tem Presença confirmada E "veio" (Membro), ou Avulso com "veio".
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
    where ea.event_id = p_event_id and ea.status = 'confirmed' and ea.did_attend
    union all
    select g.id::text,
      jsonb_build_object(
        'kind', 'guest', 'id', g.id, 'plays_as', g.plays_as,
        'stars', g.stars, 'super', g.is_super_star,
        'main', g.primary_position, 'sec', g.secondary_position
      )
    from public.event_guest g
    where g.event_id = p_event_id and g.left_at is null and g.did_attend
  ) r;
$$;

-- Times publicados: Aguardando inclusão ganha `reason` (waitlisted | not_attended).
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
    -- Aguardando inclusão: quem estava na fila não sobe sozinho depois da publicação, e quem
    -- confirmou mas não tinha "veio" quando sortearam também não entrou em Time nenhum.
    -- Quem saiu (left) não entra aqui: tem a Volta.
    'waiting_for_inclusion', (
      select coalesce(jsonb_agg(w.obj order by w.grp, w.pos, w.name, w.id), '[]'::jsonb)
      from (
        select 0 as grp, private.my_waitlist_position(p_event_id, ea.profile_id) as pos,
          p.display_name as name, ea.profile_id as id,
          jsonb_build_object(
            'profile_id', ea.profile_id,
            'display_name', p.display_name,
            'avatar_path', p.avatar_path,
            'plays_as', m.plays_as,
            'queue_position', private.my_waitlist_position(p_event_id, ea.profile_id),
            'reason', 'waitlisted'
          ) as obj
        from public.event_attendance ea
        join public.profile p on p.id = ea.profile_id
        join public.member m
          on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
        where ea.event_id = p_event_id and ea.status = 'waitlisted'
        union all
        select 1, null::integer, p.display_name, ea.profile_id,
          jsonb_build_object(
            'profile_id', ea.profile_id,
            'display_name', p.display_name,
            'avatar_path', p.avatar_path,
            'plays_as', m.plays_as,
            'queue_position', null,
            'reason', 'not_attended'
          )
        from public.event_attendance ea
        join public.profile p on p.id = ea.profile_id
        join public.member m
          on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
        where ea.event_id = p_event_id and ea.status = 'confirmed'
          -- Goleiro não tem passagem por Time: a linha no gol diz que já foi sorteado
          and not exists (
            select 1 from public.event_sort_team_player tp
            where tp.event_id = p_event_id and tp.person_id = ea.profile_id
          )
          and not exists (
            select 1 from public.event_sort_goalkeeper k
            where k.event_id = p_event_id and k.person_id = ea.profile_id
          )
      ) w
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

-- Inclusão de Membro: quem não tem Time. Sem Presença, cancelado e na fila precisam de vaga;
-- confirmado que não veio quando sortearam já ocupa a vaga dele, então o Limite não se aplica.
-- Entrar em Time é aparecer: a Presença e o fato de pagamento ficam com "veio".
create or replace function public.include_event_sort_member(p_event_id uuid, p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_member public.member%rowtype;
  v_att public.event_attendance%rowtype;
  v_holds_spot boolean := false;
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
  if found and v_att.status = 'left' then
    raise exception 'use_return';
  end if;
  if found and v_att.status = 'confirmed' then
    -- já em Time ou no gol (ou com passagem encerrada): não é caso de Inclusão
    if exists (
      select 1 from public.event_sort_team_player tp
      where tp.event_id = p_event_id and tp.person_id = p_profile_id
    ) or exists (
      select 1 from public.event_sort_goalkeeper k
      where k.event_id = p_event_id and k.person_id = p_profile_id
    ) then
      raise exception 'already_participating';
    end if;
    v_holds_spot := true;
  end if;

  if not v_holds_spot then
    if v_event.spot_limit is not null
       and private.event_occupancy(p_event_id) >= v_event.spot_limit then
      raise exception 'spot_limit';
    end if;

    insert into public.event_attendance (event_id, profile_id, status)
    values (p_event_id, p_profile_id, 'confirmed')
    on conflict (event_id, profile_id) do update set status = 'confirmed', waitlisted_at = null;
    perform private.sync_monthly_coverage_for_member(p_event_id, p_profile_id);
    perform private.mark_paid_fact_had_slot(p_event_id, p_profile_id);
  end if;

  perform private.set_member_attended(p_event_id, p_profile_id, true);

  perform private.event_sort_place_player(
    p_event_id, p_profile_id, null, v_member.plays_as, v_member.stars,
    v_member.is_super_star, v_member.primary_position, v_member.secondary_position
  );

  return private.event_sort_published_json(p_event_id);
end $$;

-- Avulso novo por Inclusão nasce com "veio".
create or replace function public.include_event_sort_guest(
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
    event_id, display_name, plays_as, primary_position, secondary_position, stars, is_super_star,
    did_attend
  ) values (
    p_event_id, btrim(p_display_name), p_plays_as, p_primary_position, p_secondary_position,
    v_stars, v_super, true
  ) returning * into v_guest;

  perform private.event_sort_place_player(
    p_event_id, null, v_guest.id, v_guest.plays_as, v_guest.stars,
    v_guest.is_super_star, v_guest.primary_position, v_guest.secondary_position
  );

  return private.event_sort_published_json(p_event_id);
end $$;

-- confirmed_count / not_attended_count: a S1 mostra quantos confirmados ainda faltam marcar "veio".
-- line_count e goalkeeper_count contam só quem veio (é o elenco que o Sorteio usa).
create or replace function private.event_sort_proposal_json(p_event_id uuid)
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
  v_confirmed integer;
  v_not_attended integer;
begin
  select count(*) filter (where e ->> 'plays_as' = 'OUTFIELD')::integer into v_line
  from jsonb_array_elements(v_roster) as e;

  select count(*)::integer, (count(*) filter (where not c.did_attend))::integer
    into v_confirmed, v_not_attended
  from (
    select ea.did_attend
    from public.event_attendance ea
    join public.event e on e.id = ea.event_id
    join public.member m
      on m.racha_id = e.racha_id and m.profile_id = ea.profile_id and m.is_active
    where ea.event_id = p_event_id and ea.status = 'confirmed'
    union all
    select g.did_attend
    from public.event_guest g
    where g.event_id = p_event_id and g.left_at is null
  ) c;

  v_base := jsonb_build_object(
    'event_id', p_event_id,
    'line_count', v_line,
    'goalkeeper_count', jsonb_array_length(v_roster) - v_line,
    'min_line_players', 6,
    'can_sort', v_line >= 6,
    'consider_position', (select e.consider_position from public.event e where e.id = p_event_id),
    'confirmed_count', v_confirmed,
    'not_attended_count', v_not_attended
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

-- Encerrar Evento pago exige conferência dos pagamentos (a apuração do Crédito depende dela).
-- O encerramento automático de 12h não passa por aqui e segue sem bloqueio. O erro sai antes
-- de qualquer efeito; Evento grátis ignora o parâmetro.
drop function public.finish_event(uuid);

create function public.finish_event(p_event_id uuid, p_payments_reviewed boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.event%rowtype;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.racha r where r.id = v_event.racha_id for update;
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  if v_event.status is distinct from 'active' or v_event.conductor_id is distinct from v_uid then
    raise exception 'not_allowed';
  end if;

  if v_event.is_paid and not coalesce(p_payments_reviewed, false) then
    raise exception 'payments_not_reviewed';
  end if;

  update public.event e set
    status = 'finished',
    ended_at = now(),
    ended_by = v_uid,
    ended_by_system = false
  where e.id = p_event_id;

  perform private.settle_event_credits(p_event_id);

  perform private.create_next_recurring_event(
    v_event.racha_id, v_event.id, v_event.starts_on, v_event.starts_at, now()
  );
end $$;

revoke execute on function public.finish_event(uuid, boolean) from public, anon;
grant execute on function public.finish_event(uuid, boolean) to authenticated;
