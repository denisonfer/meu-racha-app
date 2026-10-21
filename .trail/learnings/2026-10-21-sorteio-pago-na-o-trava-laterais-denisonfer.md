---
title: "Sorteio: pago não trava; laterais por lado"
author: Denisonfer
date: 2026-10-21
branch: main
cost: { minutes: 6, tokens: 104575 }
---

## Decided

- O Sorteio nunca olhou "pago": o roster (private.event_sort_roster) usa só did_attend ("veio"). Dono confirmou em 21/10/2026 que a regra fica assim.
- Em 8+ por Time, DEFENSOR passa a Zagueiro / Lateral Esquerdo / Lateral Direito (LEFT_BACK, RIGHT_BACK); cada lado é camada própria no sort_teams. Quem era FULL_BACK vira pendente (null).

## Tried and ruled out

- Tratar LE/LD como uma camada só: um Time poderia ficar com dois LE e nenhum LD.
- Mapear FULL_BACK para um lado fixo: lado errado silencioso.

## Watch out

- Enum novo: `alter type add value` não pode ser usado na mesma transação, e funções language sql validam o corpo na criação: separar em duas migrations.
- sort_teams tem o vetor de contagem dimensionado pelo número de camadas (array_fill ... array[N]) e a lista de camadas escrita à mão; sort_layer_ix e POSITION_LAYERS (domain) precisam da mesma ordem.
