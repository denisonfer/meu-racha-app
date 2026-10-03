-- Avulso é adicionado por quem está na quadra: já nasce com `veio`, senão o Sorteio (que só
-- considera quem veio) o ignoraria até o Dono/Admin lembrar de marcá-lo.
create or replace function public.add_guest(
  p_event_id uuid,
  p_display_name text,
  p_plays_as public.plays_as,
  p_primary_position public."position",
  p_secondary_position public."position",
  p_stars smallint,
  p_is_super_star boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_guest_id uuid;
  v_stars smallint;
  v_super boolean;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_open_attendance_event(v_event);

  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;
  -- depois do Sorteio, Avulso novo só entra por Inclusão
  perform private.assert_no_confirmed_sort(p_event_id);

  perform private.promote_waitlist_for_event(p_event_id);

  if private.event_has_waitlist(p_event_id) then
    raise exception 'spot_limit';
  end if;

  if v_event.spot_limit is not null
     and private.event_occupancy(p_event_id) >= v_event.spot_limit then
    raise exception 'spot_limit';
  end if;

  if p_plays_as = 'GOALKEEPER' then
    v_stars := null;
    v_super := false;
  else
    v_stars := p_stars;
    v_super := coalesce(p_is_super_star, false);
  end if;

  insert into public.event_guest (
    event_id, display_name, plays_as, primary_position, secondary_position, stars, is_super_star,
    did_attend
  ) values (
    p_event_id, btrim(p_display_name), p_plays_as, p_primary_position, p_secondary_position,
    v_stars, v_super, true
  ) returning id into v_guest_id;

  return v_guest_id;
end $$;
