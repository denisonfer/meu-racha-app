-- Leitura do Pagar. O Crédito e o "pago" seguem list_event_attendance
-- (20261003210000_position_detail.sql) e set_attendance_paid
-- (20261003170000_event_sort_after.sql): "A pagar" é o que o "pagou" vai descontar.

drop function if exists public.get_payment(uuid);

create function public.get_payment(p_event_id uuid)
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
      case when v_event.is_paid then v_event.pix_key end,
      case when v_event.is_paid then v_event.pix_key_type end
    from (select 1) one
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = v_uid;
end $$;

revoke execute on function public.get_payment(uuid) from public, anon;
grant execute on function public.get_payment(uuid) to authenticated;
