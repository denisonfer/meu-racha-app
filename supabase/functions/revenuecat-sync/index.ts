// Única escritora de `subscription`. Toda entrada só decide QUEM sincronizar:
// o estado gravado é sempre o que a API da RevenueCat responde naquele momento.
import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import {
  dueForSync,
  eventProfileIds,
  isProfileId,
  toSubscriptionWrite,
  verifySignature,
} from "./subscriber.ts";

const REVENUECAT_API = "https://api.revenuecat.com/v1/subscribers/";
const encoder = new TextEncoder();

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value))
  );
}

// Compara os hashes (tamanho fixo) sem retorno antecipado, como em devhub-staging-config.
async function sameSecret(received: string, expected: string) {
  const [a, b] = await Promise.all([sha256(received), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const unauthorized = () => new Response(null, { status: 401 });

function missingConfig(name: string) {
  console.error("revenuecat-sync sem configuração:", name);
  return new Response(null, { status: 500 });
}

Deno.serve(async (req) => {
  const apiKey = Deno.env.get("REVENUECAT_SECRET_KEY");
  if (!apiKey) return missingConfig("REVENUECAT_SECRET_KEY");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const now = new Date();

  // Devolve se o Perfil ficou Pro. Falha da API ou do banco lança, e vira 500.
  async function syncProfile(id: string, source: string): Promise<boolean> {
    if (!isProfileId(id)) {
      console.log("id ignorado (não é Perfil)", id);
      return false;
    }
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("anonymized_at")
      .eq("id", id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.anonymized_at) {
      console.log("Perfil ignorado (inexistente ou anonimizado)", id);
      return false;
    }

    const response = await fetch(REVENUECAT_API + id, {
      headers: { Authorization: "Bearer " + apiKey },
    });
    if (!response.ok) {
      throw new Error(`RevenueCat respondeu ${response.status} para ${id}`);
    }

    const { data: row, error: rowError } = await supabase
      .from("subscription")
      .select("profile_id")
      .eq("profile_id", id)
      .maybeSingle();
    if (rowError) throw rowError;

    const write = toSubscriptionWrite(await response.json(), now, !!row);
    const stamp = { synced_at: now.toISOString(), sync_source: source };
    if (write.kind === "upsert") {
      const { error } = await supabase
        .from("subscription")
        .upsert(
          { profile_id: id, ...write.row, ...stamp },
          { onConflict: "profile_id" }
        );
      if (error) throw error;
    } else if (write.kind === "expire") {
      // O carimbo vale para toda linha (a conferência do plan_check depende dele);
      // a validade só encurta, nunca reescreve uma que já venceu.
      const { error } = await supabase
        .from("subscription")
        .update(stamp)
        .eq("profile_id", id);
      if (error) throw error;
      const { error: expireError } = await supabase
        .from("subscription")
        .update({ expires_at: now.toISOString() })
        .eq("profile_id", id)
        .gt("expires_at", now.toISOString());
      if (expireError) throw expireError;
    }
    return write.kind === "upsert";
  }

  try {
    const signature = req.headers.get("X-RevenueCat-Webhook-Signature");
    if (signature !== null) {
      const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
      if (!webhookSecret) return missingConfig("REVENUECAT_WEBHOOK_SECRET");
      // O HMAC é sobre o texto exato recebido, então lê antes de interpretar.
      const raw = await req.text();
      if (!(await verifySignature(signature, raw, webhookSecret, now))) {
        return unauthorized();
      }
      let event;
      try {
        event = JSON.parse(raw)?.event;
      } catch (error) {
        // 200: a RevenueCat reenviaria um corpo que nunca vamos conseguir ler.
        console.error("webhook com corpo ilegível", error);
        return new Response(null, { status: 200 });
      }
      if (typeof event !== "object" || event === null) {
        console.log("webhook sem event");
        return new Response(null, { status: 200 });
      }
      const type = typeof event.type === "string" ? event.type : "unknown";
      for (const id of eventProfileIds(event)) {
        await syncProfile(id, `webhook:${type}`);
      }
      return new Response(null, { status: 200 });
    }

    const jobSecret = req.headers.get("x-sync-secret");
    if (jobSecret !== null) {
      const syncSecret = Deno.env.get("REVENUECAT_SYNC_SECRET");
      if (!syncSecret) return missingConfig("REVENUECAT_SYNC_SECRET");
      if (!(await sameSecret(jobSecret, syncSecret))) return unauthorized();
      const body = await req.json().catch(() => null);
      let ids: string[];
      if (typeof body?.profile_id === "string") {
        ids = [body.profile_id];
      } else {
        const { from, to } = dueForSync(now);
        const { data, error } = await supabase
          .from("subscription")
          .select("profile_id")
          .eq("will_renew", true)
          .gte("expires_at", from.toISOString())
          .lte("expires_at", to.toISOString());
        if (error) throw error;
        ids = data.map((r) => r.profile_id);
      }
      // Um Perfil com falha não trava os outros; o 500 só sai no fim.
      let failed = 0;
      for (const id of ids) {
        try {
          await syncProfile(id, "job");
        } catch (error) {
          failed++;
          console.error("job não sincronizou", id, error);
        }
      }
      return new Response(null, { status: failed > 0 ? 500 : 200 });
    }

    const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return unauthorized();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return unauthorized();
    return Response.json({ is_pro: await syncProfile(data.user.id, "app") });
  } catch (error) {
    console.error("revenuecat-sync falhou", error);
    return new Response(null, { status: 500 });
  }
});
