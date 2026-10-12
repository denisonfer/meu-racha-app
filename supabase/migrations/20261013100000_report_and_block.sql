-- Denúncia e Bloqueio (regra 14.3): denúncia anônima numa tabela que só a equipe lê,
-- bloqueio só do lado de quem bloqueia e filtro de nome do Perfil e do Racha.

-- ============================================================
-- Denúncia
-- ============================================================

create table public.report (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profile (id) on delete cascade,
  target_kind text not null check (target_kind in ('profile', 'racha')),
  -- set null: a denúncia fica para a equipe mesmo se o alvo sumir
  target_profile_id uuid references public.profile (id) on delete set null,
  target_racha_id uuid references public.racha (id) on delete set null,
  reason text not null,
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_target_matches_kind check (
    (target_kind = 'profile' and target_racha_id is null)
    or (target_kind = 'racha' and target_profile_id is null)
  ),
  constraint report_reason_matches_kind check (
    (target_kind = 'profile' and reason in ('photo', 'name', 'harassment', 'spam_scam', 'other'))
    or (target_kind = 'racha' and reason in ('name', 'scam_charge', 'other'))
  )
);

-- Uma aberta por par: a segunda denúncia atualiza a primeira.
create unique index report_one_open_per_target
  on public.report (reporter_id, target_kind, coalesce(target_profile_id, target_racha_id))
  where status = 'open';

-- Sem política: escrita só pela RPC, leitura só pela equipe no Studio.
alter table public.report enable row level security;

create function public.report_content(
  p_kind text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;
  if p_kind = 'profile' then
    if p_target_id = v_uid then
      raise exception 'not_allowed';
    end if;
    if not exists (select 1 from public.profile p where p.id = p_target_id) then
      raise exception 'not_found';
    end if;
  elsif p_kind = 'racha' then
    if not exists (select 1 from public.racha r where r.id = p_target_id) then
      raise exception 'not_found';
    end if;
  else
    raise exception 'invalid_reason';
  end if;
  if not (
    (p_kind = 'profile' and p_reason in ('photo', 'name', 'harassment', 'spam_scam', 'other'))
    or (p_kind = 'racha' and p_reason in ('name', 'scam_charge', 'other'))
  ) then
    raise exception 'invalid_reason';
  end if;

  insert into public.report (reporter_id, target_kind, target_profile_id, target_racha_id, reason, details)
  values (
    v_uid,
    p_kind,
    case when p_kind = 'profile' then p_target_id end,
    case when p_kind = 'racha' then p_target_id end,
    p_reason,
    nullif(btrim(p_details), '')
  )
  on conflict (reporter_id, target_kind, coalesce(target_profile_id, target_racha_id))
    where status = 'open'
  do update set
    reason = excluded.reason,
    details = excluded.details,
    updated_at = now();
end $$;

revoke execute on function public.report_content(text, uuid, text, text) from public, anon;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

-- ============================================================
-- Bloqueio
-- ============================================================

-- Referência a auth.users: apagar a conta anonimiza o Perfil (ele fica) e apaga a
-- conta de login; é aí que as linhas de bloqueio precisam cair.
create table public.profile_block (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint profile_block_not_self check (blocker_id <> blocked_id)
);

create index profile_block_blocked_id on public.profile_block (blocked_id);

alter table public.profile_block enable row level security;

create function private.is_blocked_by_caller(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_block b
    where b.blocker_id = (select auth.uid()) and b.blocked_id = p_profile_id
  );
$$;

revoke execute on function private.is_blocked_by_caller(uuid) from public, anon, authenticated;

create function public.block_profile(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_id = v_uid then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_id) then
    raise exception 'not_found';
  end if;

  insert into public.profile_block (blocker_id, blocked_id)
  values (v_uid, p_id)
  on conflict do nothing;
end $$;

revoke execute on function public.block_profile(uuid) from public, anon;
grant execute on function public.block_profile(uuid) to authenticated;

create function public.unblock_profile(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.profile_block b
  where b.blocker_id = (select auth.uid()) and b.blocked_id = p_id;
$$;

revoke execute on function public.unblock_profile(uuid) from public, anon;
grant execute on function public.unblock_profile(uuid) to authenticated;

create function public.get_blocked_profiles()
returns table (
  profile_id uuid,
  display_name text,
  avatar_path text,
  shared_racha_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.blocked_id,
    p.display_name,
    p.avatar_path,
    (
      select r.name
      from public.member mine
      join public.member theirs
        on theirs.racha_id = mine.racha_id
       and theirs.profile_id = b.blocked_id
       and theirs.is_active
      join public.racha r on r.id = mine.racha_id
      where mine.profile_id = b.blocker_id and mine.is_active
      order by r.name, r.id
      limit 1
    )
  from public.profile_block b
  join public.profile p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc, b.blocked_id;
$$;

revoke execute on function public.get_blocked_profiles() from public, anon;
grant execute on function public.get_blocked_profiles() to authenticated;

-- ============================================================
-- Filtro de nome
-- ============================================================

create extension if not exists unaccent with schema extensions;

-- Sem acento e em minúsculas, como fica o nome depois de normalizado.
-- A lista é revisada pelo dono; palavra ambígua (pau, pinto, rola, pica) fica de fora.
create table private.blocked_word (
  word text primary key check (word ~ '^[a-z]+( [a-z]+)*$')
);

insert into private.blocked_word (word) values
  ('arrombada'), ('arrombado'), ('babaca'), ('baitola'), ('bicha'), ('boceta'),
  ('boiola'), ('boquete'), ('bosta'), ('buceta'), ('cacete'), ('caralho'),
  ('corno'), ('cu'), ('cuzao'), ('cuzinho'), ('escrota'), ('escroto'),
  ('estuprador'), ('estupro'), ('fdp'), ('foda'), ('fodase'), ('foder'),
  ('fodido'), ('hitler'), ('karalho'), ('krl'), ('merda'), ('mongoloide'),
  ('nazi'), ('nazista'), ('otaria'), ('otario'), ('pedofilo'), ('piroca'),
  ('porra'), ('pqp'), ('punheta'), ('punheteiro'), ('puta'), ('putaria'),
  ('putinha'), ('puto'), ('rapariga'), ('retardada'), ('retardado'),
  ('sapatao'), ('tnc'), ('traveco'), ('vadia'), ('vagabunda'), ('viado'),
  ('vsf'), ('vtnc'), ('xereca'), ('xoxota');

-- Palavra inteira: "Cuiabá" passa, "Racha do Cu" não. Acento e troca de letra
-- por número (p0rr4) caem na normalização.
create function private.name_is_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from private.blocked_word w
    where translate(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_name, ''))),
        '43015@',
        'aeoisa'
      ) ~ ('\m' || w.word || '\M')
  );
