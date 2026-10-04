-- Subdivisão de posição em Times grandes (regra 8.2; spec e plano de 03/10/2026; ADR 0036).
-- A subdivisão é do Membro naquele Racha (ou do Avulso naquele Evento), nunca do Perfil. Dela,
-- da zona ampla e do tamanho de Time do Evento sai a camada: a mesma que agrupa a Presença e
-- os Times, alimenta o Sorteio e bloqueia quem está pendente.

create type public.position_detail as enum ('CENTER_BACK', 'FULL_BACK', 'DEFENSIVE_MID', 'ATTACKING_MID');

-- coalesce: zona nula (Goleiro) com subdivisão daria null, e null passa em check constraint
create function private.position_detail_fits(zone public.position, detail public.position_detail)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    detail is null
      or (zone = 'DEFENDER' and detail in ('CENTER_BACK', 'FULL_BACK'))
      or (zone = 'MIDFIELDER' and detail in ('DEFENSIVE_MID', 'ATTACKING_MID')),
    false
  );
$$;

-- Camada de um jogador de linha. O corte é o tamanho de Time do Evento (cópia do Racha na
-- criação), para Evento já criado não mudar quando o Racha muda. Nulo em Time 8+ = pendente.
create function private.position_layer(zone public.position, detail public.position_detail, per_team integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when per_team < 8 or zone in ('FORWARD', 'ANY') then zone::text
    else detail::text
  end;
$$;

revoke execute on function
  private.position_detail_fits(public.position, public.position_detail),
  private.position_layer(public.position, public.position_detail, integer)
  from public, anon, authenticated;

alter table public.member
  add column primary_position_detail public.position_detail,
  add column secondary_position_detail public.position_detail,
  add constraint member_position_detail_fits check (
    private.position_detail_fits(primary_position, primary_position_detail)
    and private.position_detail_fits(secondary_position, secondary_position_detail)
  );

alter table public.event_guest
  add column primary_position_detail public.position_detail,
  add column secondary_position_detail public.position_detail,
  add constraint event_guest_position_detail_fits check (
    private.position_detail_fits(primary_position, primary_position_detail)
    and private.position_detail_fits(secondary_position, secondary_position_detail)
  );

-- A Solicitação não guarda zona (a zona é a do Perfil, outra tabela): a validação contra
-- a zona fica no gatilho de insert, e a aprovação relê o Perfil.
alter table public.join_request
  add column primary_position_detail public.position_detail,
  add column secondary_position_detail public.position_detail;

alter table public.event_sort_team_player
  add column primary_position_detail_snapshot public.position_detail,
  add column secondary_position_detail_snapshot public.position_detail,
  add constraint event_sort_team_player_position_detail_fits check (
    private.position_detail_fits(primary_position_snapshot, primary_position_detail_snapshot)
    and private.position_detail_fits(secondary_position_snapshot, secondary_position_detail_snapshot)
  );

-- O app insere a Solicitação direto (RLS); o grant de insert é por coluna
grant insert (primary_position_detail, secondary_position_detail) on public.join_request to authenticated;

-- --- coleta ---

-- Racha 8+ pergunta a subdivisão de cada zona DEFENSOR/MEIO_CAMPO do Perfil; Racha 3–7 não
-- pergunta nada. Security definer: quem pede ainda não é Membro e não lê o Racha pela RLS.
create function private.join_request_position_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per_team smallint;
  v_profile public.profile%rowtype;
begin
  select r.outfield_per_team into v_per_team from public.racha r where r.id = new.racha_id;
  select * into v_profile from public.profile p where p.id = new.profile_id;

  if v_per_team is null or v_per_team < 8 or v_profile.plays_as is distinct from 'OUTFIELD' then
    new.primary_position_detail := null;
    new.secondary_position_detail := null;
    return new;
  end if;

  if (v_profile.primary_position in ('DEFENDER', 'MIDFIELDER') and new.primary_position_detail is null)
     or (v_profile.secondary_position in ('DEFENDER', 'MIDFIELDER') and new.secondary_position_detail is null) then
    raise exception 'position_detail_required';
  end if;
  if not (private.position_detail_fits(v_profile.primary_position, new.primary_position_detail)
          and private.position_detail_fits(v_profile.secondary_position, new.secondary_position_detail)) then
    raise exception 'position_detail_mismatch';
  end if;
  return new;
end $$;

revoke execute on function private.join_request_position_details() from public, anon, authenticated;

create trigger join_request_position_details
  before insert on public.join_request
  for each row execute function private.join_request_position_details();

-- Mesmo corpo da versão de 20261003150000_event_sort.sql; só entram as subdivisões. A pessoa
-- pode ter mudado de zona entre pedir e ser aprovada: a subdivisão que não combina mais com a
-- zona atual do Perfil entra vazia (Membro pendente), sem falhar a aprovação.
create or replace function public.approve_join_request(
  p_request_id uuid,
  p_stars smallint,
  p_super_star boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.join_request%rowtype;
  v_profile public.profile%rowtype;
  v_stars smallint;
  v_super_star boolean;
begin
  select * into v_request from public.join_request jr where jr.id = p_request_id;
  if not found then
    raise exception 'already_resolved';
  end if;

  -- Racha primeiro, pedido depois: a ordem de expel_member, que apaga o pedido sob a mesma trava
  perform 1 from public.racha r where r.id = v_request.racha_id for update;

  -- for update: dois admins no mesmo pedido, o segundo espera e vê já resolvido
  select * into v_request from public.join_request jr
    where jr.id = p_request_id for update;
  if not found then
    raise exception 'already_resolved';
  end if;
  if not coalesce(public.my_racha_role(v_request.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'already_resolved';
  end if;

  select * into v_profile from public.profile p where p.id = v_request.profile_id;

  -- Goleiro entra sem Estrelas nem Super Estrela, seja o que for que veio (8.3)
  if v_profile.plays_as = 'GOALKEEPER' then
    v_stars := null;
    v_super_star := false;
  else
    if p_stars is null or p_stars not between 1 and 5 then
      raise exception 'stars_required';
    end if;
    v_stars := p_stars;
    v_super_star := coalesce(p_super_star, false);
  end if;

  -- quem saiu e voltou já tem a linha (inativa) do par: reativa em vez de duplicar.
  -- o where trava a reativação em quem está inativo: sem ele, um pedido
  -- pendente "impossível" (Membro já ativo, ex.: dois aprovam em paralelo)
  -- rebaixaria/sobrescreveria as Estrelas de um Membro ativo.
  insert into public.member as m (
    racha_id, profile_id, role, plays_as, primary_position, secondary_position,
    stars, is_super_star, primary_position_detail, secondary_position_detail
  ) values (
    v_request.racha_id, v_request.profile_id, 'PLAYER', v_profile.plays_as,
    v_profile.primary_position, v_profile.secondary_position, v_stars, v_super_star,
    case when private.position_detail_fits(v_profile.primary_position, v_request.primary_position_detail)
      then v_request.primary_position_detail end,
    case when private.position_detail_fits(v_profile.secondary_position, v_request.secondary_position_detail)
      then v_request.secondary_position_detail end
  )
  on conflict (racha_id, profile_id) do update set
    is_active = true,
    role = 'PLAYER',
    plays_as = excluded.plays_as,
    primary_position = excluded.primary_position,
    secondary_position = excluded.secondary_position,
    stars = excluded.stars,
    is_super_star = excluded.is_super_star,
    primary_position_detail = excluded.primary_position_detail,
    secondary_position_detail = excluded.secondary_position_detail,
    joined_at = now()
  where not m.is_active;

  -- found reflete o insert/update do comando acima (confirmado com o
  -- postgres local): se o where bloqueou (Membro já ativo), nada mudou.
  if not found then
    raise exception 'already_resolved';
  end if;

  update public.join_request jr
    set status = 'APPROVED', reviewed_by = (select auth.uid()), reviewed_at = now()
    where jr.id = p_request_id;

  -- reaprovado depois de expulso: o aviso antigo não pode reaparecer na lista
  delete from public.racha_notice n
    where n.profile_id = v_request.profile_id
      and n.racha_id = v_request.racha_id
      and n.kind = 'REMOVED';
end $$;

-- O próprio Membro também completa a pendência, para o Sorteio não travar no campo.
-- Nunca toca o Perfil.
create function public.set_member_position_details(
  p_racha_id uuid,
  p_profile_id uuid,
  p_primary public.position_detail,
  p_secondary public.position_detail
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role;
  v_target public.member%rowtype;
begin
  -- a trava comum do Racha: a subdivisão entra no elenco e na assinatura do Sorteio
  perform 1 from public.racha r where r.id = p_racha_id for update;

  v_my_role := public.my_racha_role(p_racha_id);
  if v_my_role is null
     or (v_my_role = 'PLAYER' and p_profile_id is distinct from (select auth.uid())) then
    raise exception 'not_allowed';
  end if;

  select * into v_target from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
    for update;
  if not found then
    raise exception 'not_member';
  end if;

  if not (private.position_detail_fits(v_target.primary_position, p_primary)
          and private.position_detail_fits(v_target.secondary_position, p_secondary)) then
    raise exception 'position_detail_mismatch';
  end if;

  update public.member m
    set primary_position_detail = p_primary, secondary_position_detail = p_secondary
    where m.id = v_target.id;
end $$;

revoke execute on function public.set_member_position_details(uuid, uuid, public.position_detail, public.position_detail)
  from public, anon;
grant execute on function public.set_member_position_details(uuid, uuid, public.position_detail, public.position_detail)
  to authenticated;

-- A assinatura nova pede drop. Os parâmetros novos têm default para o app atual seguir
-- chamando sem eles até ganhar os seletores.
drop function public.add_guest(uuid, text, public.plays_as, public.position, public.position, smallint, boolean);

-- Em Evento 8+, o Avulso de linha traz a subdivisão de cada zona DEFENSOR/MEIO_CAMPO; vale só
-- para este Evento. Goleiro e Evento 3–7 não guardam subdivisão (a camada não a usaria).
create function public.add_guest(
  p_event_id uuid,
  p_display_name text,
  p_plays_as public.plays_as,
  p_primary_position public."position",
  p_secondary_position public."position",
  p_stars smallint,
  p_is_super_star boolean,
  p_primary_position_detail public.position_detail default null,
  p_secondary_position_detail public.position_detail default null
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
  v_primary_detail public.position_detail;
  v_secondary_detail public.position_detail;
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

  if p_plays_as = 'OUTFIELD' and v_event.outfield_per_team >= 8 then
    if (p_primary_position in ('DEFENDER', 'MIDFIELDER') and p_primary_position_detail is null)
       or (p_secondary_position in ('DEFENDER', 'MIDFIELDER') and p_secondary_position_detail is null) then
      raise exception 'position_detail_required';
    end if;
    if not (private.position_detail_fits(p_primary_position, p_primary_position_detail)
            and private.position_detail_fits(p_secondary_position, p_secondary_position_detail)) then
      raise exception 'position_detail_mismatch';
    end if;
    v_primary_detail := p_primary_position_detail;
    v_secondary_detail := p_secondary_position_detail;
  end if;

  insert into public.event_guest (
    event_id, display_name, plays_as, primary_position, secondary_position, stars, is_super_star,
    did_attend, primary_position_detail, secondary_position_detail
  ) values (
    p_event_id, btrim(p_display_name), p_plays_as, p_primary_position, p_secondary_position,
    v_stars, v_super, true, v_primary_detail, v_secondary_detail
  ) returning id into v_guest_id;

  return v_guest_id;
end $$;

revoke execute on function public.add_guest(
  uuid, text, public.plays_as, public.position, public.position, smallint, boolean,
  public.position_detail, public.position_detail
) from public, anon;
grant execute on function public.add_guest(
  uuid, text, public.plays_as, public.position, public.position, smallint, boolean,
  public.position_detail, public.position_detail
) to authenticated;

-- --- motor ---

-- Sete camadas, da defesa para o ataque. Em Time 3–7 só aparecem as três zonas; em Time 8+,
-- DEFENDER e MIDFIELDER dão lugar às subdivisões. Camada vazia não custa nada.
create or replace function private.sort_layer_ix(p_layer text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_layer
    when 'CENTER_BACK' then 1
    when 'FULL_BACK' then 2
    when 'DEFENDER' then 3
    when 'DEFENSIVE_MID' then 4
    when 'ATTACKING_MID' then 5
    when 'MIDFIELDER' then 6
    when 'FORWARD' then 7
  end;
$$;

-- p_players: [{id, stars, super, main, sec}] só de linha; main/sec já são a camada
-- (private.position_layer), não a zona. Mesmo corpo da versão de 20261003150000_event_sort.sql,
-- com sete camadas e o preenchimento por camada (ADR 0036) no lugar da serpentina contínua
-- quando a Posição está ligada. Com Posição desligada nada muda.
create or replace function private.sort_teams(
  p_players jsonb,
  p_goalkeepers uuid[],
  p_line_per_team integer,
  p_use_position boolean,
  p_fixed_leftovers uuid[] default null,
  p_seed double precision default null
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_l integer := p_line_per_team;
  v_n integer;
  v_ids uuid[];
  v_stars integer[];
  v_sup boolean[];
  v_main text[];
  v_sec text[];
  v_full integer;
  v_split boolean;
  v_caps integer[];
  v_t integer;
  v_left_count integer;
  v_leftovers uuid[];
  v_pool integer[];
  v_team integer[];
  v_size integer[];
  v_sums integer[];
  v_sups integer[];
  v_s2 integer[];
  v_u2 integer[];
  v_cur integer[];
  v_layer text[];
  v_counts integer[] := array_fill(0, array[7]);
  v_next integer[];
  v_ordered integer[] := '{}';
  v_any integer[] := '{}';
  v_layer_players integer[];
  v_got integer[];
  v_i integer;
  v_k text;
  v_step integer := 0;
  v_r integer;
  v_idx integer;
  v_best integer;
  v_improved boolean;
  v_layer_cur text;
  v_layer_sec text;
  v_layer_other text;
  v_a integer;
  v_b integer;
  v_pa integer;
  v_pb integer;
  v_ta integer;
  v_tb integer;
  v_teams jsonb := '[]'::jsonb;
  v_super_warning jsonb := '[]'::jsonb;
  v_gk_order uuid[];
  v_gk_total integer;
  v_gk_per_team boolean;
  v_gk_by_team jsonb;
  v_gk_queue jsonb;
  v_min_sup integer;
  v_diff integer;
  v_super_diff integer;
  v_balance record;
  v_left_stars integer;
  v_left_sups integer;
begin
  if p_seed is not null then
    perform setseed(p_seed);
  end if;

  if v_l is null or v_l < 3 or v_l > 10 then
    raise exception 'invalid_line_per_team';
  end if;

  select coalesce(array_agg((e ->> 'id')::uuid order by o), '{}'::uuid[]),
         coalesce(array_agg((e ->> 'stars')::integer order by o), '{}'::integer[]),
         coalesce(array_agg(coalesce((e ->> 'super')::boolean, false) order by o), '{}'::boolean[]),
         coalesce(array_agg(e ->> 'main' order by o), '{}'::text[]),
         coalesce(array_agg(e ->> 'sec' order by o), '{}'::text[])
    into v_ids, v_stars, v_sup, v_main, v_sec
  from jsonb_array_elements(p_players) with ordinality as t(e, o);

  v_n := cardinality(v_ids);
  if (select count(distinct x) from unnest(v_ids) as x) <> v_n then
    raise exception 'duplicate_player';
  end if;
  if exists (select 1 from unnest(v_stars) as s where s is null or s < 1 or s > 5) then
    raise exception 'invalid_stars';
  end if;
  if v_n < 6 then
    raise exception 'not_enough_players';
  end if;

  v_full := v_n / v_l;
  v_split := v_full < 2;
  v_caps := case
    when v_split then array[ceil(v_n / 2.0)::integer, floor(v_n / 2.0)::integer]
    else array_fill(v_l, array[v_full])
  end;
  v_t := cardinality(v_caps);
  v_left_count := case when v_split then 0 else v_n % v_l end;

  -- sobras antes do equilíbrio, sem olhar Estrelas nem Posição
  if p_fixed_leftovers is not null then
    if cardinality(p_fixed_leftovers) <> v_left_count
       or (select count(distinct x) from unnest(p_fixed_leftovers) as x) <> cardinality(p_fixed_leftovers)
       or exists (select 1 from unnest(p_fixed_leftovers) as x where not (x = any (v_ids))) then
      raise exception 'fixed_leftovers_mismatch';
    end if;
    v_leftovers := p_fixed_leftovers;
  else
    select coalesce(array_agg(x), '{}'::uuid[]) into v_leftovers
    from (select x from unnest(v_ids) as x order by random() limit v_left_count) s;
  end if;

  select coalesce(array_agg(i order by i), '{}'::integer[]) into v_pool
  from generate_series(1, v_n) as i
  where not (v_ids[i] = any (v_leftovers));

  v_team := array_fill(0, array[v_n]);
  v_size := array_fill(0, array[v_t]);
  v_sums := array_fill(0, array[v_t]);
  v_sups := array_fill(0, array[v_t]);
  v_layer := array_fill('ANY'::text, array[v_n]);

  if not p_use_position then
    v_ordered := private.sort_stars_desc(v_pool, v_stars);
  else
    -- camada da Posição principal ou da secundária, a que deixar menos resto por Time
    foreach v_i in array v_pool loop
      if v_main[v_i] <> 'ANY' then
        v_layer[v_i] := v_main[v_i];
        v_counts[private.sort_layer_ix(v_main[v_i])] := v_counts[private.sort_layer_ix(v_main[v_i])] + 1;
      end if;
    end loop;

    v_improved := true;
    while v_improved loop
      v_improved := false;
      foreach v_i in array v_pool loop
        v_layer_cur := v_layer[v_i];
        v_layer_sec := v_sec[v_i];
        continue when v_layer_cur = 'ANY' or v_layer_sec is null or v_layer_sec = 'ANY';
        v_layer_other := case when v_layer_cur = v_main[v_i] then v_layer_sec else v_main[v_i] end;
        v_next := v_counts;
        v_next[private.sort_layer_ix(v_layer_cur)] := v_next[private.sort_layer_ix(v_layer_cur)] - 1;
        v_next[private.sort_layer_ix(v_layer_other)] := v_next[private.sort_layer_ix(v_layer_other)] + 1;
        if private.sort_layer_cost(v_next, v_t) < private.sort_layer_cost(v_counts, v_t) then
          v_counts := v_next;
          v_layer[v_i] := v_layer_other;
          v_improved := true;
        end if;
      end loop;
    end loop;

    -- Preenchimento por camada (ADR 0036): cada jogador da camada, em Estrelas desc, vai para o
    -- Time com vaga que tem menos gente desta camada; empate, menos gente no total; depois,
    -- menor soma de Estrelas; depois, menor índice. Na serpentina, o jogador a mais de camada
    -- ímpar caía sempre no mesmo Time e o ataque acumulava num Time só.
    foreach v_k in array array[
      'CENTER_BACK', 'FULL_BACK', 'DEFENDER', 'DEFENSIVE_MID', 'ATTACKING_MID', 'MIDFIELDER', 'FORWARD'
    ] loop
      v_layer_players := private.sort_stars_desc(
        (select coalesce(array_agg(i order by i), '{}'::integer[])
         from unnest(v_pool) as i where v_layer[i] = v_k),
        v_stars
      );
      continue when cardinality(v_layer_players) = 0;
      v_got := array_fill(0, array[v_t]);
      foreach v_i in array v_layer_players loop
        v_best := 0;
        for v_idx in 1..v_t loop
          continue when v_size[v_idx] >= v_caps[v_idx];
          if v_best = 0
             or (v_got[v_idx], v_size[v_idx], v_sums[v_idx])
                < (v_got[v_best], v_size[v_best], v_sums[v_best]) then
            v_best := v_idx;
          end if;
        end loop;
        v_team[v_i] := v_best;
        v_got[v_best] := v_got[v_best] + 1;
        v_size[v_best] := v_size[v_best] + 1;
        v_sums[v_best] := v_sums[v_best] + v_stars[v_i];
        v_sups[v_best] := v_sups[v_best] + v_sup[v_i]::integer;
      end loop;
    end loop;
    v_any := private.sort_stars_desc(
      (select coalesce(array_agg(i order by i), '{}'::integer[])
       from unnest(v_pool) as i where v_layer[i] = 'ANY'),
      v_stars
    );
  end if;

  -- Serpentina contínua (só sem Posição; com Posição v_ordered fica vazio): o ponteiro segue
  -- de onde parou; Time cheio é pulado (na divisão em 2 grupos os tamanhos diferem).
  foreach v_i in array v_ordered loop
    loop
      v_r := v_step % (2 * v_t);
      v_idx := case when v_r < v_t then v_r else 2 * v_t - 1 - v_r end + 1;
      v_step := v_step + 1;
      if v_size[v_idx] < v_caps[v_idx] then
        v_team[v_i] := v_idx;
        v_size[v_idx] := v_size[v_idx] + 1;
        v_sums[v_idx] := v_sums[v_idx] + v_stars[v_i];
        v_sups[v_idx] := v_sups[v_idx] + v_sup[v_i]::integer;
        exit;
      end if;
    end loop;
  end loop;

  -- TODAS preenche onde falta: o Time com vaga e menor soma de Estrelas, sem olhar setor
  foreach v_i in array v_any loop
    v_best := 0;
    for v_idx in 1..v_t loop
      if v_size[v_idx] < v_caps[v_idx] and (v_best = 0 or v_sums[v_idx] < v_sums[v_best]) then
        v_best := v_idx;
      end if;
    end loop;
    v_team[v_i] := v_best;
    v_size[v_best] := v_size[v_best] + 1;
    v_sums[v_best] := v_sums[v_best] + v_stars[v_i];
    v_sups[v_best] := v_sups[v_best] + v_sup[v_i]::integer;
  end loop;

  -- Ajuste fino: primeira troca que melhora, até estabilizar. Com Posição só troca
  -- dentro da camada; TODAS troca com qualquer uma. Termina porque o vetor, de
  -- inteiros, diminui a cada troca.
  loop
    v_improved := false;
    v_cur := private.sort_objective(v_sums, v_sups, true);
    <<scan>>
    for v_a in 1..cardinality(v_pool) loop
      for v_b in v_a + 1..cardinality(v_pool) loop
        v_pa := v_pool[v_a];
        v_pb := v_pool[v_b];
        continue when v_team[v_pa] = v_team[v_pb];
        continue when not (v_layer[v_pa] = v_layer[v_pb] or v_layer[v_pa] = 'ANY' or v_layer[v_pb] = 'ANY');
        v_ta := v_team[v_pa];
        v_tb := v_team[v_pb];
        v_s2 := v_sums;
        v_s2[v_ta] := v_s2[v_ta] - v_stars[v_pa] + v_stars[v_pb];
        v_s2[v_tb] := v_s2[v_tb] - v_stars[v_pb] + v_stars[v_pa];
        v_u2 := v_sups;
        v_u2[v_ta] := v_u2[v_ta] - v_sup[v_pa]::integer + v_sup[v_pb]::integer;
        v_u2[v_tb] := v_u2[v_tb] - v_sup[v_pb]::integer + v_sup[v_pa]::integer;
        if private.sort_objective(v_s2, v_u2, true) < v_cur then
          v_team[v_pa] := v_tb;
          v_team[v_pb] := v_ta;
          v_sums := v_s2;
          v_sups := v_u2;
          v_improved := true;
          exit scan;
        end if;
      end loop;
    end loop;
    exit when not v_improved;
  end loop;

  for v_idx in 1..v_t loop
    v_teams := v_teams || jsonb_build_array(jsonb_build_object(
      'index', v_idx - 1,
      'player_ids', to_jsonb(array(
        select v_ids[i] from generate_series(1, v_n) as i
        where v_team[i] = v_idx order by v_stars[i] desc, i
      )),
      'star_sum', v_sums[v_idx],
      'super_count', v_sups[v_idx],
      'complete', v_size[v_idx] = v_l
    ));
  end loop;

  -- Time incompleto por último, fora do score
  if cardinality(v_leftovers) > 0 then
    select coalesce(sum(v_stars[i]), 0), count(*) filter (where v_sup[i])
      into v_left_stars, v_left_sups
    from generate_series(1, v_n) as i where v_ids[i] = any (v_leftovers);
    v_teams := v_teams || jsonb_build_array(jsonb_build_object(
      'index', v_t,
      'player_ids', to_jsonb(v_leftovers),
      'star_sum', v_left_stars,
      'super_count', v_left_sups,
      'complete', cardinality(v_leftovers) = v_l
    ));
  end if;

  v_diff := (select max(x) - min(x) from unnest(v_sums) as x);
  v_super_diff := (select max(x) - min(x) from unnest(v_sups) as x);
  select * into v_balance from private.sort_balance(v_diff, v_l, v_super_diff);

  v_min_sup := (select min(x) from unnest(v_sups) as x);
  if v_super_diff >= 2 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'team_index', t - 1,
      'player_ids', to_jsonb(array(
        select v_ids[i] from generate_series(1, v_n) as i
        where v_team[i] = t and v_sup[i] order by i
      ))
    ) order by t), '[]'::jsonb)
    into v_super_warning
    from generate_series(1, v_t) as t
    where v_sups[t] - v_min_sup >= 2;
  end if;

  select coalesce(array_agg(x order by random()), '{}'::uuid[]) into v_gk_order
  from unnest(coalesce(p_goalkeepers, '{}'::uuid[])) as x;
  v_gk_total := jsonb_array_length(v_teams);
  v_gk_per_team := cardinality(v_gk_order) >= v_gk_total;
  if v_gk_per_team then
    v_gk_by_team := to_jsonb(v_gk_order[1:v_gk_total]);
    v_gk_queue := to_jsonb(v_gk_order[v_gk_total + 1:cardinality(v_gk_order)]);
  else
    v_gk_by_team := to_jsonb(array_fill(null::uuid, array[v_gk_total]));
    v_gk_queue := to_jsonb(v_gk_order);
  end if;

  return jsonb_build_object(
    'mode', case when v_split then 'split' else 'normal' end,
    'teams', v_teams,
    'leftovers', to_jsonb(v_leftovers),
    'goalkeepers', jsonb_build_object(
      'per_team', v_gk_per_team, 'by_team', v_gk_by_team, 'queue', v_gk_queue
    ),
    'balance', jsonb_build_object(
      'score', v_balance.score,
      'raw_score', v_balance.raw_score,
      'label', v_balance.label,
      'diff', v_diff,
      'super_diff', v_super_diff,
      'capped_by_super', v_balance.capped
    ),
    'super_warning', v_super_warning
  );
end $$;

-- --- elenco, bloqueio e leitura ---

-- Mesma elegibilidade da versão de 20261003190000_event_sort_attended_only.sql. As subdivisões
-- entram no elenco (e portanto na assinatura): completar uma pendência invalida a proposta.
create or replace function private.event_sort_roster(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r.entry order by r.key), '[]'::jsonb)
  from (
    select ea.profile_id::text as key,
      jsonb_build_object(
        'kind', 'member', 'id', ea.profile_id, 'plays_as', m.plays_as,
        'stars', m.stars, 'super', m.is_super_star,
        'main', m.primary_position, 'sec', m.secondary_position,
        'main_detail', m.primary_position_detail, 'sec_detail', m.secondary_position_detail
      ) as entry
    from public.event_attendance ea
    join public.event e on e.id = ea.event_id
    join public.member m
      on m.racha_id = e.racha_id and m.profile_id = ea.profile_id and m.is_active
    where ea.event_id = p_event_id and ea.status = 'confirmed' and ea.did_attend
    union all
    select g.id::text,
      jsonb_build_object(
        'kind', 'guest', 'id', g.id, 'plays_as', g.plays_as,
        'stars', g.stars, 'super', g.is_super_star,
        'main', g.primary_position, 'sec', g.secondary_position,
        'main_detail', g.primary_position_detail, 'sec_detail', g.secondary_position_detail
      )
    from public.event_guest g
    where g.event_id = p_event_id and g.left_at is null and g.did_attend
  ) r;
$$;

-- Jogador de linha com camada nula não sorteia, com o toggle Posição ligado ou não: a
-- mensagem nomeia quem falta. p_players tem a forma das entradas do elenco.
create function private.assert_no_position_detail_pending(p_event_id uuid, p_players jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_names jsonb;
begin
  select jsonb_agg(coalesce(pr.display_name, g.display_name)
           order by coalesce(pr.display_name, g.display_name), r.id)
    into v_names
  from jsonb_to_recordset(p_players) as r(
    kind text, id uuid, plays_as public.plays_as, main public.position, main_detail public.position_detail
  )
  join public.event e on e.id = p_event_id
  left join public.profile pr on r.kind = 'member' and pr.id = r.id
  left join public.event_guest g on r.kind = 'guest' and g.id = r.id
  where r.plays_as = 'OUTFIELD'
    and private.position_layer(r.main, r.main_detail, e.outfield_per_team) is null;

  if v_names is not null then
    raise exception 'position_detail_pending' using detail = v_names::text;
  end if;
end $$;

revoke execute on function private.assert_no_position_detail_pending(uuid, jsonb)
  from public, anon, authenticated;

-- Mesma forma da versão de 20261003150000_event_sort.sql, com a camada da principal
-- (nula = pendente) calculada com o tamanho de Time do Evento.
create or replace function private.event_sort_teams_json(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.obj order by x.queue_order nulls last, x.team_number), '[]'::jsonb)
  from (
    select tm.queue_order, tm.team_number,
      jsonb_build_object(
        'team_number', tm.team_number,
        'queue_order', tm.queue_order,
        'is_active', tm.queue_order is not null,
        'player_count', pl.cnt,
        'is_complete', pl.cnt = e.outfield_per_team,
        'star_sum', pl.stars,
        'super_count', pl.supers,
        'players', pl.list,
        'goalkeeper', gk.obj
      ) as obj
    from public.event_sort_team tm
    join public.event e on e.id = tm.event_id
    cross join lateral (
      select count(*)::integer as cnt,
        coalesce(sum(p.stars_snapshot), 0)::integer as stars,
        (count(*) filter (where p.is_super_star_snapshot))::integer as supers,
        coalesce(jsonb_agg(
          jsonb_build_object(
            'kind', case when p.profile_id is not null then 'member' else 'guest' end,
            'profile_id', p.profile_id,
            'guest_id', p.guest_id,
            'display_name', coalesce(pr.display_name, g.display_name),
            'avatar_path', pr.avatar_path,
            'stars', p.stars_snapshot,
            'is_super_star', p.is_super_star_snapshot,
            'primary_position', p.primary_position_snapshot,
            'secondary_position', p.secondary_position_snapshot,
            'primary_layer', private.position_layer(
              p.primary_position_snapshot, p.primary_position_detail_snapshot, e.outfield_per_team
            ),
            'entered_at', p.entered_at
          ) order by p.stars_snapshot desc, coalesce(pr.display_name, g.display_name), p.id
        ), '[]'::jsonb) as list
      from public.event_sort_team_player p
      left join public.profile pr on pr.id = p.profile_id
      left join public.event_guest g on g.id = p.guest_id
      where p.team_id = tm.id and p.left_at is null
    ) pl
    left join lateral (
      select jsonb_build_object(
        'kind', case when k.profile_id is not null then 'member' else 'guest' end,
        'profile_id', k.profile_id,
        'guest_id', k.guest_id,
        'display_name', coalesce(pr.display_name, g.display_name),
        'avatar_path', pr.avatar_path
      ) as obj
      from public.event_sort_goalkeeper k
      left join public.profile pr on pr.id = k.profile_id
      left join public.event_guest g on g.id = k.guest_id
      where k.team_id = tm.id
    ) gk on true
    where tm.event_id = p_event_id
  ) x;
$$;

-- --- RPCs do Sorteio ---

-- Mesmo corpo da versão de 20261003150000_event_sort.sql, com o bloqueio por pendência,
-- a camada no lugar da zona para o motor e o retrato das subdivisões.
create or replace function public.prepare_event_sort(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_sort public.event_sort%rowtype;
  v_roster jsonb;
  v_signature text;
  v_players jsonb;
  v_gks uuid[];
  v_fixed uuid[];
  v_result jsonb;
  v_team record;
  v_team_id uuid;
  v_had_sort boolean;
begin
  -- a trava comum do Racha, a mesma de Presença, Avulso, Membro e edição do Evento
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);

  select * into v_sort from public.event_sort s where s.event_id = p_event_id;
  v_had_sort := found;
  if v_had_sort and v_sort.status = 'confirmed' then
    raise exception 'already_confirmed';
  end if;
  if v_event.status <> 'upcoming' then
    raise exception 'event_not_upcoming';
  end if;

  v_roster := private.event_sort_roster(p_event_id);
  v_signature := private.event_sort_signature(p_event_id, v_roster);

  perform private.assert_no_position_detail_pending(p_event_id, v_roster);

  select coalesce(jsonb_agg(e || jsonb_build_object(
      'main', private.position_layer(
        (e ->> 'main')::public.position, (e ->> 'main_detail')::public.position_detail, v_event.outfield_per_team
      ),
      'sec', private.position_layer(
        (e ->> 'sec')::public.position, (e ->> 'sec_detail')::public.position_detail, v_event.outfield_per_team
      )
    )), '[]'::jsonb) into v_players
  from jsonb_array_elements(v_roster) as e where e ->> 'plays_as' = 'OUTFIELD';
  select coalesce(array_agg((e ->> 'id')::uuid), '{}'::uuid[]) into v_gks
  from jsonb_array_elements(v_roster) as e where e ->> 'plays_as' = 'GOALKEEPER';

  if jsonb_array_length(v_players) < 6 then
    raise exception 'not_enough_players';
  end if;

  if v_had_sort and v_sort.signature = v_signature then
    v_fixed := v_sort.leftover_ids;
  end if;

  v_result := private.sort_teams(
    v_players, v_gks, v_event.outfield_per_team, v_event.consider_position, v_fixed
  );

  insert into public.event_sort as s (
    event_id, signature, leftover_ids, mode, goalkeepers_per_team, balance_score,
    balance_label, balance_diff, super_diff, capped_by_super, super_warning
  ) values (
    p_event_id, v_signature,
    array(select x::uuid from jsonb_array_elements_text(v_result -> 'leftovers') as x),
    v_result ->> 'mode',
    (v_result -> 'goalkeepers' ->> 'per_team')::boolean,
    (v_result -> 'balance' ->> 'score')::numeric,
    v_result -> 'balance' ->> 'label',
    (v_result -> 'balance' ->> 'diff')::smallint,
    (v_result -> 'balance' ->> 'super_diff')::smallint,
    (v_result -> 'balance' ->> 'capped_by_super')::boolean,
    v_result -> 'super_warning'
  )
  on conflict (event_id) do update set
    signature = excluded.signature,
    version = s.version + 1,
    leftover_ids = excluded.leftover_ids,
    mode = excluded.mode,
    goalkeepers_per_team = excluded.goalkeepers_per_team,
    balance_score = excluded.balance_score,
    balance_label = excluded.balance_label,
    balance_diff = excluded.balance_diff,
    super_diff = excluded.super_diff,
    capped_by_super = excluded.capped_by_super,
    super_warning = excluded.super_warning,
    generated_at = now();

  delete from public.event_sort_goalkeeper g where g.event_id = p_event_id;
  delete from public.event_sort_team t where t.event_id = p_event_id;

  for v_team in
    select t.value as team, t.ord::integer as ord
    from jsonb_array_elements(v_result -> 'teams') with ordinality as t(value, ord)
  loop
    insert into public.event_sort_team (event_id, team_number, queue_order)
    values (p_event_id, v_team.ord, v_team.ord)
    returning id into v_team_id;

    insert into public.event_sort_team_player (
      event_id, team_id, profile_id, guest_id, stars_snapshot,
      is_super_star_snapshot, primary_position_snapshot, secondary_position_snapshot,
      primary_position_detail_snapshot, secondary_position_detail_snapshot
    )
    select p_event_id, v_team_id,
      case when r.kind = 'member' then r.id end,
      case when r.kind = 'guest' then r.id end,
      r.stars, r.super, r.main, r.sec, r.main_detail, r.sec_detail
    from jsonb_to_recordset(v_roster) as r(
      kind text, id uuid, stars smallint, super boolean, main public.position, sec public.position,
      main_detail public.position_detail, sec_detail public.position_detail
    )
    where r.id in (
      select x::uuid from jsonb_array_elements_text(v_team.team -> 'player_ids') as x
    );

    insert into public.event_sort_goalkeeper (event_id, team_id, profile_id, guest_id)
    select p_event_id, v_team_id,
      case when r.kind = 'member' then r.id end,
      case when r.kind = 'guest' then r.id end
    from jsonb_to_recordset(v_roster) as r(kind text, id uuid)
    where r.id = (v_result -> 'goalkeepers' -> 'by_team' ->> (v_team.ord - 1))::uuid;
  end loop;

  insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id, guest_id)
  select p_event_id, q.ord::smallint,
    case when r.kind = 'member' then r.id end,
    case when r.kind = 'guest' then r.id end
  from jsonb_array_elements_text(v_result -> 'goalkeepers' -> 'queue')
    with ordinality as q(id, ord)
  join jsonb_to_recordset(v_roster) as r(kind text, id uuid) on r.id = q.id::uuid;

  return private.event_sort_proposal_json(p_event_id);
end $$;

-- Mesmo corpo da versão de 20261003150000_event_sort.sql, com o bloqueio por pendência antes
-- da assinatura: completar ou apagar uma subdivisão também muda a assinatura, e a mensagem
-- com os nomes diz mais que "a lista mudou".
create or replace function public.confirm_event_sort(p_event_id uuid, p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_sort public.event_sort%rowtype;
  v_roster jsonb;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);

  select * into v_sort from public.event_sort s where s.event_id = p_event_id;
  if found and v_sort.status = 'confirmed' then
    raise exception 'already_confirmed';
  end if;
  if v_event.status <> 'upcoming' then
    raise exception 'event_not_upcoming';
  end if;
  if not found
     or (select count(*) from public.event_sort_team t where t.event_id = p_event_id) < 2 then
    raise exception 'no_proposal';
  end if;
  v_roster := private.event_sort_roster(p_event_id);
  perform private.assert_no_position_detail_pending(p_event_id, v_roster);
  if v_sort.signature <> private.event_sort_signature(p_event_id, v_roster) then
    raise exception 'roster_changed';
  end if;
  if v_sort.version is distinct from p_version then
    raise exception 'proposal_outdated';
  end if;

  update public.event_sort s set
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = (select auth.uid())
  where s.event_id = p_event_id;

  update public.event e set status = 'active' where e.id = p_event_id;

  return private.event_sort_published_json(p_event_id);
end $$;

-- Mesmo corpo da versão de 20261003170000_event_sort_after.sql; o retrato ganha as
-- subdivisões de agora, lidas do Membro ou do Avulso (a assinatura fica a mesma para
-- Inclusão e Volta não mudarem).
create or replace function private.event_sort_place_player(
  p_event_id uuid,
  p_profile_id uuid,
  p_guest_id uuid,
  p_plays_as public.plays_as,
  p_stars smallint,
  p_super boolean,
  p_main public.position,
  p_sec public.position
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per_team smallint;
  v_team_id uuid;
  v_main_detail public.position_detail;
  v_sec_detail public.position_detail;
begin
  if p_plays_as = 'GOALKEEPER' then
    insert into public.event_sort_goalkeeper (event_id, queue_order, profile_id, guest_id)
    values (
      p_event_id,
      (select coalesce(max(k.queue_order), 0) + 1 from public.event_sort_goalkeeper k where k.event_id = p_event_id),
      p_profile_id, p_guest_id
    );
  else
    select e.outfield_per_team into v_per_team from public.event e where e.id = p_event_id;

    if p_profile_id is not null then
      select m.primary_position_detail, m.secondary_position_detail into v_main_detail, v_sec_detail
      from public.member m
      join public.event e on e.racha_id = m.racha_id
      where e.id = p_event_id and m.profile_id = p_profile_id;
    else
      select g.primary_position_detail, g.secondary_position_detail into v_main_detail, v_sec_detail
      from public.event_guest g where g.id = p_guest_id;
    end if;

    select t.id into v_team_id
    from public.event_sort_team t
    where t.event_id = p_event_id and t.queue_order is not null
      and (select count(*) from public.event_sort_team_player p
           where p.team_id = t.id and p.left_at is null) < v_per_team
    order by t.queue_order
    limit 1;

    if v_team_id is null then
      insert into public.event_sort_team (event_id, team_number, queue_order)
      select p_event_id, coalesce(max(t.team_number), 0) + 1, coalesce(max(t.queue_order), 0) + 1
      from public.event_sort_team t where t.event_id = p_event_id
      returning id into v_team_id;
    end if;

    insert into public.event_sort_team_player (
      event_id, team_id, profile_id, guest_id, stars_snapshot,
      is_super_star_snapshot, primary_position_snapshot, secondary_position_snapshot,
      primary_position_detail_snapshot, secondary_position_detail_snapshot
    ) values (
      p_event_id, v_team_id, p_profile_id, p_guest_id, p_stars, p_super, p_main, p_sec,
      v_main_detail, v_sec_detail
    );
  end if;

  perform private.event_sort_rebalance_goalkeepers(p_event_id);
end $$;

-- Mesmo corpo da versão de 20261003190000_event_sort_attended_only.sql, com o bloqueio por
-- pendência de quem entra. Só a pessoa incluída é conferida: um confirmado sem Time pendente
-- não pode travar a Inclusão de outro.
create or replace function public.include_event_sort_member(p_event_id uuid, p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_member public.member%rowtype;
  v_att public.event_attendance%rowtype;
  v_holds_spot boolean := false;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

  select * into v_member from public.member m
  where m.racha_id = v_event.racha_id and m.profile_id = p_profile_id and m.is_active;
  if not found then
    raise exception 'not_member';
  end if;

  select * into v_att from public.event_attendance ea
  where ea.event_id = p_event_id and ea.profile_id = p_profile_id
  for update;
  if found and v_att.status = 'left' then
    raise exception 'use_return';
  end if;
  if found and v_att.status = 'confirmed' then
    -- já em Time ou no gol (ou com passagem encerrada): não é caso de Inclusão
    if exists (
      select 1 from public.event_sort_team_player tp
      where tp.event_id = p_event_id and tp.person_id = p_profile_id
    ) or exists (
      select 1 from public.event_sort_goalkeeper k
      where k.event_id = p_event_id and k.person_id = p_profile_id
    ) then
      raise exception 'already_participating';
    end if;
    v_holds_spot := true;
  end if;

  perform private.assert_no_position_detail_pending(p_event_id, jsonb_build_array(jsonb_build_object(
    'kind', 'member', 'id', v_member.profile_id, 'plays_as', v_member.plays_as,
    'main', v_member.primary_position, 'main_detail', v_member.primary_position_detail
  )));

  if not v_holds_spot then
    if v_event.spot_limit is not null
       and private.event_occupancy(p_event_id) >= v_event.spot_limit then
      raise exception 'spot_limit';
    end if;

    insert into public.event_attendance (event_id, profile_id, status)
    values (p_event_id, p_profile_id, 'confirmed')
    on conflict (event_id, profile_id) do update set status = 'confirmed', waitlisted_at = null;
    perform private.sync_monthly_coverage_for_member(p_event_id, p_profile_id);
    perform private.mark_paid_fact_had_slot(p_event_id, p_profile_id);
  end if;

  perform private.set_member_attended(p_event_id, p_profile_id, true);

  perform private.event_sort_place_player(
    p_event_id, p_profile_id, null, v_member.plays_as, v_member.stars,
    v_member.is_super_star, v_member.primary_position, v_member.secondary_position
  );

  return private.event_sort_published_json(p_event_id);
end $$;

-- A assinatura nova pede drop; os parâmetros novos têm default, como em add_guest.
drop function public.include_event_sort_guest(
  uuid, text, public.plays_as, public."position", public."position", smallint, boolean
);

-- Mesmo corpo da versão de 20261003190000_event_sort_attended_only.sql, com as subdivisões do
-- Avulso validadas como em add_guest e o bloqueio por pendência do Avulso criado (o erro desfaz
-- o insert).
create function public.include_event_sort_guest(
  p_event_id uuid,
  p_display_name text,
  p_plays_as public.plays_as,
  p_primary_position public."position",
  p_secondary_position public."position",
  p_stars smallint,
  p_is_super_star boolean,
  p_primary_position_detail public.position_detail default null,
  p_secondary_position_detail public.position_detail default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_guest public.event_guest%rowtype;
  v_stars smallint;
  v_super boolean;
  v_primary_detail public.position_detail;
  v_secondary_detail public.position_detail;
begin
  v_event := private.lock_event_for_attendance(p_event_id);
  perform private.assert_event_sort_conductor(v_event);
  perform private.assert_event_sort_operable(v_event);

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

  if p_plays_as = 'OUTFIELD' and v_event.outfield_per_team >= 8 then
    if (p_primary_position in ('DEFENDER', 'MIDFIELDER') and p_primary_position_detail is null)
       or (p_secondary_position in ('DEFENDER', 'MIDFIELDER') and p_secondary_position_detail is null) then
      raise exception 'position_detail_required';
    end if;
    if not (private.position_detail_fits(p_primary_position, p_primary_position_detail)
            and private.position_detail_fits(p_secondary_position, p_secondary_position_detail)) then
      raise exception 'position_detail_mismatch';
    end if;
    v_primary_detail := p_primary_position_detail;
    v_secondary_detail := p_secondary_position_detail;
  end if;

  insert into public.event_guest (
    event_id, display_name, plays_as, primary_position, secondary_position, stars, is_super_star,
    did_attend, primary_position_detail, secondary_position_detail
  ) values (
    p_event_id, btrim(p_display_name), p_plays_as, p_primary_position, p_secondary_position,
    v_stars, v_super, true, v_primary_detail, v_secondary_detail
  ) returning * into v_guest;

  perform private.assert_no_position_detail_pending(p_event_id, jsonb_build_array(jsonb_build_object(
    'kind', 'guest', 'id', v_guest.id, 'plays_as', v_guest.plays_as,
    'main', v_guest.primary_position, 'main_detail', v_guest.primary_position_detail
  )));

  perform private.event_sort_place_player(
    p_event_id, null, v_guest.id, v_guest.plays_as, v_guest.stars,
    v_guest.is_super_star, v_guest.primary_position, v_guest.secondary_position
  );

  return private.event_sort_published_json(p_event_id);
end $$;

revoke execute on function public.include_event_sort_guest(
  uuid, text, public.plays_as, public."position", public."position", smallint, boolean,
  public.position_detail, public.position_detail
) from public, anon;
grant execute on function public.include_event_sort_guest(
  uuid, text, public.plays_as, public."position", public."position", smallint, boolean,
  public.position_detail, public.position_detail
) to authenticated;

-- --- leituras ---

-- Mesmo corpo da versão de 20261003170000_event_sort_after.sql, com primary_layer no fim:
-- a camada da principal pelo tamanho de Time do Evento (nula = pendente; Goleiro sem camada).
drop function public.list_event_attendance(uuid);

create function public.list_event_attendance(p_event_id uuid)
returns table (
  kind text,
  profile_id uuid,
  guest_id uuid,
  status public.attendance_status,
  queue_position integer,
  display_name text,
  did_attend boolean,
  is_paid_effective boolean,
  is_monthly_pass boolean,
  cash_paid_amount integer,
  credit_applied_amount integer,
  plays_as public.plays_as,
  stars smallint,
  is_super_star boolean,
  avatar_path text,
  primary_position public."position",
  secondary_position public."position",
  role public.member_role,
  credit_balance integer,
  present_payer_count integer,
  payer_target integer,
  event_status public.event_status,
  my_credit_balance integer,
  sort_confirmed boolean,
  primary_layer text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event public.event%rowtype;
  v_role public.member_role;
  v_year_month text;
  v_uid uuid := (select auth.uid());
  v_present integer;
  v_my_credit integer;
  v_sorted boolean;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  if public.my_racha_role(v_event.racha_id) is null then
    raise exception 'not_member';
  end if;

  v_role := public.my_racha_role(v_event.racha_id);
  v_year_month := private.event_civil_year_month(v_event.starts_on, v_event.starts_at);
  v_present := private.count_present_payers(p_event_id);
  v_my_credit := private.credit_balance(v_event.racha_id, v_uid);
  v_sorted := private.event_sort_confirmed(p_event_id);

  return query
    select
      'member'::text,
      ea.profile_id,
      null::uuid,
      ea.status,
      case when ea.status = 'waitlisted'
        then private.my_waitlist_position(p_event_id, ea.profile_id)
        else null
      end,
      p.display_name,
      ea.did_attend,
      (
        private.member_has_event_monthly_pass(p_event_id, ea.profile_id)
        or coalesce(f.paid_marked_at is not null, false)
        or coalesce(f.monthly_coverage_month = v_year_month, false)
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false)
      ),
      private.member_has_event_monthly_pass(p_event_id, ea.profile_id),
      f.cash_paid_amount,
      f.credit_applied_amount,
      m.plays_as,
      m.stars,
      m.is_super_star,
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role,
      case
        when v_role in ('OWNER', 'ADMIN') then private.credit_balance(v_event.racha_id, ea.profile_id)
        when ea.profile_id = v_uid then v_my_credit
        else null
      end,
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit,
      v_sorted,
      private.position_layer(m.primary_position, m.primary_position_detail, v_event.outfield_per_team)
    from public.event_attendance ea
    join public.profile p on p.id = ea.profile_id
    join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id and m.is_active
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = ea.profile_id
    where ea.event_id = p_event_id
      and ea.status in ('confirmed', 'waitlisted', 'left')
    union all
    select
      'member'::text,
      ea.profile_id,
      null::uuid,
      ea.status,
      null::integer,
      p.display_name,
      ea.did_attend,
      coalesce(f.paid_marked_at is not null, false)
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false),
      false,
      f.cash_paid_amount,
      f.credit_applied_amount,
      m.plays_as,
      m.stars,
      m.is_super_star,
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role,
      case
        when v_role in ('OWNER', 'ADMIN') then private.credit_balance(v_event.racha_id, ea.profile_id)
        when ea.profile_id = v_uid then v_my_credit
        else null
      end,
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit,
      v_sorted,
      private.position_layer(m.primary_position, m.primary_position_detail, v_event.outfield_per_team)
    from public.event_attendance ea
    join public.profile p on p.id = ea.profile_id
    join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = ea.profile_id
    left join public.event_payment_fact f
      on f.event_id = p_event_id and f.profile_id = ea.profile_id
    where ea.event_id = p_event_id
      and ea.status = 'cancelled'
      and coalesce(v_role in ('OWNER', 'ADMIN'), false)
    union all
    -- fatos sem attendance (saída/expulsão), só admin
    select
      'member'::text,
      f.profile_id,
      null::uuid,
      null::public.attendance_status,
      null::integer,
      p.display_name,
      f.did_attend,
      (
        f.paid_marked_at is not null
        or coalesce(f.cash_paid_amount + f.credit_applied_amount > 0, false)
        or f.monthly_coverage_month is not null
      ),
      coalesce(f.monthly_coverage_month = v_year_month, false),
      f.cash_paid_amount,
      f.credit_applied_amount,
      coalesce(m.plays_as, 'OUTFIELD'::public.plays_as),
      m.stars,
      coalesce(m.is_super_star, false),
      p.avatar_path,
      m.primary_position,
      m.secondary_position,
      m.role,
      private.credit_balance(v_event.racha_id, f.profile_id),
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit,
      v_sorted,
      private.position_layer(m.primary_position, m.primary_position_detail, v_event.outfield_per_team)
    from public.event_payment_fact f
    join public.profile p on p.id = f.profile_id
    left join public.member m
      on m.racha_id = v_event.racha_id and m.profile_id = f.profile_id
    where f.event_id = p_event_id
      and coalesce(v_role in ('OWNER', 'ADMIN'), false)
      and not exists (
        select 1 from public.event_attendance ea
        where ea.event_id = p_event_id and ea.profile_id = f.profile_id
      )
    union all
    select
      'guest'::text,
      null::uuid,
      g.id,
      case when g.left_at is null then 'confirmed' else 'left' end::public.attendance_status,
      null::integer,
      g.display_name,
      g.did_attend,
      g.is_paid,
      false,
      case when g.is_paid then v_event.price else null end,
      null::integer,
      g.plays_as,
      g.stars,
      g.is_super_star,
      null::text,
      g.primary_position,
      g.secondary_position,
      null::public.member_role,
      null::integer,
      v_present,
      v_event.payer_target,
      v_event.status,
      v_my_credit,
      v_sorted,
      private.position_layer(g.primary_position, g.primary_position_detail, v_event.outfield_per_team)
    from public.event_guest g
    where g.event_id = p_event_id
    order by 1, 4 nulls last, 5 nulls last, 6;
end $$;

revoke execute on function public.list_event_attendance(uuid) from public, anon;
grant execute on function public.list_event_attendance(uuid) to authenticated;

-- Mesmo corpo da versão de 20260930024629_approve_join_request.sql, com as subdivisões no fim
-- (a tela de edição do Membro mostra e grava as duas).
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
  secondary_position_detail public.position_detail
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
      m.primary_position_detail, m.secondary_position_detail
    from public.member m
    join public.profile p on p.id = m.profile_id
    where m.racha_id = p_racha_id and m.is_active;
end $$;

revoke execute on function public.list_racha_members(uuid) from public, anon;
grant execute on function public.list_racha_members(uuid) to authenticated;

-- O convite passa a dizer o tamanho de Time: quem pede para entrar num Racha 8+ escolhe a
-- subdivisão na Solicitação, e o não-Membro não lê o Racha pela RLS. Muda o tipo de retorno:
-- drop + create, com o mesmo corpo e os mesmos grants.
drop function public.get_invite(text);

create function public.get_invite(p_code text)
returns table (
  racha_id uuid,
  name text,
  member_count int,
  owner_name text,
  min_age smallint,
  my_status text,
  outfield_per_team smallint
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    r.id,
    r.name,
    (select count(*)::int from public.member m
      where m.racha_id = r.id and m.is_active),
    (select p.display_name from public.member m
      join public.profile p on p.id = m.profile_id
      where m.racha_id = r.id and m.role = 'OWNER' and m.is_active),
    r.min_age,
    case
      when public.is_racha_member(r.id) then 'MEMBER'
      -- aprovada sem Membro ativo não acontece: sair apaga a Solicitação (4.4)
      else (select jr.status::text from public.join_request jr
            where jr.racha_id = r.id
              and jr.profile_id = (select auth.uid())
              and jr.status <> 'APPROVED')
    end,
    r.outfield_per_team
  from public.racha r
  where r.invite_code = upper(trim(p_code));
$$;

revoke execute on function public.get_invite(text) from public, anon;
grant execute on function public.get_invite(text) to authenticated;
