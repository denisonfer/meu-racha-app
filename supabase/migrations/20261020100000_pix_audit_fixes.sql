-- Auditoria de 19/10: Evento finalizado guardava a chave do Dono antigo e o Pagar a
-- devolvia com o nome do Dono atual; e-mail com dois "@" passava como chave.

-- "@" fica fora das partes: o e-mail da chave tem um só.
create or replace function private.normalize_pix_key(p_raw text, out key text, out type text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := regexp_replace(coalesce(p_raw, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_lower text := lower(v_text);
  v_digits text;
  v_national text;
begin
  if v_text = '' then
    raise exception 'invalid_pix_key';
  end if;

  if strpos(v_text, '@') > 0 then
    if char_length(v_lower) <= 77 and v_lower ~ '^[!-?A-~]+@[!-?A-~]+\.[!-?A-~]+$' then
      key := v_lower;
      type := 'email';
      return;
    end if;
    raise exception 'invalid_pix_key';
  end if;

  if v_lower ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    key := v_lower;
    type := 'random';
    return;
  end if;

  if v_text !~ '^[0-9[:space:]().+/-]+$' then
    raise exception 'invalid_pix_key';
  end if;
  v_digits := regexp_replace(v_text, '[^0-9]', '', 'g');

  -- Com +55 ou máscara de telefone a intenção é celular, mesmo que os dígitos formem um CPF.
  if left(v_text, 1) = '+' then
    v_national := case when left(v_digits, 2) = '55' then substr(v_digits, 3) end;
  elsif v_text ~ '[()[:space:]]' and char_length(v_digits) = 11 then
    v_national := v_digits;
  elsif v_digits ~ '^[0-9]{11}$' and v_digits !~ '^([0-9])\1+$'
    and private.pix_check_digits_ok(v_digits, '{11,10,9,8,7,6,5,4,3,2}') then
    key := v_digits;
    type := 'cpf';
    return;
  elsif v_digits ~ '^[0-9]{14}$' and v_digits !~ '^([0-9])\1+$'
    and private.pix_check_digits_ok(v_digits, '{6,5,4,3,2,9,8,7,6,5,4,3,2}') then
    key := v_digits;
    type := 'cnpj';
    return;
  elsif v_text ~ '^[0-9]{11}$' then
    v_national := v_digits;
  end if;

  if v_national ~ '^[1-9]{2}9[0-9]{8}$' then
    key := '+55' || v_national;
    type := 'phone';
    return;
  end if;
  raise exception 'invalid_pix_key';
end $$;

-- A Passagem tira a chave de todos os Eventos, também dos finalizados: a chave é sempre
-- do Dono atual e a do antigo não fica guardada.
create or replace function public.transfer_ownership(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target public.member%rowtype;
begin
  perform 1 from public.racha r where r.id = p_racha_id for update;

  if public.my_racha_role(p_racha_id) is distinct from 'OWNER' or p_profile_id = v_uid then
    raise exception 'not_allowed';
  end if;

  perform pg_advisory_xact_lock(hashtext('create_racha:' || p_profile_id::text));

  select * into v_target from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
    for update;
  if not found then
    raise exception 'not_member';
  end if;

  if exists (
    select 1 from public.member m
    where m.profile_id = p_profile_id and m.role = 'OWNER' and m.is_active
  ) then
    raise exception 'plan_owner_limit';
  end if;

  update public.member m set role = 'ADMIN'
    where m.racha_id = p_racha_id and m.profile_id = v_uid;
  update public.member m set role = 'OWNER' where m.id = v_target.id;

  update public.event e
    set conductor_id = p_profile_id
    where e.racha_id = p_racha_id
      and e.status in ('upcoming', 'active')
      and e.conductor_id = v_uid;

  delete from private.racha_pix_key k where k.racha_id = p_racha_id;
  update public.event e
    set pix_key = null, pix_key_type = null
    where e.racha_id = p_racha_id
      and e.pix_key is not null;

  delete from public.racha_notice n
    where n.profile_id = (select auth.uid())
      and n.racha_id = p_racha_id
      and n.kind = 'OWNERSHIP_RECEIVED';

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select p_profile_id, r.id, r.name, 'OWNERSHIP_RECEIVED'
    from public.racha r where r.id = p_racha_id;

  perform private.notify(
    array[p_profile_id],
    'ownership_transferred',
    p_racha_id,
    null,
    null,
    '{}'::jsonb
  );
end $$;

-- Evento finalizado não tem mais o que pagar pelo QR.
create or replace function public.get_payment(p_event_id uuid)
returns table (
  daily_price integer,
  credit_available integer,
  credit_balance integer,
  amount_due integer,
  is_paid boolean,
  is_waitlisted boolean,
  is_owner boolean,
  recipient_name text,
  pix_key text,
  pix_key_type text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.event%rowtype;
  v_status public.attendance_status;
  v_daily integer;
  v_credit integer;
  v_balance integer;
begin
  select * into v_event from public.event e where e.id = p_event_id;

  select ea.status into v_status from public.event_attendance ea
    where ea.event_id = p_event_id
      and ea.profile_id = v_uid
      and ea.status in ('confirmed', 'waitlisted');

  if v_status is null or public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_in_event';
  end if;

  -- Evento grátis tem price nulo, e least() ignora nulo: sem o coalesce o Crédito viraria o saldo.
  v_daily := case when v_event.is_paid then coalesce(v_event.price, 0) else 0 end;
  v_balance := private.credit_balance(v_event.racha_id, v_uid);
  v_credit := least(v_balance, v_daily);

  return query
    select
      v_daily,
      v_credit,
      v_balance,
      v_daily - v_credit,
      (
        private.member_has_event_monthly_pass(p_event_id, v_uid)
        or coalesce(f.paid_marked_at is not null, false)
        or coalesce(f.monthly_coverage_month
          = private.event_civil_year_month(v_event.starts_on, v_event.starts_at), false)
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false)
      ),
      v_status = 'waitlisted',
      public.my_racha_role(v_event.racha_id) = 'OWNER',
      (select p.display_name from public.member m
       join public.profile p on p.id = m.profile_id
       where m.racha_id = v_event.racha_id and m.role = 'OWNER' and m.is_active),
      case when v_event.is_paid and v_event.status <> 'finished' then v_event.pix_key end,
      case when v_event.is_paid and v_event.status <> 'finished' then v_event.pix_key_type end
    from (select 1) one
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = v_uid;
end $$;
