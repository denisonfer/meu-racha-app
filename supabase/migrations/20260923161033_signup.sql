create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.raw_user_meta_data ->> 'birth_date')::date
       > current_date - interval '16 years' then
    raise exception 'under_minimum_age';
  end if;

  insert into public.profile (
    id, display_name, birth_date,
    plays_as, primary_position, secondary_position, terms_accepted_at
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    (new.raw_user_meta_data ->> 'birth_date')::date,
    (new.raw_user_meta_data ->> 'plays_as')::public.plays_as,
    (new.raw_user_meta_data ->> 'primary_position')::public.position,
    (new.raw_user_meta_data ->> 'secondary_position')::public.position,
    now()
  );

  return new;
end $$;

revoke execute on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create policy "profile: cada um edita o próprio"
  on public.profile for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
