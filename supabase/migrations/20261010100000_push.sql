-- Push: cada Aviso gravado vai aos aparelhos do destinatário, menos a quem
-- silenciou o Racha. O banco decide tokens, silêncio e número do ícone; a
-- Edge Function send-push só monta o texto, envia e apaga token morto.

create extension if not exists pg_net with schema extensions;

create table public.push_token (
  token text primary key,
  profile_id uuid not null references public.profile (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_token_profile_id on public.push_token (profile_id);

alter table public.push_token enable row level security;
revoke all on public.push_token from public, anon, authenticated;

-- Só existe linha para quem silenciou.
create table public.racha_push_mute (
  profile_id uuid references public.profile (id) on delete cascade,
  racha_id uuid references public.racha (id) on delete cascade,
  primary key (profile_id, racha_id)
);

alter table public.racha_push_mute enable row level security;
revoke all on public.racha_push_mute from public, anon, authenticated;

-- O case de 'target' de get_notifications (20261009110000), movido sem mudar,
-- para o toque no push calcular o mesmo destino. Os aliases mantêm o texto.
create function private.notification_target(
  p_notification public.notification,
  p_uid uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n alias for p_notification;
  v_uid alias for p_uid;
begin
  return case
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
      end;
end $$;

revoke execute on function private.notification_target(public.notification, uuid)
  from public, anon, authenticated;

-- Veio de 20261009110000; muda só o target, que passa a vir de private.notification_target.
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
      'target', private.notification_target(n, v_uid)
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

-- O token é do aparelho: quem entra nele por último fica com ele, e o
-- aparelho nunca recebe push de duas contas.
create function public.register_push_token(p_token text, p_platform text)
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

  insert into public.push_token (token, profile_id, platform)
  values (p_token, v_uid, p_platform)
  on conflict (token) do update
    set profile_id = v_uid,
      platform = excluded.platform,
      updated_at = now();
end $$;

create function public.unregister_push_token(p_token text)
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

  delete from public.push_token t
  where t.token = p_token and t.profile_id = v_uid;
end $$;

create function public.set_racha_push_muted(p_racha_id uuid, p_muted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null
     or not exists (
       select 1 from public.member m
       where m.racha_id = p_racha_id and m.profile_id = v_uid and m.is_active
     ) then
    raise exception 'not_allowed';
  end if;

  if p_muted then
    insert into public.racha_push_mute (profile_id, racha_id)
    values (v_uid, p_racha_id)
    on conflict do nothing;
  else
    delete from public.racha_push_mute pm
    where pm.profile_id = v_uid and pm.racha_id = p_racha_id;
  end if;
end $$;

create function public.get_racha_push_muted(p_racha_id uuid)
returns boolean
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

  return exists (
    select 1 from public.racha_push_mute pm
    where pm.profile_id = v_uid and pm.racha_id = p_racha_id
  );
end $$;

-- O toque no push marca só aquele Aviso; abrir a aba continua marcando todos.
create function public.open_notification(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_notification public.notification;
begin
  if v_uid is null or not exists (select 1 from public.profile p where p.id = v_uid) then
    raise exception 'not_allowed';
  end if;

  select * into v_notification
  from public.notification n
  where n.id = p_id and n.recipient_id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;

  update public.notification n
    set seen_at = now()
    where n.id = p_id
      and n.seen_at is null;

  return jsonb_build_object(
    'kind', v_notification.kind,
    'racha_id', v_notification.racha_id,
    'event_id', v_notification.event_id,
    'target', private.notification_target(v_notification, v_uid)
  );
end $$;

revoke execute on function
  public.register_push_token(text, text),
  public.unregister_push_token(text),
  public.set_racha_push_muted(uuid, boolean),
  public.get_racha_push_muted(uuid),
  public.open_notification(uuid)
  from public, anon;
grant execute on function
  public.register_push_token(text, text),
  public.unregister_push_token(text),
  public.set_racha_push_muted(uuid, boolean),
  public.get_racha_push_muted(uuid),
  public.open_notification(uuid)
  to authenticated;

-- Por instrução: cada chamada a private.notify vira um envio só. O pg_net
-- grava na fila dentro da transação e só envia depois do commit, então
-- rollback não manda push e push falho não desfaz o Aviso.
-- Sem os segredos no Vault (ambiente sem push), o Aviso é gravado e nada sai.
create function private.send_push_for_new_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_items jsonb;
begin
  select s.decrypted_secret into v_url
  from vault.decrypted_secrets s
  where s.name = 'push_function_url';
  select s.decrypted_secret into v_secret
  from vault.decrypted_secrets s
  where s.name = 'push_function_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;

  -- notification segue a linha de get_notifications, para o parseNotifications
  -- do domínio ler sem mudança. O badge já conta os Avisos desta instrução.
  select jsonb_agg(
    jsonb_build_object(
      'token', t.token,
      'badge', b.unseen,
      'notification', jsonb_build_object(
        'id', i.id,
        'kind', i.kind,
        'racha_id', i.racha_id,
        'racha_name', i.racha_name,
        'event_id', i.event_id,
        'actor_name', i.actor_name,
        'payload', i.payload,
        'created_at', i.created_at,
        'is_new', true,
        'resolution', null,
        'target', 'available'
      )
    )
    order by i.created_at, i.id, t.token
  )
  into v_items
  from inserted i
  join public.push_token t on t.profile_id = i.recipient_id
  cross join lateral (
    select count(*)::integer as unseen
    from public.notification n
    where n.recipient_id = i.recipient_id
      and n.seen_at is null
      and n.created_at > now() - interval '60 days'
  ) b
  where not exists (
    select 1 from public.racha_push_mute pm
    where pm.profile_id = i.recipient_id and pm.racha_id = i.racha_id
  );

  if v_items is null then
    return null;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('items', v_items),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    )
  );
  return null;
end $$;

revoke execute on function private.send_push_for_new_notifications()
  from public, anon, authenticated;

create trigger notification_send_push
  after insert on public.notification
  referencing new table as inserted
  for each statement execute function private.send_push_for_new_notifications();
