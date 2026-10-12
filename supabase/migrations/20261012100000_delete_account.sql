-- Apagar conta (regra 2.5): sai de todos os Rachas, anonimiza o Perfil e apaga a
-- conta de login. O histórico aponta para o Perfil sem cascata; por isso o Perfil
-- deixa de depender de auth.users e fica, só com "Conta apagada".

alter table public.profile drop constraint profile_id_fkey;

alter table public.profile alter column birth_date drop not null;

-- Perfil anonimizado não tem Posição, mesmo tendo sido jogador de linha.
alter table public.profile drop constraint position_matches_plays_as;
alter table public.profile add constraint position_matches_plays_as check (
  (anonymized_at is not null and primary_position is null and secondary_position is null)
  or case plays_as
    when 'GOALKEEPER' then primary_position is null and secondary_position is null
    when 'OUTFIELD' then primary_position is not null and
      case
        when primary_position = 'ANY' then secondary_position is null
        else secondary_position is not null
          and secondary_position <> 'ANY'
          and secondary_position <> primary_position
      end
  end
);

-- A Storage API só lista e apaga o que o select da policy enxerga. Cada um vê só a
-- própria pasta; a dos outros continua fora de listagem.
create policy "avatars: cada um lista a própria pasta"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Efeitos do Deixar o Racha, sem os bloqueios: o leave_racha e o delete_my_account
-- conferem os bloqueios antes de chamar.
create function private.leave_racha_effects(p_racha_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.cleanup_member_attendance(p_racha_id, p_profile_id);

  update public.member m set is_active = false
    where m.racha_id = p_racha_id and m.profile_id = p_profile_id;

  delete from public.join_request jr
    where jr.racha_id = p_racha_id and jr.profile_id = p_profile_id;
end $$;

revoke execute on function private.leave_racha_effects(uuid, uuid)
  from public, anon, authenticated;

-- Corpo de 20261002171527; os efeitos passam para private.leave_racha_effects.
create or replace function public.leave_racha(p_racha_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_role public.member_role;
begin
  perform 1 from public.racha r where r.id = p_racha_id for update;

  v_my_role := public.my_racha_role(p_racha_id);
  if v_my_role is null then
    raise exception 'not_member';
  end if;
  if v_my_role = 'OWNER' then
    raise exception 'owner_cannot_leave';
  end if;
  if exists (
    select 1 from public.event e
    where e.racha_id = p_racha_id
      and e.status = 'active'
      and e.conductor_id = (select auth.uid())
  ) then
    raise exception 'conductor';
  end if;

  perform private.leave_racha_effects(p_racha_id, (select auth.uid()));
end $$;

create function public.get_account_deletion_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- Token antigo de conta já apagada ainda vale até expirar.
  if v_uid is null or not exists (
    select 1 from public.profile p where p.id = v_uid and p.anonymized_at is null
  ) then
    raise exception 'not_allowed';
  end if;

  return jsonb_build_object(
    'racha_count', (
      select count(*) from public.member m where m.profile_id = v_uid and m.is_active
    ),
    'owned_rachas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'member_count', (
            select count(*) from public.member m2 where m2.racha_id = r.id and m2.is_active
          )
        )
        order by r.name
      )
      from public.member m
      join public.racha r on r.id = m.racha_id
      where m.profile_id = v_uid and m.is_active and m.role = 'OWNER'
    ), '[]'::jsonb),
    'conducting', coalesce((
      select jsonb_agg(
        jsonb_build_object('racha_id', r.id, 'racha_name', r.name, 'event_id', e.id)
        order by r.name
      )
      from public.event e
      join public.racha r on r.id = e.racha_id
      where e.status = 'active' and e.conductor_id = v_uid
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function public.get_account_deletion_check() from public, anon;
grant execute on function public.get_account_deletion_check() to authenticated;

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_racha_id uuid;
begin
  if v_uid is null or not exists (
    select 1 from public.profile p where p.id = v_uid and p.anonymized_at is null
  ) then
    raise exception 'not_allowed';
  end if;

  -- Mesma trava do leave_racha, em ordem fixa para não cruzar com outra transação.
  perform 1 from public.racha r
    where r.id in (
      select m.racha_id from public.member m where m.profile_id = v_uid and m.is_active
    )
    order by r.id
    for update;

  if exists (
    select 1 from public.member m
    where m.profile_id = v_uid and m.is_active and m.role = 'OWNER'
  ) or exists (
    select 1 from public.event e where e.status = 'active' and e.conductor_id = v_uid
  ) then
    raise exception 'account_deletion_blocked';
  end if;

  for v_racha_id in
    select m.racha_id from public.member m
    where m.profile_id = v_uid and m.is_active
    order by m.racha_id
  loop
    perform private.leave_racha_effects(v_racha_id, v_uid);
  end loop;

  delete from public.join_request jr where jr.profile_id = v_uid;
  delete from public.push_token t where t.profile_id = v_uid;
  delete from public.notification n where n.recipient_id = v_uid;
  delete from public.racha_notice rn where rn.profile_id = v_uid;

  update public.profile set
    display_name = 'Conta apagada',
    avatar_path = null,
    birth_date = null,
    primary_position = null,
    secondary_position = null,
    anonymized_at = now()
  where id = v_uid;

  -- Sessões e identidades caem em cascata; o e-mail fica livre.
  delete from auth.users u where u.id = v_uid;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
