-- Resenha: duas leituras sobre o que o Evento já gravou. Sem tabela nova.
-- Só Partida finished entra; gol contra não credita ninguém; Vitória é estar
-- ativo no apito no Time vencedor (expulso não soma, amarelo soma).

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
          )
          from public.profile pr
          join public.member m
            on m.profile_id = pr.id and m.racha_id = v_event.racha_id
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

-- Cartão da home: só o último Evento finished, sem montar a Resenha inteira.
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

  return (
    with finished as (
      select m.id
      from public.event_match m
      where m.event_id = v_event.id and m.status = 'finished'
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

revoke execute on function public.get_racha_last_resenha(uuid) from public, anon;
grant execute on function public.get_racha_last_resenha(uuid) to authenticated;
