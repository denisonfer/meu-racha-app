---
title: "Explicação de termos: implementação"
author: Denisonfer
date: 2026-10-21
branch: main
cost: { minutes: 7, tokens: 73587 }
---

## Decided

- Folha única em app/(app)/term/[term].tsx → TermScreen (features/racha/screens/term). Textos em TERMS + TTerm em racha-messages.ts; termo desconhecido faz router.back().
- TermHelp (features/racha/components/term-help.tsx), exportado no index da feature: "?" (IconButton, ícone help = CircleQuestionMark) ou, com hasLabel, botão de texto "O que é X?". Ele mesmo chama router.push: é um link, não regra.
- Onde está: Overall com rótulo abaixo do Card (member-card-view e Perfil); Condutor na linha "está conduzindo" do event-card; Reforço no supporting da folha de Reforço (só antes do resultado); Inclusão, Avulso, Bolinhas e Temporada no headerRight do Screen; Volta no título da seção Saíram (prop helpTerm em SortPersonList).

## Watch out

- headerRight precisa de marginVertical/marginRight -10 em quem usa, como em edit-member.
- Linha de texto com o "?" de 44pt ao lado usa marginVertical -12 para não engordar.
- A folha de Reforço abre a do termo por cima (folha sobre folha): conferir em device.
