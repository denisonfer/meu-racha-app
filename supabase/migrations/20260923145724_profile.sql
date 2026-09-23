-- Profile: a pessoa com conta no app (CONTEXT.md).
-- Nomes em inglês conforme docs/spec/nomenclatura.md do meu-racha-docs.
--
-- E-mail, senha e confirmação de e-mail moram em auth.users, não aqui.

create type public.plays_as as enum ('OUTFIELD', 'GOALKEEPER');
create type public.position as enum ('ANY', 'DEFENDER', 'MIDFIELDER', 'FORWARD');

create table public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  birth_date date not null,
  plays_as public.plays_as not null,
  primary_position public.position,
  secondary_position public.position,
  terms_accepted_at timestamptz not null,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),

  -- Quem joga no Gol não tem Posição; quem joga na Linha tem principal,
  -- e secundária obrigatória e diferente, exceto se a principal for ANY (TODAS).
  constraint position_matches_plays_as check (
    case plays_as
      when 'GOALKEEPER' then primary_position is null and secondary_position is null
      when 'OUTFIELD' then
        primary_position is not null
        and case
          when primary_position = 'ANY' then secondary_position is null
          else secondary_position is not null
               and secondary_position <> 'ANY'
               and secondary_position <> primary_position
        end
    end
  )
);

-- RLS ligada = nega tudo. Sem policy, ninguém lê e ninguém escreve,
-- nem com a chave pública. As permissões são adicionadas uma a uma.
alter table public.profile enable row level security;

create policy "profile: cada um lê o próprio"
  on public.profile for select
  to authenticated
  using (id = (select auth.uid()));
