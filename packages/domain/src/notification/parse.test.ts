import { describe, expect, test } from "bun:test";
import { NOTIFICATION_PAYLOAD_INVALID, parseNotifications } from "./parse";

const COMPLETE = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "event_changed",
  racha_id: "22222222-2222-2222-2222-222222222222",
  racha_name: "Quarta do Parque",
  event_id: "33333333-3333-3333-3333-333333333333",
  actor_name: "Diego",
  payload: {
    event_date: "2026-10-10",
    event_time: "16:30:00",
    place: "Arena Jardins da Serra",
    team: 2,
    role: "ADMIN",
    amount_cents: 2000,
    valid_until: "2026-04-09",
    change: {
      date: "2026-10-11",
      time: "17:00",
      place: "Quadra 2",
    },
    // Snapshot interno da recusa: a leitura já promove isso para o item.
    resolution: {
      status: "refused",
      by_name: "Ignorado",
      by_id: "44444444-4444-4444-4444-444444444444",
    },
  },
  created_at: "2026-10-09T18:22:33.123456+00:00",
  is_new: true,
  resolution: {
    status: "approved",
    by_name: "Ana",
    by_me: false,
  },
  target: "available",
};

describe("parseNotifications", () => {
  test("parseia um item completo em camelCase e ignora resolution do payload", () => {
    expect(parseNotifications([COMPLETE])).toEqual([
      {
        id: "11111111-1111-1111-1111-111111111111",
        kind: "event_changed",
        rachaId: "22222222-2222-2222-2222-222222222222",
        rachaName: "Quarta do Parque",
        eventId: "33333333-3333-3333-3333-333333333333",
        actorName: "Diego",
        payload: {
          eventDate: "2026-10-10",
          eventTime: "16:30:00",
          place: "Arena Jardins da Serra",
          team: 2,
          role: "ADMIN",
          amountCents: 2000,
          validUntil: "2026-04-09",
          change: {
            date: "2026-10-11",
            time: "17:00",
            place: "Quadra 2",
          },
        },
        createdAt: "2026-10-09T18:22:33.123456+00:00",
        isNew: true,
        resolution: {
          status: "approved",
          byName: "Ana",
          byMe: false,
        },
        target: "available",
      },
    ]);
  });

  test("aceita resolution nula, ids nulos e lista vazia", () => {
    expect(
      parseNotifications([
        {
          ...COMPLETE,
          kind: "join_request",
          event_id: null,
          actor_name: null,
          payload: {},
          is_new: false,
          resolution: null,
        },
      ])
    ).toEqual([
      {
        id: COMPLETE.id,
        kind: "join_request",
        rachaId: COMPLETE.racha_id,
        rachaName: COMPLETE.racha_name,
        eventId: null,
        actorName: null,
        payload: {},
        createdAt: COMPLETE.created_at,
        isNew: false,
        resolution: null,
        target: "available",
      },
    ]);
    expect(parseNotifications([])).toEqual([]);
  });

  test("aceita resolution recusada e os cinco destinos", () => {
    expect(
      parseNotifications([
        {
          ...COMPLETE,
          resolution: { status: "refused", by_name: "Bruno C.", by_me: true },
        },
      ])[0]?.resolution
    ).toEqual({ status: "refused", byName: "Bruno C.", byMe: true });

    const targets = [
      "available",
      "racha_deleted",
      "not_member",
      "event_cancelled",
      "event_finished",
    ] as const;

    for (const target of targets) {
      expect(parseNotifications([{ ...COMPLETE, target }])[0]?.target).toBe(
        target
      );
    }
  });

  test("rejeita jsonb inválido", () => {
    expect(() => parseNotifications(COMPLETE)).toThrow(
      NOTIFICATION_PAYLOAD_INVALID
    );
    expect(() => parseNotifications([{ ...COMPLETE, kind: "nope" }])).toThrow(
      NOTIFICATION_PAYLOAD_INVALID
    );
    expect(() => parseNotifications([{ ...COMPLETE, target: "gone" }])).toThrow(
      NOTIFICATION_PAYLOAD_INVALID
    );
    expect(() =>
      parseNotifications([
        { ...COMPLETE, payload: { ...COMPLETE.payload, team: 1.5 } },
      ])
    ).toThrow(NOTIFICATION_PAYLOAD_INVALID);
    expect(() =>
      parseNotifications([
        {
          ...COMPLETE,
          resolution: { status: "pending", by_name: "Ana", by_me: false },
        },
      ])
    ).toThrow(NOTIFICATION_PAYLOAD_INVALID);
    expect(() => parseNotifications([{ ...COMPLETE, payload: null }])).toThrow(
      NOTIFICATION_PAYLOAD_INVALID
    );
    const { id: _id, ...noId } = COMPLETE;
    expect(() => parseNotifications([noId])).toThrow(
      NOTIFICATION_PAYLOAD_INVALID
    );
  });
});
