-- Ordem de saída do saco independente da cor (Bolinhas, regras 11.2 v1.39).
-- Corpo de 20261005120000; só muda o sorteio.
create or replace function public.draw_event_bolinhas(
  p_event_id uuid,
  p_giver_team_id uuid,
  p_receiver_team_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_active integer;
  v_slots integer;
  v_blue integer;
  v_all_move boolean;
  v_id uuid;
  v_order jsonb;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

  if not coalesce(private.event_bolinhas_can_pair(p_event_id, p_giver_team_id, p_receiver_team_id), false) then
    raise exception 'invalid_pair';
  end if;

  select count(*) into v_active from public.event_sort_team_player p
  where p.team_id = p_giver_team_id and p.left_at is null;
  select v_event.outfield_per_team - count(*) into v_slots from public.event_sort_team_player p
  where p.team_id = p_receiver_team_id and p.left_at is null;
  v_blue := least(v_slots, v_active);
  v_all_move := v_active <= v_slots;

  insert into public.event_bolinhas (event_id, giver_team_id, receiver_team_id, all_move, created_by)
  values (p_event_id, p_giver_team_id, p_receiver_team_id, v_all_move, (select auth.uid()))
  returning id into v_id;

  -- dois sorteios independentes: um escolhe quem é azul, outro a ordem de saída do saco;
  -- com um só, as azuis saíam sempre primeiro e a revelação perdia o suspense
  with colored as (
    select p.profile_id, p.guest_id,
      row_number() over (order by random()) <= v_blue as is_blue
    from public.event_sort_team_player p
    where p.team_id = p_giver_team_id and p.left_at is null
  )
  insert into public.event_bolinhas_ball (bolinhas_id, draw_order, profile_id, guest_id, color)
  select v_id, (row_number() over (order by random()))::smallint, c.profile_id, c.guest_id,
    (case when c.is_blue then 'blue' else 'red' end)::public.event_bolinhas_color
  from colored c;

  -- fecha a origem antes de inserir (unique de pessoa ativa no Evento) e copia os snapshots
  with closed as (
    update public.event_sort_team_player p set left_at = now()
    from public.event_bolinhas_ball b
    where b.bolinhas_id = v_id and b.color = 'blue'
      and p.team_id = p_giver_team_id and p.left_at is null
      and p.person_id = coalesce(b.profile_id, b.guest_id)
    returning p.*
  )
  insert into public.event_sort_team_player (
    event_id, team_id, profile_id, guest_id, stars_snapshot,
    is_super_star_snapshot, primary_position_snapshot, secondary_position_snapshot,
    primary_position_detail_snapshot, secondary_position_detail_snapshot
  )
  select c.event_id, p_receiver_team_id, c.profile_id, c.guest_id, c.stars_snapshot,
    c.is_super_star_snapshot, c.primary_position_snapshot, c.secondary_position_snapshot,
    c.primary_position_detail_snapshot, c.secondary_position_detail_snapshot
  from closed c;

  if not exists (
    select 1 from public.event_sort_team_player p
    where p.team_id = p_giver_team_id and p.left_at is null
  ) then
    update public.event_sort_team t set queue_order = null where t.id = p_giver_team_id;
    perform private.event_sort_compact_queue(p_event_id);
  end if;

  perform private.event_sort_rebalance_goalkeepers(p_event_id);

  select coalesce(jsonb_agg(
    private.event_match_person_json(b.profile_id, b.guest_id)
      || jsonb_build_object('color', b.color) order by b.draw_order
  ), '[]'::jsonb) into v_order
  from public.event_bolinhas_ball b where b.bolinhas_id = v_id;

  perform private.event_match_notify(p_event_id);
  return jsonb_build_object(
    'bolinhas_id', v_id,
    'all_move', v_all_move,
    'order', v_order,
    'published', private.event_sort_published_json(p_event_id)
  );
end $$;
