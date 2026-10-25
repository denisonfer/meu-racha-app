---
title: Erro novo de RPC precisa entrar em RAISE_EXCEPTION_CODES
author: Denisonfer
date: 2026-10-24
branch: main
cost: { minutes: 20, tokens: 131298 }
touches:
  - apps/mobile/src/features/profile/hooks/use-my-profile.ts
  - apps/mobile/src/features/racha/components/pix-key-holder-field.tsx
  - apps/mobile/src/features/racha/hooks/use-pix-key-mode.ts
  - apps/mobile/src/features/racha/hooks/use-set-event-pix-key.ts
  - apps/mobile/src/features/racha/hooks/use-set-racha-pix-key.ts
  - apps/mobile/src/features/racha/racha-api.ts
  - apps/mobile/src/features/racha/racha-types.ts
  - apps/mobile/src/features/racha/screens/event/event-form.tsx
  - apps/mobile/src/features/racha/screens/event/use-event-screen.ts
  - apps/mobile/src/features/racha/screens/logistics/logistics-form.tsx
---

## Decided

- Um `raise exception 'codigo'` do plpgsql chega ao app como `P0001`. O `toCodedError` (`apps/mobile/src/features/racha/racha-api.ts`) só devolve o texto em `error.message` quando o código está na lista `RAISE_EXCEPTION_CODES`.

## Tried and ruled out

- No Reforço escolhido (24/10), o hook comparava `error.message === "entering_not_active"` sem incluir o código na lista. Typecheck, lint, `bun test` e `bun db:test` passaram, e o ramo de erro nunca rodava. Só a revisão final pegou.

## Watch out

- Toda migration que cria um código de erro novo, consumido pelo app pelo nome, precisa da linha em `RAISE_EXCEPTION_CODES`. Não existe teste de `toCodedError` que pegue essa falta.
