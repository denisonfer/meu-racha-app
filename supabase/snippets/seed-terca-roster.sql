-- Elenco do Racha de terca (dev local). Não é migration.
-- Login de todo mundo: {slug}@racha.local / senha-forte

begin;

create temporary table roster (
  slug text primary key,
  display_name text not null,
  is_owner boolean not null default false,
  plays_as public.plays_as not null,
  pos1 text,
  pos2 text,
  stars smallint,
  is_super boolean not null default false
);

insert into roster (slug, display_name, is_owner, plays_as, pos1, pos2, stars, is_super) values
  ('magno',           'Magno',           false, 'GOALKEEPER', null,  null,  null, false),
  ('fernando',        'Fernando',        false, 'GOALKEEPER', null,  null,  null, false),
  ('fran',            'Fran',            false, 'OUTFIELD',   'ZAG', 'LAT', 3,    false),
  ('darley',          'Darley',          false, 'OUTFIELD',   'ZAG', 'VOL', 3,    false),
  ('brenno',          'Brenno',          false, 'OUTFIELD',   'ZAG', 'VOL', 3,    false),
  ('menague',         'Menague',         false, 'OUTFIELD',   'ZAG', 'VOL', 3,    false),
  ('genilson',        'Genilson',        false, 'OUTFIELD',   'ZAG', 'VOL', 3,    false),
  ('bruno',           'Bruno',           false, 'OUTFIELD',   'ZAG', 'LAT', 3,    false),
  ('flavio',          'Flávio',          false, 'OUTFIELD',   'LAT', 'ZAG', 3,    false),
  ('leo',             'Léo',             false, 'OUTFIELD',   'LAT', 'ATA', 3,    false),
  ('jecivaldo',       'Gessivaldo',      false, 'OUTFIELD',   'LAT', 'VOL', 3,    false),
  ('willami',         'Willami',         false, 'OUTFIELD',   'LAT', 'VOL', 3,    false),
  ('laercio',         'Laércio',         false, 'OUTFIELD',   'LAT', 'VOL', 3,    false),
  ('italo',           'Italo',           false, 'OUTFIELD',   'LAT', 'VOL', 3,    false),
  ('douglas',         'Douglas',         false, 'OUTFIELD',   'VOL', 'MEI', 3,    false),
  ('mauricio',        'Maurício',        false, 'OUTFIELD',   'VOL', 'MEI', 3,    true),
  ('jardson',         'Jardson',         false, 'OUTFIELD',   'VOL', 'MEI', 3,    false),
  ('savio',           'Sávio',           false, 'OUTFIELD',   'VOL', 'MEI', 3,    false),
  ('carlin',          'Carlin',          false, 'OUTFIELD',   'VOL', 'MEI', 3,    false),
  ('lailson',         'Lailson',         false, 'OUTFIELD',   'VOL', 'MEI', 3,    false),
  ('cesinha',         'Cesinha',         false, 'OUTFIELD',   'MEI', 'ATA', 3,    true),
  ('leonardo',        'Leonardo',        false, 'OUTFIELD',   'MEI', 'VOL', 3,    true),
  ('brendo',          'Brendo',          false, 'OUTFIELD',   'MEI', 'ATA', 3,    true),
  ('superman',        'Superman',        true,  'OUTFIELD',   'ATA', 'LAT', 3,    false),
  ('paulo.robson',    'Paulo Robson',    false, 'OUTFIELD',   'ATA', 'MEI', 3,    false),
  ('anderson',        'Anderson',        false, 'OUTFIELD',   'ATA', 'MEI', 3,    false),
  ('fernandinho',     'Fernandinho',     false, 'OUTFIELD',   'ATA', 'MEI', 3,    false),
  ('rodrigo',         'Rodrigo',         false, 'OUTFIELD',   'ATA', 'MEI', 3,    false),
  ('dom',             'Dom',             false, 'OUTFIELD',   'ATA', 'MEI', 3,    false),
  ('davidson',        'Davidson',        false, 'OUTFIELD',   'ATA', 'MEI', 3,    false),
  ('daniel',          'Daniel',          false, 'OUTFIELD',   'ATA', 'MEI', 3,    false),
  ('adailson',        'Adailson',        false, 'OUTFIELD',   'ATA', 'MEI', 3,    false);

-- Zona ampla + subdivisão. Par da mesma zona (VOL/MEI, ZAG/LAT) não cabe
-- no check do Membro: a secundária vira a zona vizinha.
create function pg_temp.zone_of(p text)
returns public.position
language sql immutable as $$
  select case p
    when 'ZAG' then 'DEFENDER'::public.position
    when 'LAT' then 'DEFENDER'::public.position
    when 'VOL' then 'MIDFIELDER'::public.position
    when 'MEI' then 'MIDFIELDER'::public.position
    when 'ATA' then 'FORWARD'::public.position
  end;
$$;

