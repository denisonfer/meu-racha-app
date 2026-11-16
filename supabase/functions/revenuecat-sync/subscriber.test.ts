import { describe, expect, test } from "bun:test";
import {
  dueForSync,
  eventProfileIds,
  isProfileId,
  toSubscriptionWrite,
  verifySignature,
} from "./subscriber";
import trial from "./fixtures/trial.json";
import active from "./fixtures/active.json";
import cancelled from "./fixtures/cancelled.json";
import expired from "./fixtures/expired.json";
import grace from "./fixtures/grace.json";
import refunded from "./fixtures/refunded.json";
import none from "./fixtures/none.json";

const now = new Date("2026-11-13T12:00:00Z");

function row(response: unknown) {
  const write = toSubscriptionWrite(response, now, true);
  if (write.kind !== "upsert")
    throw new Error(`esperava upsert: ${write.kind}`);
  return write.row;
}

describe("toSubscriptionWrite", () => {
  test("trial", () => {
    const r = row(trial);
    expect(r.is_trial).toBe(true);
    expect(r.will_renew).toBe(true);
    expect(r.product_id).toBe("pro:mensal");
    expect(r.store).toBe("play_store");
  });
  test("active", () => {
    const r = row(active);
    expect(r.is_trial).toBe(false);
    expect(r.will_renew).toBe(true);
    expect(r.billing_issue_at).toBeNull();
    expect(r.expires_at).toBe("2026-12-13T12:00:00Z");
  });
  test("cancelled", () => {
    const r = row(cancelled);
    expect(r.will_renew).toBe(false);
    expect(r.expires_at).toBe(
      cancelled.subscriber.subscriptions["pro:mensal"].expires_date
    );
  });
  test("grace", () => {
    const r = row(grace);
    expect(r.expires_at).toBe("2026-11-16T12:00:00Z");
    expect(r.billing_issue_at).toBe("2026-11-12T12:05:00Z");
    expect(r.will_renew).toBe(true);
  });
  test("expired e refunded expiram a linha", () => {
    expect(toSubscriptionWrite(expired, now, true)).toEqual({ kind: "expire" });
    expect(toSubscriptionWrite(refunded, now, true)).toEqual({
      kind: "expire",
    });
  });
  test("reembolso com direito ainda no futuro: o direito decide", () => {
    const future = structuredClone(refunded);
    const sub = future.subscriber.subscriptions["pro:mensal"];
    sub.expires_date = "2026-12-13T12:00:00Z";
    future.subscriber.entitlements.pro.expires_date = sub.expires_date;
    expect(toSubscriptionWrite(future, now, true).kind).toBe("upsert");
  });
  test("carência antes do expires_date: vale o maior", () => {
    const g = structuredClone(grace);
    const sub = g.subscriber.subscriptions["pro:mensal"];
    sub.expires_date = "2026-12-13T12:00:00Z";
    expect(row(g).expires_at).toBe("2026-12-13T12:00:00Z");
    expect(row(g).will_renew).toBe(true);
  });
  test("none", () => {
    expect(toSubscriptionWrite(none, now, true)).toEqual({ kind: "expire" });
    expect(toSubscriptionWrite(none, now, false)).toEqual({ kind: "none" });
  });
  test("resposta malformada vira none/expire", () => {
    expect(toSubscriptionWrite({}, now, false)).toEqual({ kind: "none" });
    expect(toSubscriptionWrite(null, now, true)).toEqual({ kind: "expire" });
  });
});

describe("eventProfileIds", () => {
  test("une app_user_id e transferências sem repetir", () => {
    expect(
      eventProfileIds({
        app_user_id: "a",
        transferred_from: ["b"],
        transferred_to: ["a"],
      })
    ).toEqual(["a", "b"]);
  });
  test("ignora aliases", () => {
    const event = { app_user_id: "a", aliases: ["x"] };
    expect(eventProfileIds(event)).toEqual(["a"]);
  });
});

describe("verifySignature", () => {
  const secret = "segredo";
  const body = '{"event":{}}';
  async function sign(t: number, text = body) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${t}.${text}`)
    );
    return Array.from(new Uint8Array(mac), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
  }
  const t = Math.floor(now.getTime() / 1000);

  test("válida", async () => {
    expect(
      await verifySignature(`t=${t},v1=${await sign(t)}`, body, secret, now)
    ).toBe(true);
  });
  test("HMAC alterado", async () => {
    const hex = await sign(t);
    const bad = (hex[0] === "0" ? "1" : "0") + hex.slice(1);
    expect(await verifySignature(`t=${t},v1=${bad}`, body, secret, now)).toBe(
      false
    );
  });
  test("corpo alterado", async () => {
    expect(
      await verifySignature(
        `t=${t},v1=${await sign(t)}`,
        body + " ",
        secret,
        now
      )
    ).toBe(false);
  });
  test("fora da tolerância", async () => {
    const old = t - 301;
    expect(
      await verifySignature(`t=${old},v1=${await sign(old)}`, body, secret, now)
    ).toBe(false);
  });
  test("timestamp do futuro além da tolerância", async () => {
    const ahead = t + 301;
    expect(
      await verifySignature(
        `t=${ahead},v1=${await sign(ahead)}`,
        body,
        secret,
        now
      )
    ).toBe(false);
  });
  test("cabeçalho nulo ou torto", async () => {
    expect(await verifySignature(null, body, secret, now)).toBe(false);
    expect(await verifySignature("lixo", body, secret, now)).toBe(false);
  });
});

test("dueForSync", () => {
  expect(dueForSync(now)).toEqual({
    from: new Date("2026-11-12T12:00:00Z"),
    to: new Date("2026-11-14T12:00:00Z"),
  });
});

test("isProfileId", () => {
  expect(isProfileId("$RCAnonymousID:abc")).toBe(false);
  expect(isProfileId("3f2b8c1e-5d4a-4e6f-9a1b-2c3d4e5f6a7b")).toBe(true);
});
