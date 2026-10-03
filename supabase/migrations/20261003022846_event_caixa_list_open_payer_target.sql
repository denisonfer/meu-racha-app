-- Meta no cartão/edição do Evento aberto
drop function if exists public.list_open_events(uuid);

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
  my_queue_position integer
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
      case when ea.status = 'waitlisted' then private.my_waitlist_position(e.id, v_uid) else null end
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
