-- Overall e Card, calculados na leitura. Nada fica guardado: a carta muda
-- quando o Evento encerra porque só Partida finished de Evento finished entra.
-- A fórmula é a das regras: rodagem 40, Vitória ÷ (Partidas + 40) e mínimo
-- de 3 Partidas por papel.

-- 29/02 não existe no ano comum: o aniversário cai em 28/02, senão a
-- Temporada pularia um dia e a Partida da véspera mudaria de ano.
create function private.anniversary_date(p_year integer, p_month integer, p_day integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_month = 2 and p_day = 29
      and not ((p_year % 4 = 0 and p_year % 100 <> 0) or (p_year % 400 = 0))
      then make_date(p_year, 2, 28)
    else make_date(p_year, p_month, p_day)
  end;
$$;

-- Último aniversário de criação do Racha que já chegou em p_on, no fuso de
-- Brasília. A data de created_at é a de São Paulo, não a do relógio UTC.
create function private.racha_season_start(p_racha_id uuid, p_on date)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_born date;
  v_month integer;
  v_day integer;
  v_year integer;
  v_anniv date;
begin
  select (r.created_at at time zone 'America/Sao_Paulo')::date
    into v_born
  from public.racha r
  where r.id = p_racha_id;

  if v_born is null or p_on is null then
    return null;
  end if;

  v_month := extract(month from v_born)::integer;
  v_day := extract(day from v_born)::integer;
  v_year := extract(year from p_on)::integer;
  v_anniv := private.anniversary_date(v_year, v_month, v_day);
  if v_anniv > p_on then
    v_anniv := private.anniversary_date(v_year - 1, v_month, v_day);
  end if;
  return v_anniv;
end $$;

-- Rodagem 40 no divisor, Vitória no mesmo divisor (não como taxa). Abaixo de
-- 3 Partidas o Card mostra 40: os números reais continuam fora daqui.
-- numeric, não float: o round do float do Postgres é o do banqueiro.
create function private.line_overall(
  p_matches integer,
  p_goals integer,
  p_assists integer,
  p_wins integer,
  p_avg_goals numeric,
  p_avg_assists numeric
) returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_matches < 3 then 40
    else greatest(40, least(99, round(
      40 + 59 * greatest(0::numeric, least(1::numeric, (
        (
          0.45 * least(
            case when p_avg_goals > 0
              then p_goals::numeric / (p_matches + 40) / p_avg_goals
              else 0::numeric
            end,
            2::numeric
          ) / 2
          + 0.20 * least(
            case when p_avg_assists > 0
              then p_assists::numeric / (p_matches + 40) / p_avg_assists
              else 0::numeric
            end,
            2::numeric
          ) / 2
          + 0.35 * (p_wins::numeric / (p_matches + 40))
        ) - 0.10
      ) / 0.45))
    )::integer))
  end;
$$;

-- Média zero (racha sem gol na Temporada) não tem com o que comparar: 40.
-- A rodagem entra como 1,6 vez a média, o piso do goleiro.
create function private.keeper_overall(
  p_matches integer,
  p_conceded integer,
  p_avg_conceded numeric
) returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_matches < 3 or p_avg_conceded <= 0 then 40
    else greatest(40, least(99, round(
      40 + 59 * greatest(0::numeric, least(1::numeric, (
        1.6 - (
          (p_conceded::numeric + 40 * 1.6 * p_avg_conceded)
          / (p_matches + 40)
          / p_avg_conceded
        )
      ) / 0.9))
    )::integer))
  end;
$$;

-- O contrato da carta que o app lê. conceded fica de fora:
-- entra na fórmula e não na carta. plays_as e primary_position são do
-- Membro naquele Racha: a sigla da linha não pode sair do Cadastro.
create function private.card_body_json(
  p_profile_id uuid,
  p_shown_role text,
  p_overall integer,
  p_line_matches integer,
  p_line_goals integer,
  p_line_assists integer,
  p_line_wins integer,
  p_keeper_matches integer,
  p_keeper_wins integer,
  p_keeper_clean_sheets integer,
  p_keeper_goals integer,
  p_season_year integer,
  p_plays_as text,
  p_primary_position text
) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_id', p_profile_id,
    'shown_role', p_shown_role,
    'overall', p_overall,
    'line', jsonb_build_object(
      'matches', p_line_matches,
      'goals', p_line_goals,
      'assists', p_line_assists,
      'wins', p_line_wins
    ),
    'keeper', jsonb_build_object(
      'matches', p_keeper_matches,
      'wins', p_keeper_wins,
      'clean_sheets', p_keeper_clean_sheets,
      'goals', p_keeper_goals
    ),
    'season_year', p_season_year,
    'plays_as', p_plays_as,
    'primary_position', p_primary_position
  );