$$;

revoke execute on function private.name_is_allowed(text) from public, anon, authenticated;

-- O Cadastro confere antes de criar a conta: o erro do gatilho dentro do
-- auth.users chega ao app só como "Database error".
create function public.name_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.name_is_allowed(p_name);
$$;

revoke execute on function public.name_allowed(text) from public;
grant execute on function public.name_allowed(text) to anon, authenticated;

-- tg_argv[0] é a coluna do nome. Só confere nome novo ou trocado: os já gravados
-- continuam salvando o resto da linha.
create function private.check_name_allowed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := to_jsonb(new) ->> tg_argv[0];
begin
  if tg_op = 'UPDATE' and v_name is not distinct from (to_jsonb(old) ->> tg_argv[0]) then
    return new;
  end if;
  -- o nome que o Apagar conta grava
  if v_name = 'Conta apagada' then
    return new;
  end if;
  if not private.name_is_allowed(v_name) then
    raise exception 'name_not_allowed';
  end if;
  return new;
end $$;

revoke execute on function private.check_name_allowed() from public, anon, authenticated;

create trigger racha_name_allowed
  before insert or update of name on public.racha
  for each row execute function private.check_name_allowed('name');

create trigger profile_display_name_allowed
  before insert or update of display_name on public.profile
  for each row execute function private.check_name_allowed('display_name');

-- ============================================================
-- Leituras: is_blocked marca quem quem chama bloqueou. A tela esconde; o resto
-- (posição no Ranking, cartaz da Resenha, Times) continua contando com todos.
-- ============================================================

-- Corpo de 20261003210000_position_detail.sql, mais is_blocked no fim. A lista
-- também serve ao Sorteio, ao Editar membro e ao Passar o racha, que não filtram.
drop function public.list_racha_members(uuid);

