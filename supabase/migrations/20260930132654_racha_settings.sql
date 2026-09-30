-- Fatia 4a: o Dono edita nome, Idade mínima e o motor (regras 3.2, 5.1) e
-- exclui o Racha (3.6). A trava com Evento `active` (3.3, 3.6) entra nestas
-- mesmas policies quando existir Evento.

create policy "racha: Dono edita" on public.racha for update
  to authenticated
  using (public.my_racha_role(id) = 'OWNER')
  with check (public.my_racha_role(id) = 'OWNER');

-- os filhos (member, season, join_request) saem pelo on delete cascade, que
-- não passa pela RLS deles
create policy "racha: Dono exclui" on public.racha for delete
  to authenticated
  using (public.my_racha_role(id) = 'OWNER');

-- invite_code, id e created_at ficam de fora: nem o Dono altera
grant update (
  name, min_age, outfield_per_team, game_mode, max_consecutive_wins,
  tie_rule, tie_return_order, consider_position, match_duration_min
) on public.racha to authenticated;

grant delete on public.racha to authenticated;
