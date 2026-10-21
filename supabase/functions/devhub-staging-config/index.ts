// Entrega ao DevHub do app a URL e a anon key do Homolog, mediante a chave secreta.
// Todo erro de quem chama é o mesmo 401 sem corpo, para não revelar nada.
const encoder = new TextEncoder();

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value))
  );
}

// Compara os hashes (tamanho fixo) sem retorno antecipado.
async function sameKey(received: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(received), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const unauthorized = () => new Response(null, { status: 401 });

Deno.serve(async (req) => {
  const devhubKey = Deno.env.get("DEVHUB_KEY");
  const url = Deno.env.get("STAGING_SUPABASE_URL");
  const anonKey = Deno.env.get("STAGING_SUPABASE_ANON_KEY");
  if (!devhubKey || !url || !anonKey) {
    console.error("devhub-staging-config sem configuração completa");
    return new Response(null, { status: 500 });
  }

  if (req.method !== "POST") return unauthorized();
  const body = await req.json().catch(() => null);
  if (typeof body?.key !== "string") return unauthorized();
  if (!(await sameKey(body.key, devhubKey))) return unauthorized();

  return Response.json({ url, anonKey });
});