create function public.list_racha_members(p_racha_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_path text,
  role public.member_role,
  plays_as public.plays_as,
  primary_position public.position,
  secondary_position public.position,
  stars smallint,
  is_super_star boolean,
  primary_position_detail public.position_detail,
  secondary_position_detail public.position_detail,
  is_blocked boolean
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_racha_member(p_racha_id) then
    raise exception 'not_allowed';
  end if;

  return query
    select m.profile_id, p.display_name, p.avatar_path, m.role, m.plays_as,
      m.primary_position, m.secondary_position, m.stars, m.is_super_star,
      m.primary_position_detail, m.secondary_position_detail,
      private.is_blocked_by_caller(m.profile_id)
    from public.member m
    join public.profile p on p.id = m.profile_id
    where m.racha_id = p_racha_id and m.is_active;
end $$;

revoke execute on function public.list_racha_members(uuid) from public, anon;
grant execute on function public.list_racha_members(uuid) to authenticated;

-- Corpo de 20261008100000_season_ranking.sql, mais is_blocked em cada Membro: o app
-- calcula as posições com todos e só então tira a linha.
create or replace function public.get_season_ranking(p_racha_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.my_racha_role(p_racha_id) is null then
    raise exception 'not_allowed';
  end if;

  return jsonb_build_object(
    'season_year', extract(year from private.racha_season_start(
      p_racha_id, (now() at time zone 'America/Sao_Paulo')::date
    ))::integer,
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'profile_id', c.profile_id,
          'display_name', p.display_name,
          'avatar_path', p.avatar_path,
          'is_active', m.is_active,
          'overall', c.shown_overall,
          'goals', c.line_goals + c.keeper_goals,
          'assists', c.line_assists + c.keeper_assists,
          'wins', c.line_wins + c.keeper_wins,
          'is_blocked', private.is_blocked_by_caller(c.profile_id)
        )
        order by c.profile_id
      )
      from private.racha_member_cards(p_racha_id) c
      join public.member m
        on m.racha_id = p_racha_id and m.profile_id = c.profile_id
      join public.profile p on p.id = c.profile_id
      where c.line_goals + c.keeper_goals <> 0
         or c.line_assists + c.keeper_assists <> 0
         or c.line_wins + c.keeper_wins <> 0
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function public.get_season_ranking(uuid) from public, anon;
grant execute on function public.get_season_ranking(uuid) to authenticated;

-- Corpo de 20261007110000_overall_and_card.sql, mais is_blocked em cada linha de
-- people e de cards. Os destaques e os cartões da tela escondem o bloqueado; o
-- cartaz compartilhado sai com todos.
create or replace function public.get_event_resenha(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_racha public.racha;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  -- Evento aberto, inexistente ou quem não é Membro ativo: o mesmo erro,
  -- para não vazar se o Evento existe.
  if not found
     or v_event.status is distinct from 'finished'
     or public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_allowed';
  end if;

  select * into v_racha from public.racha r where r.id = v_event.racha_id;

  return (
    with finished as (
      select m.id, m.number, m.winner_team_id, m.ended_at
      from public.event_match m
      where m.event_id = p_event_id and m.status = 'finished'
    ),
    roster as (
      select distinct
        coalesce(x.profile_id, x.guest_id) as person_id,
        x.profile_id,
        x.guest_id
      from (
        select g.scorer_profile_id as profile_id, g.scorer_guest_id as guest_id
        from public.event_match_goal g
        join finished f on f.id = g.match_id
        where not g.is_own_goal
          and coalesce(g.scorer_profile_id, g.scorer_guest_id) is not null
        union
        select g.assist_profile_id, g.assist_guest_id
        from public.event_match_goal g
        join finished f on f.id = g.match_id
        where not g.is_own_goal
          and coalesce(g.assist_profile_id, g.assist_guest_id) is not null
        union
        select l.profile_id, l.guest_id
        from public.event_match_lineup l
        join finished f on f.id = l.match_id
        where f.winner_team_id is not null
          and l.team_id = f.winner_team_id
          and l.left_at = f.ended_at
          and not l.left_by_red
        union
        select c.profile_id, c.guest_id
        from public.event_match_card c
        join finished f on f.id = c.match_id
      ) x
    ),
    scored as (
      select
        coalesce(g.scorer_profile_id, g.scorer_guest_id) as person_id,
        g.scorer_profile_id as profile_id,
        count(*)::integer as goals
      from public.event_match_goal g
      join finished f on f.id = g.match_id
      where not g.is_own_goal
        and coalesce(g.scorer_profile_id, g.scorer_guest_id) is not null
      group by 1, 2
    ),
    assisted as (
      select
        coalesce(g.assist_profile_id, g.assist_guest_id) as person_id,
        count(*)::integer as assists
      from public.event_match_goal g
      join finished f on f.id = g.match_id
      where not g.is_own_goal
        and coalesce(g.assist_profile_id, g.assist_guest_id) is not null
      group by 1
    ),
    won as (
      select
        l.person_id,
        count(*)::integer as wins
      from public.event_match_lineup l
      join finished f on f.id = l.match_id
      where f.winner_team_id is not null
        and l.team_id = f.winner_team_id
        and l.left_at = f.ended_at
        and not l.left_by_red
      group by l.person_id
    ),
    people_json as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'person', private.event_match_person_json(r.profile_id, r.guest_id),
          'goals', coalesce(s.goals, 0),
          'assists', coalesce(a.assists, 0),
          'wins', coalesce(w.wins, 0),
          'is_blocked', r.profile_id is not null and private.is_blocked_by_caller(r.profile_id)
        )
        order by private.event_match_person_json(r.profile_id, r.guest_id) ->> 'display_name',
                 r.person_id
      ), '[]'::jsonb) as people
      from roster r
      left join scored s on s.person_id = r.person_id
      left join assisted a on a.person_id = r.person_id
      left join won w on w.person_id = r.person_id
    ),
    teams_json as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'team_number', t.team_number,
          'wins', (
            select count(*)::integer
            from finished f
            where f.winner_team_id = t.id
          )
        )
        order by t.team_number
      ), '[]'::jsonb) as teams
      from public.event_sort_team t
      where t.event_id = p_event_id
    ),
    cards_json as (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'person', private.event_match_person_json(c.profile_id, c.guest_id),
          'color', c.color,
          'match_number', f.number,
          'is_blocked', c.profile_id is not null and private.is_blocked_by_caller(c.profile_id)
        )
        order by c.created_at, c.id
      ), '[]'::jsonb) as cards
      from public.event_match_card c
      join finished f on f.id = c.match_id
    ),
    top as (
      select max(s.goals) as n from scored s
    ),
    top_people as (
      select s.person_id, s.profile_id, s.goals
      from scored s
      join top t on t.n is not null and t.n > 0 and s.goals = t.n
    ),
    scorer_card as (
      select case
        when (select count(*) from top_people) = 1
         and (select tp.profile_id from top_people tp) is not null
        then (
          select jsonb_build_object(
            'display_name', pr.display_name,
            'avatar_path', pr.avatar_path,
            'plays_as', m.plays_as,
            'primary_position', m.primary_position,
            'is_super_star', m.is_super_star
          ) || (
            private.card_body_json(
              c.profile_id,
              c.shown_role,
              c.shown_overall,
              c.line_matches,
              c.line_goals,
              c.line_assists,
              c.line_wins,
              c.keeper_matches,
              c.keeper_wins,
              c.keeper_clean_sheets,
              c.keeper_goals,
              c.season_year,
              c.plays_as,
              c.primary_position
            ) - 'profile_id'
          )
          from public.profile pr
          join public.member m
            on m.profile_id = pr.id and m.racha_id = v_event.racha_id
          join private.racha_member_cards(v_event.racha_id) c
            on c.profile_id = pr.id
          where pr.id = (select tp.profile_id from top_people tp)
        )
      end as scorer_card
    )
    select jsonb_build_object(
      'starts_on', v_event.starts_on,
      'place', v_event.place,
      'racha_name', v_racha.name,
      'match_count', (select count(*)::integer from finished),
      'people', (select p.people from people_json p),
      'teams', (select t.teams from teams_json t),
      'cards', (select c.cards from cards_json c),
      'scorer_card', (select s.scorer_card from scorer_card s)
    )
  );
