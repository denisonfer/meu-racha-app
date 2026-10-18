-- Confirmação de e-mail por código (OTP): o app chama confirm_email_verified() logo
-- depois do verify. O banco só confia no amr do JWT, que o Auth assina: sessão aberta
-- por senha não confirma, e o código precisa ter sido usado há no máximo 10 minutos.

alter table public.profile add column email_verified_at timestamptz;

create function public.confirm_email_verified()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select private.current_profile_id());
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;

  -- amr é array de objetos {method, timestamp}; entrada de outro formato não conta.
  if not exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof((select auth.jwt()) -> 'amr') = 'array'
        then (select auth.jwt()) -> 'amr' else '[]'::jsonb end
    ) a
    where jsonb_typeof(a) = 'object'
      and a ->> 'method' = 'otp'
      and a ->> 'timestamp' ~ '^[0-9]{1,12}$'
      and to_timestamp((a ->> 'timestamp')::bigint) >= now() - interval '10 minutes'
  ) then
    raise exception 'email_not_verified';
  end if;

  update public.profile
    set email_verified_at = coalesce(email_verified_at, now())
    where id = v_uid
    returning email_verified_at into v_at;

  return v_at;
end $$;

revoke execute on function public.confirm_email_verified() from public, anon;
grant execute on function public.confirm_email_verified() to authenticated;
