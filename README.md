# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Push local

O gatilho de push só chama a Edge Function `send-push` quando o Vault tem os dois segredos. Sem eles, o Aviso é gravado e nenhum push sai.

1. Crie `supabase/functions/.env` (fica fora do git) com o segredo que a função confere:

   ```bash
   echo "PUSH_FUNCTION_SECRET=$(openssl rand -hex 24)" > supabase/functions/.env
   ```

2. Grave no Vault a URL da função e o mesmo segredo:

   ```bash
   docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
     -v secret="$(grep PUSH_FUNCTION_SECRET supabase/functions/.env | cut -d= -f2)" \
     -f - < supabase/snippets/push_local_secrets.sql
   ```

Depois, `bunx supabase functions serve` sobe a função. A função usa o domínio por `supabase/functions/_shared/domain-push.js`, gerado por `bun functions:build`; o `bun test` falha se ele estiver desatualizado.

## Homolog

O Homolog é um projeto Supabase à parte (`meu-racha-homolog`), usado por testadores e revisores das lojas. O build de produção não leva o config dele: o app o busca na Edge Function `devhub-staging-config` quando o testador digita a chave no DevHub (segurar a logo da tela de login por 3 segundos).

### Criar o projeto (uma vez)

1. Crie o projeto `meu-racha-homolog` na org promentech, em São Paulo. O Free permite 2 projetos ativos (somando as orgs em que você é Owner ou Admin; projeto pausado não conta) e não faz backup automático.
2. Repita a Auth da produção: site_url e redirects do pages.dev e `meuracha://**`, senha mínima 8, cadastro ligado, SMTP, template "Magic Link" com `{{ .Token }}` e limite de 30 e-mails por hora. Sem SMTP, a confirmação de e-mail e a recuperação de senha não funcionam no Homolog. O detalhe está na spec: `meu-racha-docs/docs/superpowers/specs/2026-10-21-homolog-e-devhub-design.md`.
3. Aplique as migrations e publique a `send-push` (próxima seção). Depois, configure o push igual à produção:
   - gere o `PUSH_FUNCTION_SECRET` e anote-o num gerenciador de senhas (o Vault precisa do mesmo valor), depois grave-o nos secrets da função. Use um arquivo temporário fora do repo, para o segredo não ficar no histórico do shell, e apague-o depois:

     ```bash
     bunx supabase link --project-ref <ref-do-homolog>
     echo "PUSH_FUNCTION_SECRET=$(openssl rand -hex 24)" > "$TMPDIR/homolog.env"
     cat "$TMPDIR/homolog.env"   # anote o valor
     bunx supabase secrets set --env-file "$TMPDIR/homolog.env" --project-ref <ref-do-homolog>
     rm "$TMPDIR/homolog.env"
     ```

   - no Vault (painel, ou SQL com `vault.create_secret`), os segredos `push_function_url` (a URL da `send-push` do Homolog) e `push_function_secret` (o valor anotado acima). Sem eles o gatilho não chama a função e o Homolog fica sem push.

### Rotina de publicação

O `supabase link` fica gravado no repositório. Relinke antes de cada `db push`, `deploy` ou `secrets set`, para não publicar no projeto errado. O ref da produção é `ddsxzfshtitbwpcvtgbp`; o do Homolog é `<ref-do-homolog>`.

1. Migrations e `send-push` vão primeiro para o Homolog e depois para a produção. Em cada um:

   ```bash
   bunx supabase link --project-ref <ref>
   bunx supabase db push
   bunx supabase functions deploy send-push
   ```

   Sem o Docker aberto, acrescente `--use-api` ao `functions deploy`.

2. A `devhub-staging-config` e os três secrets dela vão só para a produção. Gere a chave com `openssl rand -base64 32` e guarde-a num gerenciador de senhas. Os valores `STAGING_*` são a URL e a anon key do Homolog (painel do Homolog, em API):

   ```bash
   bunx supabase link --project-ref ddsxzfshtitbwpcvtgbp
   bunx supabase functions deploy devhub-staging-config
   ```

   Os secrets vão por arquivo temporário fora do repo, apagado depois:

   ```bash
   printf 'DEVHUB_KEY=%s\nSTAGING_SUPABASE_URL=%s\nSTAGING_SUPABASE_ANON_KEY=%s\n' \
     '<chave>' '<url-do-homolog>' '<anon-key-do-homolog>' > "$TMPDIR/devhub.env"
   bunx supabase secrets set --env-file "$TMPDIR/devhub.env" --project-ref ddsxzfshtitbwpcvtgbp
   rm "$TMPDIR/devhub.env"
   ```

3. O Free pausa o Homolog depois de 1 semana sem uso. Entre rodadas de teste, reative-o no painel.

### Loja

Cole o texto abaixo nas Notes for Review da Apple e em "Acesso ao app" do Google Play, e inclua a chave na própria nota (nunca neste repositório):

> This app includes an internal panel called DevHub, meant for testers to switch the app to our staging (homologation) environment. To open it, press and hold the logo on the sign-in screen for 3 seconds, then enter the key. The key is provided in this note. You can review the app against staging with its demo account, or against production if you prefer.
