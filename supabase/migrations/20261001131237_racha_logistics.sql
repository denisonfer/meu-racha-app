-- Fatia 5a: local, dia/horário, pago, vagas e lembrete no Racha (regras 6.1,
-- 7.0–7.3, 7.5). Idade mínima e logística saem do update direto do Dono.

alter table public.racha
  add column place text,
  add column weekday smallint,
  add column kickoff_time time,
  add column is_paid boolean not null default false,
  add column price integer,
  add column monthly_price integer,
  add column spot_limit smallint,
  add column reminder_lead_hours smallint not null default 24;

update public.racha set place = 'A definir' where place is null;
alter table public.racha alter column place set not null;

alter table public.racha
  add constraint place_text check (
    char_length(place) between 1 and 120 and place = btrim(place)
  ),
  add constraint weekday_range check (weekday is null or weekday between 1 and 7),
  add constraint fixed_slot_both_or_neither check (
    (weekday is null) = (kickoff_time is null)
  ),
  add constraint price_range check (price is null or price between 1 and 9999),
  add constraint monthly_price_range check (
    monthly_price is null or monthly_price between 1 and 9999
  ),
  add constraint price_required_when_paid check (not is_paid or price is not null),
  add constraint spot_limit_fits_two_teams check (
    spot_limit is null or spot_limit >= 2 * outfield_per_team
  ),
  add constraint reminder_lead_hours_range check (reminder_lead_hours >= 1);

revoke update (min_age) on public.racha from authenticated;

drop function public.create_racha(
  text, smallint, public.game_mode, smallint,
  public.tie_rule, public.tie_return_order, boolean, smallint, smallint
);

create function public.create_racha(
  p_name text,
  p_outfield_per_team smallint,
  p_game_mode public.game_mode,
  p_max_consecutive_wins smallint,
  p_tie_rule public.tie_rule,
  p_tie_return_order public.tie_return_order,
  p_consider_position boolean,
  p_place text,
  p_match_duration_min smallint default null,
  p_min_age smallint default null
)
returns table (id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profile%rowtype;
  v_racha_id uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext('create_racha:' || v_uid::text));

  if exists (
    select 1 from public.member
    where profile_id = v_uid and role = 'OWNER' and is_active
  ) then
    raise exception 'plan_owner_limit';
  end if;

  select * into v_profile from public.profile where profile.id = v_uid;

  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.racha r where r.invite_code = v_code);
  end loop;

  insert into public.racha (
    name, invite_code, outfield_per_team, game_mode, max_consecutive_wins,
    tie_rule, tie_return_order, consider_position, match_duration_min, min_age,
    place
  ) values (
    trim(p_name), v_code, p_outfield_per_team, p_game_mode, p_max_consecutive_wins,
    p_tie_rule, p_tie_return_order, p_consider_position, p_match_duration_min, p_min_age,
    btrim(p_place)
  ) returning racha.id into v_racha_id;

  insert into public.season (racha_id, number, starts_on, ends_on)
  values (v_racha_id, 1, current_date, (current_date + interval '1 year')::date);

  insert into public.member (
    racha_id, profile_id, role, plays_as, primary_position, secondary_position, stars
  ) values (
    v_racha_id, v_uid, 'OWNER', v_profile.plays_as,
    v_profile.primary_position, v_profile.secondary_position,
    case when v_profile.plays_as = 'OUTFIELD' then 3 end
  );

  return query select v_racha_id, v_code;
end $$;

revoke execute on function public.create_racha(
  text, smallint, public.game_mode, smallint,
  public.tie_rule, public.tie_return_order, boolean, text, smallint, smallint
) from public, anon;
grant execute on function public.create_racha(
  text, smallint, public.game_mode, smallint,
  public.tie_rule, public.tie_return_order, boolean, text, smallint, smallint
) to authenticated;

-- Dono e Admin gravam logística; Jogador e quem não é Membro recebem not_allowed
create function public.update_racha_logistics(
  p_racha_id uuid,
  p_place text,
  p_weekday smallint,
  p_kickoff_time time,
  p_min_age smallint,
  p_is_paid boolean,
  p_price integer,
  p_monthly_price integer,
  p_spot_limit smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.my_racha_role(p_racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  update public.racha r set
    place = btrim(p_place),
    weekday = p_weekday,
    kickoff_time = p_kickoff_time,
    min_age = p_min_age,
    is_paid = p_is_paid,
    price = p_price,
    monthly_price = p_monthly_price,
    spot_limit = p_spot_limit
  where r.id = p_racha_id;
end $$;

revoke execute on function public.update_racha_logistics(
  uuid, text, smallint, time, smallint, boolean, integer, integer, smallint
) from public, anon;
grant execute on function public.update_racha_logistics(
  uuid, text, smallint, time, smallint, boolean, integer, integer, smallint
) to authenticated;
