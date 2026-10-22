-- Elenco do Amigos do Jardins da Serra (dev local). Não é migration.
-- Login de todo mundo: {slug}@racha.local / senha-forte
-- Dono: o superman@racha.local que já existe. Todos na linha em ANY; posição
-- e goleiro se ajustam pelo app.

begin;

create temporary table roster (
  slug text primary key,
  display_name text not null,
  stars smallint not null
);

insert into roster (slug, display_name, stars) values
  ('abraao',          'Abraão',            5),
  ('alan.menezes',    'Alan Menezes',      3),
  ('aldenor',         'Aldenor',           3),
  ('alex',            'Alex',              4),
  ('alex.guerra',     'Alex Guerra',       2),
  ('alisson',         'Alisson',           3),
  ('anderson',        'Anderson',          4),
  ('aurilano',        'Aurilano',          1),
  ('belchior',        'Belchior',          2),
  ('betinho',         'Betinho',           2),
  ('bill',            'Bill',              2),
  ('brendo',          'Brendo',            5),
  ('caniggia',        'Caniggia',          3),
  ('carlos.junior',   'Carlos Junior',     3),
  ('cleonardo',       'Cleonardo',         3),
  ('cristiano',       'Cristiano',         5),
  ('danilo',          'Danilo',            1),
  ('darlaniel',       'Darlaniel',         2),
  ('darley',          'Darley',            5),
  ('david',           'David',             3),
  ('davidson',        'Davidson',          4),
  ('denis',           'Denis',             3),
  ('diego',           'Diego',             3),
  ('edilson',         'Edilson',           1),
  ('eduardo.jr',      'Eduardo Jr',        1),
  ('edvando',         'Edvando',           4),
  ('elton',           'Elton',             2),
  ('emanuel',         'Emanuel',           3),
  ('fernando',        'Fernando',          5),
  ('fran',            'Fran',              4),
  ('geovane',         'Geovane',           3),
  ('henrique.cesar',  'Henrique Cesar',    3),
  ('igor.oliveira',   'Igor Oliveira',     3),
  ('igor.victor',     'Igor Victor',       3),
  ('jecivaldo',       'Jecivaldo',         3),
  ('john.lennon',     'John Lennon',       2),
  ('jorge.piti',      'Jorge Piti',        2),
  ('kakinho',         'Kakinho',           4),
  ('laercio',         'Laercio',           4),
  ('lailson',         'Lailson',           5),
  ('magalhaes.jr',    'Magalhaes Jr',      3),
  ('magno',           'Magno',             3),
  ('mano',            'Mano',              2),
  ('marcelo',         'Marcelo',           3),
  ('marcos.teles',    'Marcos Teles',      4),
  ('mario.helder',    'Mario Helder',      3),
  ('marlon',          'Marlon',            2),
  ('marlyson',        'Marlyson',          3),
  ('mauro',           'Mauro',             4),
  ('menague',         'Menague',           4),
  ('messias',         'Messias',           5),
  ('milton',          'Milton',            3),
  ('moraes',          'Moraes',            1),
  ('mourao',          'Mourão',            3),
  ('nil',             'Nil',               3),
  ('rafael.apolonio', 'Rafael Apolonio',   1),
  ('regis',           'Regis',             3),
  ('rogerio.lira',    'Rogerio Lira',      3),
  ('samuel',          'Samuel',            2),
  ('thiago.carvalho', 'Thiago Carvalho',   2),
  ('thiago.geladao',  'Thiago Geladao',    4),
  ('thompson',        'Thompson',          5),
  ('tiago.melo',      'Tiago Melo',        3),
  ('tony',            'Tony',              2),
  ('valdemar',        'Valdemar',          4),
  ('wladimir',        'Wladimir',          1);

create temporary table created (
  slug text primary key,
  profile_id uuid not null
);

do $$
declare
  rec record;
  v_id uuid;
  v_email text;
begin
  for rec in select * from roster loop
    v_id := gen_random_uuid();
    v_email := rec.slug || '@racha.local';

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id, 'authenticated', 'authenticated', v_email,
      crypt('senha-forte', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'display_name', rec.display_name,
        'birth_date', '1990-01-01',
        'plays_as', 'OUTFIELD',
        'primary_position', 'ANY',
        'secondary_position', null,
        'terms_accepted', true
      ),
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email),
      'email', now(), now(), now()
    );

    insert into created (slug, profile_id) values (rec.slug, v_id);
  end loop;
end $$;

do $$
declare
  v_racha uuid;
  v_owner uuid;
begin
  select id into strict v_owner from auth.users where email = 'superman@racha.local';

  insert into public.racha (name, invite_code, place)
  values ('Amigos do Jardins da Serra', 'SERRA2', 'Arena Jardins da Serra')
  returning id into v_racha;

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  values (v_racha, v_owner, 'OWNER', 'OUTFIELD', 'ANY', 3);

  insert into public.member (racha_id, profile_id, role, plays_as, primary_position, stars)
  select v_racha, c.profile_id, 'PLAYER', 'OUTFIELD', 'ANY', r.stars
  from roster r
  join created c on c.slug = r.slug;
end $$;

do $$
declare
  v_members int;
begin
  select count(*) into v_members from public.member m
    join public.racha r on r.id = m.racha_id
    where r.name = 'Amigos do Jardins da Serra';
  if v_members <> 67 then
    raise exception 'seed falhou: membros=%', v_members;
  end if;
  raise notice 'OK: 67 membros';
end $$;

commit;
