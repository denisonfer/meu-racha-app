-- Avisos: o "visto" passa a ser por Aviso. Visto some 7 dias depois de visto;
-- nunca visto fica até ser visto, com teto de 60 dias da criação.

-- Os 7 dias contam de quando cada Aviso foi visto, não da última visita.
alter table public.notification add column seen_at timestamptz;

update public.notification n
  set seen_at = p.notifications_seen_at
  from public.profile p
  where p.id = n.recipient_id
    and n.created_at <= p.notifications_seen_at;

create index notification_recipient_unseen
  on public.notification (recipient_id)
  where seen_at is null;

-- Veio de 20261009100000; mudam só o filtro de prazo e o is_new.
create or replace function public.get_notifications()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rows jsonb;
begin
  if v_uid is null or not exists (select 1 from public.profile p where p.id = v_uid) then
    raise exception 'not_allowed';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', n.id,
      'kind', n.kind,
      'racha_id', n.racha_id,
      'racha_name', n.racha_name,
      'event_id', n.event_id,
      'actor_name', n.actor_name,
      'payload', n.payload,
      'created_at', n.created_at,
      'is_new', n.seen_at is null,
      'resolution', case
        when n.kind is distinct from 'join_request' then null
        when jr.id is not null and jr.status = 'PENDING' then null
        when jr.id is not null and jr.status = 'APPROVED' then jsonb_build_object(
          'status', 'approved',
          'by_name', (select rp.display_name from public.profile rp where rp.id = jr.reviewed_by),
          'by_me', jr.reviewed_by is not distinct from v_uid
        )
        when jr.id is not null and jr.status = 'REJECTED' then jsonb_build_object(
          'status', 'refused',
          'by_name', (select rp.display_name from public.profile rp where rp.id = jr.reviewed_by),
          'by_me', jr.reviewed_by is not distinct from v_uid
        )
        when n.payload ? 'resolution' then jsonb_build_object(
          'status', n.payload #>> '{resolution,status}',
          'by_name', n.payload #>> '{resolution,by_name}',
          'by_me', (n.payload #>> '{resolution,by_id}')::uuid is not distinct from v_uid
        )
        else null
      end,
      'target', case
        when not exists (select 1 from public.racha r where r.id = n.racha_id) then 'racha_deleted'
        when n.kind in ('expelled', 'join_refused') then 'available'
        when not exists (
          select 1 from public.member m
          where m.racha_id = n.racha_id and m.profile_id = v_uid and m.is_active
        ) then 'not_member'
        when n.kind in ('sort_confirmed', 'team_changed', 'conduction_taken')
          and n.event_id is not null
          and not exists (select 1 from public.event e where e.id = n.event_id)
          then 'event_cancelled'
        when n.kind in ('sort_confirmed', 'team_changed', 'conduction_taken')
          and exists (
            select 1 from public.event e
            where e.id = n.event_id and e.status = 'finished'
          )
          then 'event_finished'
        else 'available'
      end
    )
    order by n.created_at desc, n.id desc
  ), '[]'::jsonb)
  into v_rows
  from public.notification n
  left join public.join_request jr on jr.id = n.join_request_id
  where n.recipient_id = v_uid
    and (
      (n.seen_at is null and n.created_at > now() - interval '60 days')
      or n.seen_at > now() - interval '7 days'
    );

  return v_rows;
end $$;

revoke execute on function public.get_notifications() from public, anon;
grant execute on function public.get_notifications() to authenticated;

-- Veio de 20261009100000; conta pelo seen_at de cada Aviso.
create or replace function public.get_unseen_notifications_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.profile p where p.id = v_uid) then
    raise exception 'not_allowed';
  end if;

  return (
    select count(*)::integer
    from public.notification n
    where n.recipient_id = v_uid
      and n.seen_at is null
      and n.created_at > now() - interval '60 days'
  );
end $$;

-- Veio de 20261009100000; marca os não vistos e preserva o seen_at dos já vistos.
create or replace function public.mark_notifications_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.profile p where p.id = v_uid) then
    raise exception 'not_allowed';
  end if;

  update public.notification n
    set seen_at = now()
    where n.recipient_id = v_uid
      and n.seen_at is null;
end $$;

alter table public.profile drop column notifications_seen_at;

select cron.unschedule('purge-old-notifications');

select cron.schedule(
  'purge-old-notifications',
  '15 4 * * *',
  $$delete from public.notification where seen_at < now() - interval '7 days' or (seen_at is null and created_at < now() - interval '60 days')$$
);
