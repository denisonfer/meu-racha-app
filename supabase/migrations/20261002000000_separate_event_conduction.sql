-- O Condutor organiza o evento antes do sorteio; apenas a confirmação futura do
-- sorteio mudará upcoming para active.
alter table public.event drop constraint event_status_shape;
alter table public.event add constraint event_status_shape check (
  (status = 'upcoming' and ended_at is null and ended_by is null)
  or (status = 'active' and conductor_id is not null and ended_at is null and ended_by is null)
  or (status = 'finished' and conductor_id is not null and ended_at is not null and ended_by is not null)
);

-- Remove a transição manual inclusive para clientes antigos que ainda chamam a RPC.
drop function public.start_event(uuid);

create function public.assume_event_conduction(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.event%rowtype;
begin
  select * into v_event from public.event e where e.id = p_event_id;
  if not found then
    raise exception 'not_allowed';
  end if;

  -- A mesma trava das alterações de membros e evento serializa duas tentativas
  -- de assumir, uma saída/expulsão e a futura confirmação do sorteio.
  perform 1 from public.racha r where r.id = v_event.racha_id for update;

  select * into v_event from public.event e where e.id = p_event_id;
  if not found or v_event.status not in ('upcoming', 'active') then
    raise exception 'not_allowed';
  end if;
  if not coalesce(public.my_racha_role(v_event.racha_id) in ('OWNER', 'ADMIN'), false) then
    raise exception 'not_allowed';
  end if;

  update public.event e set conductor_id = v_uid where e.id = p_event_id;
end $$;

revoke execute on function public.assume_event_conduction(uuid) from public, anon;
grant execute on function public.assume_event_conduction(uuid) to authenticated;

-- Todas as saídas e mudanças de cargo passam pela tabela member. Um Condutor
-- de evento ainda agendado deixa de constar quando perde o cargo ou o vínculo.
create function public.clear_ineligible_upcoming_conductor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and old.role in ('OWNER', 'ADMIN')
     and (not new.is_active or new.role = 'PLAYER') then
    update public.event e set conductor_id = null
      where e.racha_id = new.racha_id
        and e.status = 'upcoming'
        and e.conductor_id = new.profile_id;
  end if;
  return new;
end $$;

revoke execute on function public.clear_ineligible_upcoming_conductor() from public, anon, authenticated;

create trigger member_clear_ineligible_upcoming_conductor
  after update of is_active, role on public.member
  for each row execute function public.clear_ineligible_upcoming_conductor();

-- Expulsão agora usa a mesma trava do Racha da atribuição de Condutor.
create or replace function public.expel_member(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role;
  v_target public.member%rowtype;
begin
  perform 1 from public.racha r where r.id = p_racha_id for update;
  v_my_role := public.my_racha_role(p_racha_id);
  if v_my_role is null or v_my_role = 'PLAYER' or p_profile_id = (select auth.uid()) then
    raise exception 'not_allowed';
  end if;

  select * into v_target from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
    for update;
  if not found then
    raise exception 'not_member';
  end if;

  if v_target.role = 'OWNER' or (v_my_role = 'ADMIN' and v_target.role <> 'PLAYER') then
    raise exception 'not_allowed';
  end if;

  update public.member m set is_active = false where m.id = v_target.id;

  delete from public.join_request jr
    where jr.racha_id = p_racha_id and jr.profile_id = p_profile_id;

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select p_profile_id, r.id, r.name, 'REMOVED'
    from public.racha r where r.id = p_racha_id;
end $$;

-- A Passagem conserva a regra anterior: quando o Dono conduz, entrega também
-- a condução. Isso agora vale mesmo enquanto o Evento continua agendado.
create or replace function public.transfer_ownership(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target public.member%rowtype;
begin
  perform 1 from public.racha r where r.id = p_racha_id for update;

  if public.my_racha_role(p_racha_id) is distinct from 'OWNER' or p_profile_id = v_uid then
    raise exception 'not_allowed';
  end if;

  perform pg_advisory_xact_lock(hashtext('create_racha:' || p_profile_id::text));

  select * into v_target from public.member m
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id and m.is_active
    for update;
  if not found then
    raise exception 'not_member';
  end if;

  if exists (
    select 1 from public.member m
    where m.profile_id = p_profile_id and m.role = 'OWNER' and m.is_active
  ) then
    raise exception 'plan_owner_limit';
  end if;

  update public.member m set role = 'ADMIN'
    where m.racha_id = p_racha_id and m.profile_id = v_uid;
  update public.member m set role = 'OWNER' where m.id = v_target.id;

  update public.event e
    set conductor_id = p_profile_id
    where e.racha_id = p_racha_id
      and e.status in ('upcoming', 'active')
      and e.conductor_id = v_uid;

  delete from public.racha_notice n
    where n.profile_id = (select auth.uid())
      and n.racha_id = p_racha_id
      and n.kind = 'OWNERSHIP_RECEIVED';

  insert into public.racha_notice (profile_id, racha_id, racha_name, kind)
    select p_profile_id, r.id, r.name, 'OWNERSHIP_RECEIVED'
    from public.racha r where r.id = p_racha_id;
end $$;
