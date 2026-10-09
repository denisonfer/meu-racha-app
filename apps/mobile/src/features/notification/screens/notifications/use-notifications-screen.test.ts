import { describe, expect, test } from "bun:test";
import { notificationHref } from "./notification-href";

const RACHA = "r1";
const EVENT = "e1";

const home = `/racha/${RACHA}`;
const requests = `/racha/${RACHA}/requests`;
const sort = `/racha/${RACHA}/event/${EVENT}/sort`;
const match = `/racha/${RACHA}/event/${EVENT}/match`;
const resenha = `/racha/${RACHA}/event/${EVENT}/resenha`;

describe("notificationHref", () => {
  test("alvo excluído, fora do racha ou evento cancelado não abre", () => {
    expect(
      notificationHref({
        kind: "join_approved",
        target: "racha_deleted",
        rachaId: RACHA,
        eventId: null,
      })
    ).toBeNull();
    expect(
      notificationHref({
        kind: "event_created",
        target: "not_member",
        rachaId: RACHA,
        eventId: null,
      })
    ).toBeNull();
    expect(
      notificationHref({
        kind: "sort_confirmed",
        target: "event_cancelled",
        rachaId: RACHA,
        eventId: EVENT,
      })
    ).toBeNull();
  });

  test("pedido recusado e expulsão não abrem", () => {
    expect(
      notificationHref({
        kind: "join_refused",
        target: "available",
        rachaId: RACHA,
        eventId: null,
      })
    ).toBeNull();
    expect(
      notificationHref({
        kind: "expelled",
        target: "available",
        rachaId: RACHA,
        eventId: null,
      })
    ).toBeNull();
  });

  test("pedido para entrar abre Pedidos", () => {
    expect(
      notificationHref({
        kind: "join_request",
        target: "available",
        rachaId: RACHA,
        eventId: null,
      })
    ).toBe(requests);
  });

  test("sorteio e troca de time abrem Times, ou a Resenha se o evento acabou", () => {
    expect(
      notificationHref({
        kind: "sort_confirmed",
        target: "available",
        rachaId: RACHA,
        eventId: EVENT,
      })
    ).toBe(sort);
    expect(
      notificationHref({
        kind: "team_changed",
        target: "available",
        rachaId: RACHA,
        eventId: EVENT,
      })
    ).toBe(sort);
    expect(
      notificationHref({
        kind: "sort_confirmed",
        target: "event_finished",
        rachaId: RACHA,
        eventId: EVENT,
      })
    ).toBe(resenha);
    expect(
      notificationHref({
        kind: "team_changed",
        target: "event_finished",
        rachaId: RACHA,
        eventId: EVENT,
      })
    ).toBe(resenha);
  });

  test("condução abre a Partida, ou a Resenha se o evento acabou", () => {
    expect(
      notificationHref({
        kind: "conduction_taken",
        target: "available",
        rachaId: RACHA,
        eventId: EVENT,
      })
    ).toBe(match);
    expect(
      notificationHref({
        kind: "conduction_taken",
        target: "event_finished",
        rachaId: RACHA,
        eventId: EVENT,
      })
    ).toBe(resenha);
  });

  test("sem eventId, Times e Partida não abrem", () => {
    expect(
      notificationHref({
        kind: "sort_confirmed",
        target: "available",
        rachaId: RACHA,
        eventId: null,
      })
    ).toBeNull();
    expect(
      notificationHref({
        kind: "team_changed",
        target: "event_finished",
        rachaId: RACHA,
        eventId: null,
      })
    ).toBeNull();
    expect(
      notificationHref({
        kind: "conduction_taken",
        target: "event_finished",
        rachaId: RACHA,
        eventId: null,
      })
    ).toBeNull();
  });

  test.each([
    "join_approved",
    "event_created",
    "event_changed",
    "event_cancelled",
    "role_changed",
    "ownership_transferred",
    "waitlist_promoted",
    "credit_created",
  ] as const)("%s abre a home do Racha", (kind) => {
    expect(
      notificationHref({
        kind,
        target: "available",
        rachaId: RACHA,
        eventId: EVENT,
      })
    ).toBe(home);
  });
});
