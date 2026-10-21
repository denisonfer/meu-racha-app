-- Lateral por lado (decisão do dono de 21/10/2026): FULL_BACK some e entram LEFT_BACK e
-- RIGHT_BACK. Ninguém sabe o lado de quem era Lateral, então a subdivisão vira nula e o fluxo
-- de Posição pendente pede a escolha. Os valores novos só podem ser usados na migration
-- seguinte: valor de enum criado aqui não vale dentro desta transação.

update public.member set primary_position_detail = null where primary_position_detail = 'FULL_BACK';
update public.member set secondary_position_detail = null where secondary_position_detail = 'FULL_BACK';
update public.event_guest set primary_position_detail = null where primary_position_detail = 'FULL_BACK';
update public.event_guest set secondary_position_detail = null where secondary_position_detail = 'FULL_BACK';
update public.join_request set primary_position_detail = null where primary_position_detail = 'FULL_BACK';
update public.join_request set secondary_position_detail = null where secondary_position_detail = 'FULL_BACK';
update public.event_sort_team_player set primary_position_detail_snapshot = null
  where primary_position_detail_snapshot = 'FULL_BACK';
update public.event_sort_team_player set secondary_position_detail_snapshot = null
  where secondary_position_detail_snapshot = 'FULL_BACK';

alter type public.position_detail rename value 'FULL_BACK' to 'LEFT_BACK';
alter type public.position_detail add value 'RIGHT_BACK' after 'LEFT_BACK';
