-- A S1 mostra se o Sorteio vai usar Posição. A regra que vale é a do Evento (cópia do Racha
-- na criação), a mesma que o motor lê; o app não consegue ler a coluna de event direto.
create or replace function private.event_sort_proposal_json(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_roster jsonb := private.event_sort_roster(p_event_id);
  v_sort public.event_sort%rowtype;
  v_base jsonb;
  v_line integer;
begin
  select count(*) filter (where e ->> 'plays_as' = 'OUTFIELD')::integer into v_line
  from jsonb_array_elements(v_roster) as e;

  v_base := jsonb_build_object(
    'event_id', p_event_id,
    'line_count', v_line,
    'goalkeeper_count', jsonb_array_length(v_roster) - v_line,
    'min_line_players', 6,
    'can_sort', v_line >= 6,
    'consider_position', (select e.consider_position from public.event e where e.id = p_event_id)
  );

  select * into v_sort from public.event_sort s where s.event_id = p_event_id;
  if not found then
    return v_base || jsonb_build_object('state', 'none');
  end if;
  if v_sort.signature <> private.event_sort_signature(p_event_id, v_roster) then
    return v_base || jsonb_build_object('state', 'stale');
  end if;

  return v_base || jsonb_build_object(
    'state', 'ready',
    'version', v_sort.version,
    'mode', v_sort.mode,
    'balance', private.event_sort_balance_json(v_sort),
    'super_warning', v_sort.super_warning,
    'teams', private.event_sort_teams_json(p_event_id),
    'goalkeepers_per_team', v_sort.goalkeepers_per_team,
    'goalkeeper_queue', private.event_sort_goalkeeper_queue_json(p_event_id)
  );
end $$;
