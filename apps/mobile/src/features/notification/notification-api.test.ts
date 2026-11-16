import { describe, expect, mock, test } from "bun:test";

// o cliente real lê o .env e o react-native; o parse não usa rede
mock.module("@/lib/supabase", () => ({ supabase: {} }));
const { toOpenedNotification } = await import("./notification-api");

const row = {
  kind: "sort_confirmed",
  racha_id: "r1",
  event_id: "e1",
  target: "available",
};

describe("toOpenedNotification", () => {
  test("kind conhecido devolve o destino de hoje", () => {
    expect(toOpenedNotification(row)).toEqual({
      kind: "sort_confirmed",
      target: "available",
      rachaId: "r1",
      eventId: "e1",
    });
  });

  test("kind ou target de servidor mais novo vira desconhecido", () => {
    expect(toOpenedNotification({ ...row, kind: "pro_reminder" })).toEqual({
      kind: "unknown",
    });
    expect(toOpenedNotification({ ...row, target: "archived" })).toEqual({
      kind: "unknown",
    });
  });

  test("retorno quebrado continua lançando", () => {
    expect(() => toOpenedNotification({ kind: "sort_confirmed" })).toThrow(
      "notification_payload_invalid"
    );
  });
});
