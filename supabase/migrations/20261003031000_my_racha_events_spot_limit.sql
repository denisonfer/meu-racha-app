-- A lista Meus Rachas mostra a capacidade do Evento, que pode diferir do default do Racha.
drop function if exists public.list_my_racha_events();

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
  my_queue_position integer
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
    end
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
