-- Configurações do app: o silêncio por Racha sai e entra uma chave de push da
-- conta. Vale em todos os aparelhos; a aba Avisos continua recebendo tudo.

alter table public.profile
  add column push_enabled boolean not null default true;

create function public.set_push_enabled(p_enabled boolean)
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

  update public.profile set push_enabled = p_enabled where id = v_uid;
end $$;

revoke execute on function public.set_push_enabled(boolean) from public, anon;
grant execute on function public.set_push_enabled(boolean) to authenticated;

-- Veio de 20261010100000; muda só o filtro, que passa a ser a chave do destinatário.
create or replace function private.send_push_for_new_notifications()
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
  join public.profile pr on pr.id = i.recipient_id and pr.push_enabled
  join public.push_token t on t.profile_id = i.recipient_id
  cross join lateral (
    select count(*)::integer as unseen
    from public.notification n
    where n.recipient_id = i.recipient_id
      and n.seen_at is null
      and n.created_at > now() - interval '60 days'
  ) b;

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

drop function public.set_racha_push_muted(uuid, boolean);
drop function public.get_racha_push_muted(uuid);
drop table public.racha_push_mute;
