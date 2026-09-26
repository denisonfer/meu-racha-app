-- Formato de username e de nome, e idade máxima: o app já barra, mas quem
-- garante é o banco — ele é o único que vale para todo cliente futuro.

-- "1234" não identifica ninguém: username precisa de letra.
alter table public.profile
  add constraint username_is_valid check (
    username ~ '^[a-z0-9_]{3,20}$'
    and username ~ '[[:alpha:]]'
  );

-- Nome começa com letra e segue com letra, espaço, apóstrofo, ponto ou hífen.
-- Antes só exigia "uma letra em algum lugar", e "!@#$%a" passava.
alter table public.profile
  drop constraint display_name_is_reasonable;

alter table public.profile
  add constraint display_name_is_reasonable check (
    char_length(display_name) between 2 and 40
    and display_name ~ '^[[:alpha:]][[:alpha:] ''.-]*$'
  );

-- 01/03/1000 passava: o gatilho só olhava o limite de baixo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_birth_date date := (new.raw_user_meta_data ->> 'birth_date')::date;
begin
  if v_birth_date > current_date - interval '16 years' then
    raise exception 'under_minimum_age';
  end if;

  if v_birth_date < current_date - interval '100 years' then
    raise exception 'implausible_birth_date';
  end if;

  insert into public.profile (
    id, username, display_name, birth_date,
    plays_as, primary_position, secondary_position, terms_accepted_at
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'display_name',
    v_birth_date,
    (new.raw_user_meta_data ->> 'plays_as')::public.plays_as,
    (new.raw_user_meta_data ->> 'primary_position')::public.position,
    (new.raw_user_meta_data ->> 'secondary_position')::public.position,
    now()
  );

  return new;
end $$;
