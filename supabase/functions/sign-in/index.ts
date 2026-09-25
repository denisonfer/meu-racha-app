// Login por username.
//
// O Supabase Auth só autentica por e-mail ou telefone. O username é o login do
// produto e o e-mail é privado (CONTEXT.md), então a tradução username → e-mail
// acontece AQUI, no servidor, com a service role. O app nunca vê o e-mail.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/**
 * Username inexistente e senha errada respondem exatamente isto, com o mesmo
 * status. Diferenciar os dois casos entregaria um verificador de usernames
 * válidos para quem quisesse atacar.
 */
const invalidCredentials = () =>
  Response.json({ error: "invalid_credentials" }, { status: 401 });

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    const { username, password } = await req.json().catch(() => ({}));

    if (typeof username !== "string" || typeof password !== "string") {
      return Response.json({ error: "missing_fields" }, { status: 400 });
    }

    // 1. username → id do Perfil (que é o id do usuário no Auth).
    //    Precisa da service role: a RLS só deixa cada um ler o próprio Perfil.
    const { data: profile } = await ctx.supabaseAdmin
      .from("profile")
      .select("id")
      .eq("username", username.trim().toLowerCase())
      .maybeSingle();

    if (!profile) return invalidCredentials();

    // 2. id → e-mail. O e-mail mora em auth.users, não na tabela profile.
    const { data: userData } = await ctx.supabaseAdmin.auth.admin.getUserById(
      profile.id
    );
    const email = userData?.user?.email;

    if (!email) return invalidCredentials();

    // 3. A autenticação de verdade. Só aqui a senha é verificada.
    const { data: session, error } =
      await ctx.supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error || !session.session) return invalidCredentials();

    // ponytail: sem rate limit por username — adicionar quando sair do beta
    // fechado (tentativa de força bruta bate aqui primeiro).
    return Response.json({
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    });
  }),
};
