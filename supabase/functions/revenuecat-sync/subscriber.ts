// Regras puras da revenuecat-sync: só Web APIs, para rodar no Deno e no bun.
export type TSubscriptionRow = {
  expires_at: string;
  product_id: string;
  store: string;
  is_trial: boolean;
  will_renew: boolean;
  billing_issue_at: string | null;
  is_sandbox: boolean;
};

type TWrite =
  | { kind: "upsert"; row: TSubscriptionRow }
  | { kind: "expire" }
  | { kind: "none" };

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === "object" && value !== null;

const str = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Id anônimo da RevenueCat ("$RCAnonymousID:…") ou perfil anonimizado não são perfis.
export const isProfileId = (id: string): boolean => UUID_V4.test(id);

// Só estes três campos: "aliases" traz ids antigos que não são o dono da compra.
export function eventProfileIds(event: {
  app_user_id?: string;
  transferred_from?: string[];
  transferred_to?: string[];
}): string[] {
  const ids = [
    event.app_user_id,
    ...(event.transferred_from ?? []),
    ...(event.transferred_to ?? []),
  ].filter((id): id is string => typeof id === "string");
  return [...new Set(ids)];
}

// Resposta da API v1 (GET /v1/subscribers/{id}): direito `pro` aponta o produto,
// e as datas e flags ficam em `subscriptions[produto]`.
export function toSubscriptionWrite(
  response: unknown,
  now: Date,
  hasRow: boolean
): TWrite {
  const gone: TWrite = hasRow ? { kind: "expire" } : { kind: "none" };
  const subscriber = isRecord(response) ? response.subscriber : null;
  if (!isRecord(subscriber)) return gone;

  const entitlements = subscriber.entitlements;
  const entitlement = isRecord(entitlements) ? entitlements.pro : null;
  const productId = isRecord(entitlement)
    ? str(entitlement.product_identifier)
    : null;
  const subscriptions = subscriber.subscriptions;
  const sub =
    productId && isRecord(subscriptions) ? subscriptions[productId] : null;
  if (!productId || !isRecord(sub)) return gone;

  const expires = str(sub.expires_date);
  const graceDate = str(sub.grace_period_expires_date);
  const inGrace = graceDate !== null && new Date(graceDate) > now;
  // Vale o maior dos dois: a carência pode acabar antes do fim do período pago.
  const expiresAt =
    inGrace && (!expires || new Date(graceDate) > new Date(expires))
      ? graceDate
      : expires;
  if (!expiresAt || !(new Date(expiresAt) > now)) return gone;

  const billingIssueAt = str(sub.billing_issues_detected_at);
  return {
    kind: "upsert",
    row: {
      expires_at: expiresAt,
      product_id: productId,
      store: str(sub.store) ?? "unknown",
      is_trial: sub.period_type === "trial",
      // Na carência a loja ainda tenta cobrar, então segue renovando.
      will_renew:
        inGrace ||
        (sub.unsubscribe_detected_at == null && billingIssueAt === null),
      billing_issue_at: billingIssueAt,
      is_sandbox: sub.is_sandbox === true,
    },
  };
}

const encoder = new TextEncoder();
const TOLERANCE_SECONDS = 300;

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

// Cabeçalho `t=<unix>,v1=<hex>`; HMAC-SHA256(secret, t + "." + corpoBruto).
export async function verifySignature(
  header: string | null,
  rawBody: string,
  secret: string,
  now: Date
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const i = part.indexOf("=");
      return [part.slice(0, i).trim(), part.slice(i + 1).trim()];
    })
  );
  const t = Number(parts.t);
  const v1: string = parts.v1 ?? "";
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(now.getTime() / 1000 - t) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${parts.t}.${rawBody}`)
  );
  const expected = toHex(new Uint8Array(mac));
  if (expected.length !== v1.length) return false;
  // Sem retorno antecipado, como em devhub-staging-config.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const dueForSync = (now: Date): { from: Date; to: Date } => ({
  from: new Date(now.getTime() - DAY_MS),
  to: new Date(now.getTime() + DAY_MS),
});
