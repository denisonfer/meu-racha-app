-- Ranking e Eventos da Temporada: totais na leitura, posição no domínio.
-- Veio de 20261007110000; só entra keeper_assists.

drop function private.racha_member_cards(uuid);

create function private.racha_member_cards(p_racha_id uuid)
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
  keeper_assists integer,
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
  keeper_assist as (
    select r.profile_id, count(*)::integer as n
    from assist_role r
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
      coalesce(kas.n, 0) as keeper_assists,
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
    left join keeper_assist kas on kas.profile_id = mem.profile_id
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
    s.keeper_assists,
    s.line_overall,
    s.keeper_overall,
    s.shown_role,
    case when s.shown_role = 'GOALKEEPER' then s.keeper_overall else s.line_overall end,
    s.season_year,
    s.plays_as,
    s.primary_position
  from stats s;
end $$;

revoke execute on function private.racha_member_cards(uuid)
  from public, anon, authenticated;

-- Totais por Membro na Temporada; quem zerou as três contas não entra.
create function public.get_season_ranking(p_racha_id uuid)
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
          'wins', c.line_wins + c.keeper_wins
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

-- Resumo do Evento compartilhado: a lista de Eventos precisa do place;
-- a home (last_resenha) omite essa chave para não mudar o contrato.
create function private.event_resenha_summary(p_event_id uuid)
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
        count(*)::integer as goals
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
        select jsonb_agg(s.display_name order by s.display_name)
        from scored s
        join top t on t.n > 0 and s.goals = t.n
      ), '[]'::jsonb),
      'top_goals', (select t.n from top t)
    )
  );
end $$;

revoke execute on function private.event_resenha_summary(uuid)
  from public, anon, authenticated;

create or replace function public.get_racha_last_resenha(p_racha_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event;
begin
  if public.my_racha_role(p_racha_id) is null then
    raise exception 'not_allowed';
  end if;

  -- ended_at empata na mesma transação de teste; id desempata sem inventar outro critério.
  select * into v_event
  from public.event e
  where e.racha_id = p_racha_id and e.status = 'finished'
  order by e.ended_at desc, e.id desc
  limit 1;

  if not found then
    return null;
  end if;

  return private.event_resenha_summary(v_event.id) - 'place';
end $$;

revoke execute on function public.get_racha_last_resenha(uuid) from public, anon;
grant execute on function public.get_racha_last_resenha(uuid) to authenticated;

create function public.get_season_events(p_racha_id uuid)
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
      private.event_resenha_summary(e.id)
      order by e.starts_on desc, e.ended_at desc, e.id desc
    )
    from public.event e
    where e.racha_id = p_racha_id
      and e.status = 'finished'
      and private.racha_season_start(p_racha_id, e.starts_on)
        = private.racha_season_start(
            p_racha_id,
            (now() at time zone 'America/Sao_Paulo')::date
          )
  ), '[]'::jsonb);
end $$;

revoke execute on function public.get_season_events(uuid) from public, anon;
grant execute on function public.get_season_events(uuid) to authenticated;
