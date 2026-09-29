-- Racha, Temporada e Membro (regras 3.1–3.4, modelo de dados § 2).
-- Nada se grava direto: criar é a função create_racha, tudo ou nada.

create type public.game_mode as enum ('WINNER_STAYS', 'ROTATION', 'MAX_WINS');
create type public.tie_rule as enum ('BOTH_OUT', 'BOTH_STAY', 'PENALTIES', 'CHALLENGER_WINS');
create type public.tie_return_order as enum ('RANDOM', 'TEAM_ORDER');
create type public.member_role as enum ('OWNER', 'ADMIN', 'PLAYER');

create table public.racha (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  outfield_per_team smallint not null default 5,
  game_mode public.game_mode not null default 'WINNER_STAYS',
  max_consecutive_wins smallint not null default 2,
  tie_rule public.tie_rule not null default 'BOTH_OUT',
  tie_return_order public.tie_return_order not null default 'RANDOM',
  consider_position boolean not null default false,
  match_duration_min smallint default 10, -- null = sem relógio
  created_at timestamptz not null default now(),

  constraint racha_name_is_reasonable check (
    char_length(name) between 2 and 40
    and name ~ '^[[:alpha:]][[:alpha:]0-9 ''.-]*$'
  ),
  constraint outfield_per_team_range check (outfield_per_team between 3 and 10),
  constraint max_consecutive_wins_range check (max_consecutive_wins between 2 and 10),
  constraint match_duration_range check (match_duration_min is null or match_duration_min between 1 and 90),
  constraint invite_code_format check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$')
);

create table public.season (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.racha (id) on delete cascade,
  number smallint not null,
  starts_on date not null,
  ends_on date not null,
  closed boolean not null default false,
  unique (racha_id, number)
);

create table public.member (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.racha (id) on delete cascade,
  profile_id uuid not null references public.profile (id),
  role public.member_role not null,
  is_active boolean not null default true,
  plays_as public.plays_as not null,
  primary_position public.position,
  secondary_position public.position,
  joined_at timestamptz not null default now(),
  unique (racha_id, profile_id),
  constraint member_position_matches_plays_as check (
    case plays_as
      when 'GOALKEEPER' then primary_position is null and secondary_position is null
      when 'OUTFIELD' then
        primary_position is not null
        and case
          when primary_position = 'ANY' then secondary_position is null
          else secondary_position is not null
               and secondary_position <> 'ANY'
               and secondary_position <> primary_position
        end
    end
  )
);


create function public.is_racha_member(p_racha_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.member
    where racha_id = p_racha_id
      and profile_id = (select auth.uid())
      and is_active
  );
$$;

revoke execute on function public.is_racha_member(uuid) from public, anon;
grant execute on function public.is_racha_member(uuid) to authenticated;

alter table public.racha enable row level security;
alter table public.season enable row level security;
alter table public.member enable row level security;

create policy "racha: Membro lê" on public.racha for select
  to authenticated using (public.is_racha_member(id));
create policy "season: Membro lê" on public.season for select
  to authenticated using (public.is_racha_member(racha_id));
create policy "member: Membro lê os do mesmo Racha" on public.member for select
  to authenticated using (public.is_racha_member(racha_id));


revoke insert, update, delete on public.racha, public.season, public.member from anon, authenticated;

create function public.create_racha(
  p_name text,
  p_outfield_per_team smallint,
  p_game_mode public.game_mode,
  p_max_consecutive_wins smallint,
  p_tie_rule public.tie_rule,
  p_tie_return_order public.tie_return_order,
  p_consider_position boolean,

  p_match_duration_min smallint default null
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
    tie_rule, tie_return_order, consider_position, match_duration_min
  ) values (
    trim(p_name), v_code, p_outfield_per_team, p_game_mode, p_max_consecutive_wins,
    p_tie_rule, p_tie_return_order, p_consider_position, p_match_duration_min
  ) returning racha.id into v_racha_id;

  insert into public.season (racha_id, number, starts_on, ends_on)
  values (v_racha_id, 1, current_date, (current_date + interval '1 year')::date);

  insert into public.member (
    racha_id, profile_id, role, plays_as, primary_position, secondary_position
  ) values (
    v_racha_id, v_uid, 'OWNER', v_profile.plays_as,
    v_profile.primary_position, v_profile.secondary_position
  );

  return query select v_racha_id, v_code;
end $$;

revoke execute on function public.create_racha(text, smallint, public.game_mode, smallint, public.tie_rule, public.tie_return_order, boolean, smallint) from public, anon;
grant execute on function public.create_racha(text, smallint, public.game_mode, smallint, public.tie_rule, public.tie_return_order, boolean, smallint) to authenticated;
