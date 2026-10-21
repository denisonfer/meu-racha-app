---
title: "Homolog e DevHub: implementação e armadilhas"
author: Denisonfer
date: 2026-10-21
branch: main
cost: { minutes: 30, tokens: 199475 }
touches:
  - ".superpowers/sdd/2026-10-21-homolog-e-devhub/progress.md"
  - ".superpowers/sdd/2026-10-21-homolog-e-devhub/common.md"
---

## Decided

Fatia implementada em 21/10/2026, sem commit (aguarda aval do dono). lib/resolve-environment.ts (puro, testado) + lib/environment.ts escolhem o Supabase antes do createClient; Edge Function devhub-staging-config só na produção; DevHub em features/dev-hub; selo EnvironmentBadge no layout raiz; reinício por reloadAppAsync do pacote expo.

## Tried and ruled out

react-native-restart e expo-updates reloadAsync (rejeita sem EAS Update no SDK 57). Teste que importa supabase.ts no bun test (puxa SecureStore nativo, não há mock): lógica testável fica em funções puras. Ler o isPending do closure para barrar duplo envio (handleSubmit do RHF é assíncrono): usar ref síncrona.

## Watch out

URL salva sem esquema faz o createClient lançar no import e trava toda abertura: validar com isAllowedSupabaseUrl. O URL do RN 0.86 não valida no construtor e o host é regex sensível a maiúscula (HTTPS:// maiúsculo vira host vazio no aparelho, aceito no bun). ESLint só deixa @supabase/* em lib e *-api.ts. Campo da chave com secureTextEntry abre AutoFill de senha no iOS. Para testar no simulador, "Homolog" local = http://127.0.0.1:54321 em supabase/functions/.env (sessão separada da do IP da rede).