end $$;

revoke execute on function public.get_event_resenha(uuid) from public, anon;
grant execute on function public.get_event_resenha(uuid) to authenticated;

-- Corpo de 20261008100000_season_ranking.sql. scorers_blocked (na ordem de
-- scorers) só aparece quando quem chama bloqueou um dos artilheiros: para todos
-- os outros o resumo fica igual ao de antes. O person_id no desempate não muda
-- o que sai, porque empate de ordem é empate de nome.
create or replace function private.event_resenha_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    return null;
  end if;

  return (
    with finished as (
      select m.id
      from public.event_match m
      where m.event_id = p_event_id and m.status = 'finished'
    ),
    scored as (
      select
        coalesce(g.scorer_profile_id, g.scorer_guest_id) as person_id,
        min(private.event_match_person_json(g.scorer_profile_id, g.scorer_guest_id)
          ->> 'display_name') as display_name,
        count(*)::integer as goals,
        bool_or(g.scorer_profile_id is not null
          and private.is_blocked_by_caller(g.scorer_profile_id)) as is_blocked
      from public.event_match_goal g
      join finished f on f.id = g.match_id
      where not g.is_own_goal
        and coalesce(g.scorer_profile_id, g.scorer_guest_id) is not null
      group by 1
    ),
    top as (
      select coalesce(max(s.goals), 0) as n from scored s
    )
    select jsonb_build_object(
      'event_id', v_event.id,
      'starts_on', v_event.starts_on,
      'place', v_event.place,
      'match_count', (select count(*)::integer from finished),
      'scorers', coalesce((
        select jsonb_agg(s.display_name order by s.display_name, s.person_id)
        from scored s
        join top t on t.n > 0 and s.goals = t.n
      ), '[]'::jsonb),
      'top_goals', (select t.n from top t)
    ) || coalesce((
      select case when bool_or(s.is_blocked) then jsonb_build_object(
        'scorers_blocked', jsonb_agg(s.is_blocked order by s.display_name, s.person_id)
      ) end
      from scored s
      join top t on t.n > 0 and s.goals = t.n
    ), '{}'::jsonb)
  );
end $$;
