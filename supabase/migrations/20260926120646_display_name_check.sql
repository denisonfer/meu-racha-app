-- O app aceitava "123" como nome, e a coluna é text sem limite: um nome de
-- 5000 caracteres entraria e quebraria o Card. Quem garante é o banco.
alter table public.profile
  add constraint display_name_is_reasonable check (
    char_length(display_name) between 2 and 40
    and display_name ~ '[[:alpha:]]'
  );
