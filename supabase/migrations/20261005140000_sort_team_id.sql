-- id do Time na leitura dos Times: as Bolinhas mandam ids para a RPC e o app
-- descobria pela fila da Partida. Corpo de 20261003210000; só acrescenta team_id.
create or replace function private.event_sort_teams_json(p_event_id uuid)
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
        'team_id', tm.id,
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
            'primary_layer', private.position_layer(
              p.primary_position_snapshot, p.primary_position_detail_snapshot, e.outfield_per_team
            ),
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