create function pg_temp.detail_of(p text)
returns public.position_detail
language sql immutable as $$
  select case p
    when 'ZAG' then 'CENTER_BACK'::public.position_detail
    when 'LAT' then 'FULL_BACK'::public.position_detail
    when 'VOL' then 'DEFENSIVE_MID'::public.position_detail
    when 'MEI' then 'ATTACKING_MID'::public.position_detail
  end;
$$;

create function pg_temp.neighbor_zone(p text)
returns public.position
language sql immutable as $$
  select case p
    when 'ZAG' then 'MIDFIELDER'::public.position
    when 'LAT' then 'MIDFIELDER'::public.position
    when 'VOL' then 'FORWARD'::public.position
    when 'MEI' then 'DEFENDER'::public.position
  end;
$$;

create temporary table mapped as
select
  r.*,
  pg_temp.zone_of(r.pos1) as primary_position,
  case
    when r.plays_as = 'GOALKEEPER' then null
    when pg_temp.zone_of(r.pos1) = pg_temp.zone_of(r.pos2) then pg_temp.neighbor_zone(r.pos1)
    else pg_temp.zone_of(r.pos2)
  end as secondary_position,
  pg_temp.detail_of(r.pos1) as primary_position_detail,
  case
    when pg_temp.zone_of(r.pos1) = pg_temp.zone_of(r.pos2) then null
    else pg_temp.detail_of(r.pos2)
  end as secondary_position_detail
from roster r;

create temporary table created (
  slug text primary key,
  profile_id uuid not null
);

do $$
declare
  rec record;
  v_id uuid;
  v_email text;
  v_meta jsonb;
begin
  for rec in select * from mapped loop
    v_id := gen_random_uuid();
    v_email := rec.slug || '@racha.local';
    v_meta := jsonb_build_object(
      'display_name', rec.display_name,
      'birth_date', '1990-01-01',
      'plays_as', rec.plays_as::text,
      'primary_position', rec.primary_position,
      'secondary_position', rec.secondary_position,
      'terms_accepted', true
    );

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id, 'authenticated', 'authenticated', v_email,
      crypt('senha-forte', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email),
      'email', now(), now(), now()
    );

    insert into created (slug, profile_id) values (rec.slug, v_id);
  end loop;
end $$;

do $$
declare
  v_racha uuid;
  v_event uuid;
  v_starts date;
begin
  insert into public.racha (
    name, invite_code, place, weekday, kickoff_time,
    outfield_per_team, consider_position, min_age,
    tie_rule, match_duration_min, yellow_card_mode
  ) values (
    'Racha de terca', 'TERCA2', 'Quadra', 2, '20:00',
    10, true, 16,
    'CHALLENGER_WINS', 20, 'mark'
  ) returning id into v_racha;

  insert into public.season (racha_id, number, starts_on, ends_on)
  values (v_racha, 1, current_date, (current_date + interval '1 year')::date);

  insert into public.member (
    racha_id, profile_id, role, plays_as,
    primary_position, secondary_position,
    primary_position_detail, secondary_position_detail,
    stars, is_super_star
  )
  select
    v_racha, c.profile_id,
    case when m.is_owner then 'OWNER'::public.member_role else 'PLAYER'::public.member_role end,
    m.plays_as, m.primary_position, m.secondary_position,
    m.primary_position_detail, m.secondary_position_detail,
    m.stars, m.is_super
  from mapped m
  join created c on c.slug = m.slug;

  v_starts := current_date + ((9 - extract(isodow from current_date)::int) % 7);
  if v_starts = current_date
     and (now() at time zone 'America/Sao_Paulo')::time >= time '20:00' then
    v_starts := v_starts + 7;
  end if;

  insert into public.event (
    racha_id, starts_on, starts_at, place, is_paid,
    reminder_lead_hours, outfield_per_team, game_mode,
    max_consecutive_wins, tie_rule, tie_return_order,
    consider_position, match_duration_min, yellow_card_mode
  ) values (
    v_racha, v_starts, '20:00', 'Quadra', false,
    24, 10, 'WINNER_STAYS',
    2, 'CHALLENGER_WINS', 'RANDOM',
    true, 20, 'mark'
  ) returning id into v_event;

  insert into public.event_attendance (event_id, profile_id, status)
  select v_event, c.profile_id, 'confirmed'
  from created c;
end $$;

do $$
declare
  v_members int;
  v_confirmed int;
begin
  select count(*) into v_members from public.member m
    join public.racha r on r.id = m.racha_id
    where r.name = 'Racha de terca';
  select count(*) into v_confirmed from public.event_attendance ea
    join public.event e on e.id = ea.event_id
    join public.racha r on r.id = e.racha_id
    where r.name = 'Racha de terca' and ea.status = 'confirmed';
  if v_members <> 32 or v_confirmed <> 32 then
    raise exception 'seed falhou: membros=% confirmados=%', v_members, v_confirmed;
  end if;
  raise notice 'OK: 32 membros, 32 confirmados';
end $$;

commit;