$$;

-- Temporada corrente (hoje em Brasília), cada Membro do Racha, ativo ou não.
-- Avulso não é Membro e não entra. O papel mostrado é o de mais Partidas;
-- empate fica na linha; sem Partida, o Onde joga (OUTFIELD → LINE).
create or replace function private.racha_member_cards(p_racha_id uuid)
returns table (
  profile_id uuid,
  line_matches integer,
  line_goals integer,
  line_assists integer,
  line_wins integer,
  keeper_matches integer,
  keeper_wins integer,
  keeper_clean_sheets integer,
  keeper_conceded integer,
  keeper_goals integer,
  line_overall integer,
  keeper_overall integer,
  shown_role text,
  shown_overall integer,
  season_year integer,
  plays_as text,
  primary_position text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_season date := private.racha_season_start(p_racha_id, v_today);
  v_year integer := extract(year from v_season)::integer;
begin
  return query
  with season as (
    select m.id, m.ended_at, m.winner_team_id
    from public.event_match m
    join public.event e on e.id = m.event_id
    where e.racha_id = p_racha_id
      and e.status = 'finished'
      and m.status = 'finished'
      and private.racha_season_start(
        p_racha_id,
        (m.started_at at time zone 'America/Sao_Paulo')::date
      ) = v_season
  ),
  -- Sair e voltar grava outra linha de elenco. A média do Racha conta a
  -- pessoa uma vez por Partida; senão o denominador sobe e o Overall de
  -- todo mundo muda. Avulso entra: person_id cobre profile e guest.
  line_presence as (
    select count(distinct (l.match_id, l.person_id))::integer as n
    from public.event_match_lineup l
    join season s on s.id = l.match_id
    where l.role = 'OUTFIELD'
  ),
  goal_totals as (
    select
      count(*) filter (where not g.is_own_goal)::integer as credited,
      count(*) filter (
        where not g.is_own_goal
          and coalesce(g.assist_profile_id, g.assist_guest_id) is not null
      )::integer as assists,
      count(*)::integer as all_goals
    from public.event_match_goal g
    join season s on s.id = g.match_id
  ),
  match_count as (
    select count(*)::integer as n from season
  ),
  avgs as (
    select
      case when p.n = 0 then 0::numeric else t.credited::numeric / p.n end as avg_goals,
      case when p.n = 0 then 0::numeric else t.assists::numeric / p.n end as avg_assists,
      -- 2 × Partidas, mesmo sem goleiro: senão o racha de um goleiro só
      -- se compararia consigo mesmo.
      case when c.n = 0 then 0::numeric else t.all_goals::numeric / (2 * c.n) end as avg_conceded
    from line_presence p
    cross join goal_totals t
    cross join match_count c
  ),
  -- No teste a transação inteira tem o mesmo now(); o desempate pelo id
  -- pega a passagem gravada por último quando os horários coincidem.
  scorer_role as (
    select distinct on (g.id)
      g.scorer_profile_id as profile_id,
      l.role
    from public.event_match_goal g
    join season s on s.id = g.match_id
    join public.event_match_lineup l
      on l.match_id = g.match_id
     and l.profile_id = g.scorer_profile_id
     and l.entered_at <= g.created_at
     and (l.left_at is null or l.left_at >= g.created_at)
    where not g.is_own_goal
      and g.scorer_profile_id is not null
    order by g.id, l.entered_at desc, l.id desc
  ),
  assist_role as (
    select distinct on (g.id)
      g.assist_profile_id as profile_id,
      l.role
    from public.event_match_goal g
    join season s on s.id = g.match_id
    join public.event_match_lineup l
      on l.match_id = g.match_id
     and l.profile_id = g.assist_profile_id
     and l.entered_at <= g.created_at
     and (l.left_at is null or l.left_at >= g.created_at)
    where not g.is_own_goal
      and g.assist_profile_id is not null
    order by g.id, l.entered_at desc, l.id desc
  ),
  line_match as (
    select l.profile_id, count(distinct l.match_id)::integer as n
    from public.event_match_lineup l
    join season s on s.id = l.match_id
    where l.role = 'OUTFIELD' and l.profile_id is not null
    group by l.profile_id
  ),
  keeper_match as (
    select l.profile_id, count(distinct l.match_id)::integer as n
    from public.event_match_lineup l
    join season s on s.id = l.match_id
    where l.role = 'GOALKEEPER' and l.profile_id is not null
    group by l.profile_id
  ),
  -- Vitória: ativo no apito (left_at = ended_at) e não expulso. Amarelo
  -- continua ativo. Empate não tem vencedor. Pênaltis gravam o Time.
  line_win as (
    select l.profile_id, count(distinct l.match_id)::integer as n
    from public.event_match_lineup l
    join season s on s.id = l.match_id
    where l.role = 'OUTFIELD'
      and l.profile_id is not null
      and s.winner_team_id is not null
      and l.team_id = s.winner_team_id
      and l.left_at = s.ended_at
      and not l.left_by_red
    group by l.profile_id
  ),
  keeper_win as (
    select l.profile_id, count(distinct l.match_id)::integer as n
    from public.event_match_lineup l
    join season s on s.id = l.match_id
    where l.role = 'GOALKEEPER'
      and l.profile_id is not null
      and s.winner_team_id is not null
      and l.team_id = s.winner_team_id
      and l.left_at = s.ended_at
      and not l.left_by_red
    group by l.profile_id
  ),
  clean_sheet as (
    select l.profile_id, count(distinct l.match_id)::integer as n
    from public.event_match_lineup l
    join season s on s.id = l.match_id
    where l.role = 'GOALKEEPER'
      and l.profile_id is not null
      and l.left_at = s.ended_at
      and not l.left_by_red
      and not exists (
        select 1 from public.event_match_goal g
        where g.match_id = l.match_id
          and g.team_id <> l.team_id
      )
    group by l.profile_id
  ),
  conceded as (
    select g.conceded_profile_id as profile_id, count(*)::integer as n
    from public.event_match_goal g
    join season s on s.id = g.match_id
    where g.conceded_profile_id is not null
    group by g.conceded_profile_id
  ),
  line_goal as (
    select r.profile_id, count(*)::integer as n
    from scorer_role r
    where r.role = 'OUTFIELD'
    group by r.profile_id
  ),
  line_assist as (
    select r.profile_id, count(*)::integer as n
    from assist_role r
    where r.role = 'OUTFIELD'
    group by r.profile_id
  ),
  keeper_goal as (
    select r.profile_id, count(*)::integer as n
    from scorer_role r
    where r.role = 'GOALKEEPER'
    group by r.profile_id
  ),
  stats as (
    select
      mem.profile_id,
      coalesce(lm.n, 0) as line_matches,
      coalesce(lg.n, 0) as line_goals,
      coalesce(la.n, 0) as line_assists,
      coalesce(lw.n, 0) as line_wins,
      coalesce(km.n, 0) as keeper_matches,
      coalesce(kw.n, 0) as keeper_wins,
      coalesce(cs.n, 0) as keeper_clean_sheets,
      coalesce(cd.n, 0) as keeper_conceded,
      coalesce(kg.n, 0) as keeper_goals,
      private.line_overall(
        coalesce(lm.n, 0), coalesce(lg.n, 0), coalesce(la.n, 0), coalesce(lw.n, 0),
        a.avg_goals, a.avg_assists
      ) as line_overall,
      private.keeper_overall(
        coalesce(km.n, 0), coalesce(cd.n, 0), a.avg_conceded
      ) as keeper_overall,
      case
        when coalesce(lm.n, 0) = 0 and coalesce(km.n, 0) = 0 then
          case mem.plays_as when 'GOALKEEPER' then 'GOALKEEPER' else 'LINE' end
        when coalesce(km.n, 0) > coalesce(lm.n, 0) then 'GOALKEEPER'
        else 'LINE'
      end as shown_role,
      v_year as season_year,
      mem.plays_as::text as plays_as,
      mem.primary_position::text as primary_position
    from public.member mem
    cross join avgs a
    left join line_match lm on lm.profile_id = mem.profile_id
    left join keeper_match km on km.profile_id = mem.profile_id
    left join line_win lw on lw.profile_id = mem.profile_id
    left join keeper_win kw on kw.profile_id = mem.profile_id
    left join clean_sheet cs on cs.profile_id = mem.profile_id
    left join conceded cd on cd.profile_id = mem.profile_id
    left join line_goal lg on lg.profile_id = mem.profile_id
    left join line_assist la on la.profile_id = mem.profile_id
    left join keeper_goal kg on kg.profile_id = mem.profile_id
    where mem.racha_id = p_racha_id
  )
  select
    s.profile_id,
    s.line_matches,
    s.line_goals,
    s.line_assists,
    s.line_wins,
    s.keeper_matches,
    s.keeper_wins,
    s.keeper_clean_sheets,
    s.keeper_conceded,
    s.keeper_goals,
    s.line_overall,
    s.keeper_overall,
    s.shown_role,
    case when s.shown_role = 'GOALKEEPER' then s.keeper_overall else s.line_overall end,
    s.season_year,
    s.plays_as,
    s.primary_position
  from stats s;
end $$;

create function public.get_racha_cards(p_racha_id uuid)
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

  return coalesce((
    select jsonb_agg(
      private.card_body_json(
        c.profile_id, c.shown_role, c.shown_overall,
        c.line_matches, c.line_goals, c.line_assists, c.line_wins,
        c.keeper_matches, c.keeper_wins, c.keeper_clean_sheets, c.keeper_goals,
        c.season_year, c.plays_as, c.primary_position
      )
      order by c.profile_id
    )
    from private.racha_member_cards(p_racha_id) c
  ), '[]'::jsonb);
end $$;

-- Sem Partida em nenhum Racha, joined_at decide — created_at só desempata
-- quando já houve Partida. Senão o Racha mais novo ganharia de quem entrou
-- por último sem ter jogado. Quem saiu ou foi expulso não escolhe a carta:
-- sem membership ativo o retorno é null e o Perfil mostra o exemplo.
create function public.get_my_profile_card()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_racha uuid;
  v_name text;
  v_card jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  with membership as (
    select
      m.racha_id,
      r.name,
      r.created_at,
      m.joined_at,
      coalesce(s.line_matches, 0) + coalesce(s.keeper_matches, 0) as matches
    from public.member m
    join public.racha r on r.id = m.racha_id
    left join lateral (
      select c.line_matches, c.keeper_matches
      from private.racha_member_cards(m.racha_id) c
      where c.profile_id = v_uid
    ) s on true
    where m.profile_id = v_uid
      and m.is_active
  )
  select p.racha_id, p.name
    into v_racha, v_name
  from membership p
  order by
    p.matches desc,
    case when (select max(q.matches) from membership q) > 0 then p.created_at end desc nulls last,
    case when (select max(q.matches) from membership q) = 0 then p.joined_at end desc nulls last,
    p.joined_at desc,
    p.created_at desc
  limit 1;

  if v_racha is null then
    return null;
  end if;

  select private.card_body_json(
    c.profile_id, c.shown_role, c.shown_overall,
    c.line_matches, c.line_goals, c.line_assists, c.line_wins,
    c.keeper_matches, c.keeper_wins, c.keeper_clean_sheets, c.keeper_goals,
    c.season_year, c.plays_as, c.primary_position
  )
    into v_card
  from private.racha_member_cards(v_racha) c
  where c.profile_id = v_uid;

  return jsonb_build_object('racha_name', v_name, 'card', v_card);
end $$;

revoke execute on function private.anniversary_date(integer, integer, integer)
  from public, anon, authenticated;
revoke execute on function private.racha_season_start(uuid, date)
  from public, anon, authenticated;
revoke execute on function private.line_overall(integer, integer, integer, integer, numeric, numeric)
  from public, anon, authenticated;
revoke execute on function private.keeper_overall(integer, integer, numeric)
  from public, anon, authenticated;
revoke execute on function private.card_body_json(
  uuid, text, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, text, text
) from public, anon, authenticated;
revoke execute on function private.racha_member_cards(uuid)
  from public, anon, authenticated;

revoke execute on function public.get_racha_cards(uuid) from public, anon;
grant execute on function public.get_racha_cards(uuid) to authenticated;

revoke execute on function public.get_my_profile_card() from public, anon;
grant execute on function public.get_my_profile_card() to authenticated;

-- Corpo de 20261007100000. Só a carta do artilheiro ganha shown_role, overall,
-- line, keeper e season_year; o resto da Resenha fica como estava.

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
          'wins', coalesce(w.wins, 0)
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
          'match_number', f.number
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
