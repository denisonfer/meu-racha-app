---
title: Flash branco ao navegar entre telas
author: Denisonfer
date: 2026-10-21
branch: main
cost: { minutes: 1, tokens: 46055 }
---

## Decided

- Causa: o app não passa tema para a navegação. Sem tema, o expo-router usa o DefaultTheme (fork/NavigationContainer.js), cujo background é rgb(242,242,242). Esse fundo vai para o contentStyle de cada tela e para o nativeContainerStyle do ScreenStack (NativeStackView.native.js), por isso aparece por baixo das transições.
- Correção aplicada em 22/10: ThemeProvider do expo-router no src/app/_layout.tsx com DarkTheme e background/card = theme.colors.background; "backgroundColor": "#07180F" no app.json (o expo-system-ui lê esse campo e só vale depois de prebuild + build local).

## Tried and ruled out

- Não é bug de biblioteca, é configuração que faltava. Não precisa pesquisar nas issues.

## Watch out

- Os layouts (app) e (auth) retornam null enquanto carregam a sessão, e nesse momento aparece a cor da janela nativa. Sem backgroundColor no app.json, ela fica com a cor padrão.
- As folhas (BOTTOM_SHEET_SCREEN_OPTIONS) usam contentStyle transparent de propósito: o tema não deve sobrescrever isso.
