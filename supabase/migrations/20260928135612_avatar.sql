-- Foto do Perfil (regra 2.2). Bucket público por decisão do dono (28/09/2026):
-- quem tem o link vê; o caminho tem o id do Perfil e não é listável.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg']);

-- Cada um só escreve na própria pasta: avatars/<id do Perfil>/<arquivo>.
-- Leitura é pelo link público, sem policy de select.
create policy "avatars: cada um grava na própria pasta"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: cada um troca na própria pasta"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: cada um apaga na própria pasta"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- O Perfil guarda o caminho dentro do bucket, sem host: o mesmo valor vale
-- local e em produção. O app monta o link com getPublicUrl.
alter table public.profile rename column avatar_url to avatar_path;

alter table public.profile
  add constraint avatar_path_in_own_folder check (
    avatar_path is null or avatar_path like id::text || '/%'
  );

-- A foto é a única coisa que a pessoa grava direto no próprio Perfil.
-- O Supabase concede update em todas as colunas por padrão: tira tudo e
-- devolve só esta, senão a policy abaixo abriria display_name e birth_date.
revoke update on public.profile from authenticated, anon;
grant update (avatar_path) on public.profile to authenticated;

create policy "profile: cada um troca a própria foto"
  on public.profile for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
