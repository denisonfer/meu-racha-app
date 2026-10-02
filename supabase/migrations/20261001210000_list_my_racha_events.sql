-- Um cartão por Racha: o evento rolando prevalece sobre o agendado.
create function public.list_my_racha_events()
returns table (
  racha_id uuid,
  id uuid,
  status public.event_status,
  starts_on date,
  starts_at time,
  place text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.racha_id, selected.id, selected.status, selected.starts_on,
    selected.starts_at, selected.place
  from public.member m
  join lateral (
    select e.id, e.status, e.starts_on, e.starts_at, e.place
    from public.event e
    where e.racha_id = m.racha_id
      and e.status in ('active'::public.event_status, 'upcoming'::public.event_status)
    order by case when e.status = 'active' then 0 else 1 end,
      e.starts_on, e.starts_at, e.id
    limit 1
  ) selected on true
  where m.profile_id = (select auth.uid())
    and m.is_active;
$$;

revoke execute on function public.list_my_racha_events() from public, anon;
grant execute on function public.list_my_racha_events() to authenticated;
