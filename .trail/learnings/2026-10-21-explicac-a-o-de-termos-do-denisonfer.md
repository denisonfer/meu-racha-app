---
title: 'Explicação de termos do app ("?" + folha)'
author: Denisonfer
date: 2026-10-21
branch: main
cost: { minutes: 3, tokens: 123229 }
touches:
  - README.md
  - apps/mobile/src/app/(auth)/dev-hub.tsx
  - apps/mobile/src/app/_layout.tsx
  - apps/mobile/src/features/auth/screens/sign-in/sign-in-screen.tsx
  - apps/mobile/src/features/auth/screens/sign-in/use-sign-in-screen.ts
  - apps/mobile/src/features/dev-hub/dev-hub-api.ts
  - apps/mobile/src/features/dev-hub/index.ts
  - apps/mobile/src/features/dev-hub/screens/dev-hub/dev-hub-schema.ts
  - apps/mobile/src/features/dev-hub/screens/dev-hub/dev-hub-screen.tsx
  - apps/mobile/src/features/dev-hub/screens/dev-hub/use-dev-hub-screen.ts
---

## Decided

- Dono aprovou (21/10): "?" ao lado de termos próprios abre um BottomSheet por termo (rota com o termo no parâmetro, textos num mapa em racha-messages). Sem rodada de Claude Design: segue o design system.
- Primeira leva: Overall, Condutor, Reforço, Inclusão, Volta, Avulso, Bolinhas, Temporada. Textos curtos (até 3 frases), sem fórmula. Rascunho apresentado, aguardando aval do dono.
- Estrelas, Super Estrela e regras do Racha (Modo de Jogo, Empate, Cartão) já têm explicação em linha (stars-and-super-star-field.tsx, rules-section.tsx): ficam fora.

## Tried and ruled out

- Carrossel de onboarding, coach marks espalhados e vídeo: descartados.
- "?" no Card mini: alvo de toque pequeno demais.

## Watch out

- Não existe ícone de ajuda no ui/components/icon/icon-map.ts; precisa criar.
- Padrão de folha como rota: racha/[id]/position-detail (BOTTOM_SHEET_SCREEN_OPTIONS em app/(app)/_layout.tsx).
