// Seed do E2E: cria as contas pela Admin API (o gatilho do banco faz o perfil,
// como no Cadastro) e roda o Maestro com elas. Contas novas a cada rodada: apagar
// o usuário não cascateia e o limite de rachas do Dono travaria a mesma conta.
import { createClient } from "@supabase/supabase-js";

const repoRoot = `${import.meta.dir}/../../..`;

const status = Bun.spawnSync(["bunx", "supabase", "status", "-o", "env"], {
  cwd: repoRoot,
});
const env = Object.fromEntries(
  status.stdout
    .toString()
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^(\w+)="?(.*?)"?$/);
      return match ? [[match[1], match[2]]] : [];
    })
);
if (!env.API_URL || !env.SERVICE_ROLE_KEY) {
  console.error("Supabase local fora do ar: rode bun db:start");
  process.exit(1);
}

const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function createAccount(email: string, password: string) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "Dono Teste",
      birth_date: "1990-01-01",
      plays_as: "OUTFIELD",
      primary_position: "ANY",
      secondary_position: null,
      terms_accepted: true,
    },
  });
  if (error) {
    console.error("seed do E2E falhou:", error.message);
    process.exit(1);
  }
}

const stamp = Date.now();
const email = `e2e${stamp}@meuracha.test`;
const password = crypto.randomUUID();
await createAccount(email, password);

// O Redefinir senha troca a senha: conta própria, para não derrubar os outros fluxos.
// O link sai da Admin API, sem depender do e-mail chegar; vale 10 minutos.
const resetEmail = `e2e${stamp}-reset@meuracha.test`;
await createAccount(resetEmail, crypto.randomUUID());
const { data: link, error: linkError } = await admin.auth.admin.generateLink({
  type: "recovery",
  email: resetEmail,
});
if (linkError) {
  console.error("link de recuperação do E2E falhou:", linkError.message);
  process.exit(1);
}

const maestro = Bun.spawnSync(
  [
    "maestro",
    "-p",
    "ios",
    "test",
    "-e",
    `E2E_EMAIL=${email}`,
    "-e",
    `E2E_PASSWORD=${password}`,
    "-e",
    `E2E_RESET_EMAIL=${resetEmail}`,
    "-e",
    `E2E_RESET_TOKEN=${link.properties.hashed_token}`,
    // sem argumento roda a pasta toda; com um, só aquele fluxo
    ...(process.argv.length > 2 ? process.argv.slice(2) : [import.meta.dir]),
  ],
  {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: "1" },
  }
);
process.exit(maestro.exitCode ?? 1);
