import { describe, expect, test } from "bun:test";
import { parseNotifications } from "./parse";
import { buildPushMessages, deadPushTokens } from "./push";
import { notificationText } from "./text";
import { NOTIFICATION_KINDS, type TNotificationKind } from "./types";

const PAYLOADS: Record<TNotificationKind, Record<string, unknown>> = {
  join_request: {},
  join_approved: {},
  join_refused: {},
  event_created: {
    event_date: "2026-10-10",
    event_time: "16:00:00",
    place: "Arena Jardins da Serra",
  },
  event_changed: { event_date: "2026-10-10", change: { time: "17:00" } },
  event_cancelled: { event_date: "2026-10-10" },
  sort_confirmed: { team: 2 },
  team_changed: { team: 3 },
  role_changed: { role: "ADMIN" },
  expelled: {},
  ownership_transferred: {},
  conduction_taken: {},
  waitlist_promoted: { event_date: "2026-10-10" },
  credit_created: { amount_cents: 20, valid_until: "2027-04-09" },
};

// Formato que o gatilho private.send_push_for_new_notifications monta.
function item(
  kind: TNotificationKind,
  extra: { id?: string; token?: string; badge?: number; payload?: unknown } = {}
) {
  return {
    token: extra.token ?? "ExponentPushToken[aaa]",
    badge: extra.badge ?? 1,
    notification: {
      id: extra.id ?? `id-${kind}`,
      kind,
      racha_id: "22222222-2222-2222-2222-222222222222",
      racha_name: "Quarta do Parque",
      event_id: "33333333-3333-3333-3333-333333333333",
      actor_name: "Diego",
      payload: extra.payload ?? PAYLOADS[kind],
      created_at: "2026-10-10T18:00:00.000000+00:00",
      is_new: true,
      resolution: null,
      target: "available",
    },
  };
}

describe("buildPushMessages", () => {
  test("os 14 tipos: título é o Racha e corpo é a frase da aba", () => {
    const items = NOTIFICATION_KINDS.map((kind) => item(kind));
    const { messages, skippedIds } = buildPushMessages(items);

    expect(skippedIds).toEqual([]);
    expect(messages).toHaveLength(14);
    messages.forEach((m, index) => {
      const [parsed] = parseNotifications([items[index]?.notification]);
      expect(m.title).toBe("Quarta do Parque");
      expect(m.body).toBe(notificationText(parsed!));
    });
    expect(messages[0]?.body).toBe("Diego pediu para entrar");
  });

  test("badge, token e notificationId vão do item para a mensagem", () => {
    const { messages } = buildPushMessages([
      item("sort_confirmed", { id: "aviso-1", token: "tok-1", badge: 3 }),
    ]);

    expect(messages).toEqual([
      {
        to: "tok-1",
        title: "Quarta do Parque",
        body: "Sorteio feito: você está no Time 2",
        data: { notificationId: "aviso-1" },
        badge: 3,
        sound: "default",
        channelId: "default",
        priority: "high",
      },
    ]);
  });

  test("item com payload inválido no meio não derruba os outros", () => {
    const { messages, skippedIds } = buildPushMessages([
      item("join_request", { id: "a" }),
      item("sort_confirmed", { id: "quebrado", payload: { team: "dois" } }),
      item("expelled", { id: "c" }),
    ]);

    expect(messages.map((m) => m.data.notificationId)).toEqual(["a", "c"]);
    expect(skippedIds).toEqual(["quebrado"]);
  });

  test("item sem token, sem badge inteiro ou que não é objeto fica de fora", () => {
    const { messages, skippedIds } = buildPushMessages([
      { ...item("expelled", { id: "sem-token" }), token: null },
      item("expelled", { id: "badge-quebrado", badge: 1.5 }),
      "lixo",
    ]);

    expect(messages).toEqual([]);
    expect(skippedIds).toEqual(["sem-token", "badge-quebrado", "unknown"]);
  });
});

describe("deadPushTokens", () => {
  const { messages } = buildPushMessages([
    item("expelled", { token: "morto" }),
    item("expelled", { token: "outro-erro" }),
    item("expelled", { token: "vivo" }),
    item("expelled", { token: "ticket-ruim" }),
  ]);

  test("só o DeviceNotRegistered conta", () => {
    expect(
      deadPushTokens(messages, [
        {
          status: "error",
          message: "not a registered push notification recipient",
          details: { error: "DeviceNotRegistered" },
        },
        {
          status: "error",
          details: { error: "MessageRateExceeded" },
        },
        { status: "ok", id: "xxxx" },
        "não é objeto",
      ])
    ).toEqual(["morto"]);
  });

  test("tickets que não são lista não quebram", () => {
    expect(deadPushTokens(messages, null)).toEqual([]);
    expect(deadPushTokens(messages, { errors: [] })).toEqual([]);
  });
});
