-- Destino de quem chega (regras 11.4–11.5 v1.38, decisão do dono de 05/10/2026):
-- o incompleto mais atrás na fila, para quem chegou por último não passar na frente de
-- quem já espera. O Time em campo só recebe na hora quando não há Time esperando.
-- Corpo de 20261005100000; place_player e a leitura não mudam (consomem este jsonb).
create or replace function private.event_sort_arrival_destination(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_capacity smallint;
  v_match_open boolean;
  v_t1 uuid;
  v_n1 smallint;
  v_c1 integer := 0;
  v_t2 uuid;
  v_n2 smallint;
  v_c2 integer := 0;
  v_team uuid;
  v_number smallint;
begin
  select e.outfield_per_team into v_capacity from public.event e where e.id = p_event_id;

  v_match_open := exists (
    select 1 from public.event_match m
    where m.event_id = p_event_id and m.status = 'open'
  );

  if v_match_open and not exists (
    select 1 from public.event_sort_team t
    where t.event_id = p_event_id and t.queue_order >= 3
  ) then
    select t.id, t.team_number,
      (select count(*) from public.event_sort_team_player p
       where p.team_id = t.id and p.left_at is null)
    into v_t1, v_n1, v_c1
    from public.event_sort_team t
    where t.event_id = p_event_id and t.queue_order = 1;

    select t.id, t.team_number,
      (select count(*) from public.event_sort_team_player p
       where p.team_id = t.id and p.left_at is null)
    into v_t2, v_n2, v_c2
    from public.event_sort_team t
    where t.event_id = p_event_id and t.queue_order = 2;

    if v_t1 is not null and v_t2 is not null
       and v_c1 < v_capacity and v_c2 < v_capacity and v_c1 = v_c2 then
      return jsonb_build_object(
        'kind', 'field_draw', 'team_id', null, 'team_number', null
      );
    end if;
    if v_t1 is not null and v_c1 < v_capacity
       and (v_t2 is null or v_c2 >= v_capacity or v_c1 < v_c2) then
      return jsonb_build_object(
        'kind', 'field', 'team_id', v_t1, 'team_number', v_n1
      );
    end if;
    if v_t2 is not null and v_c2 < v_capacity then
      return jsonb_build_object(
        'kind', 'field', 'team_id', v_t2, 'team_number', v_n2
      );
    end if;
  end if;

  -- Times em campo não estão "na fila"; entre Partidas, o confronto conta como fila
  select t.id, t.team_number into v_team, v_number
  from public.event_sort_team t
  where t.event_id = p_event_id
    and t.queue_order is not null
    and (not v_match_open or t.queue_order not in (1, 2))
    and (select count(*) from public.event_sort_team_player p
         where p.team_id = t.id and p.left_at is null) < v_capacity
  order by t.queue_order desc
  limit 1;

  if v_team is not null then
    return jsonb_build_object(
      'kind', 'queue', 'team_id', v_team, 'team_number', v_number
    );
  end if;

  select coalesce(max(t.team_number), 0) + 1 into v_number
  from public.event_sort_team t where t.event_id = p_event_id;

  return jsonb_build_object(
    'kind', 'new_team', 'team_id', null, 'team_number', v_number
  );
end $$;
