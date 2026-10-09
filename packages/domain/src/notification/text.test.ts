import { describe, expect, test } from "bun:test";
import type {
  TNotification,
  TNotificationFamily,
  TNotificationKind,
} from "./types";
import { notificationFamily, notificationText } from "./text";

function notice(
  kind: TNotificationKind,
  extra: Partial<TNotification> = {}
): TNotification {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    kind,
    rachaId: "22222222-2222-2222-2222-222222222222",
    rachaName: "Quarta do Parque",
    eventId: "33333333-3333-3333-3333-333333333333",
    actorName: "Diego",
    payload: {},
    createdAt: "2026-10-09T18:00:00.000Z",
    isNew: true,
    resolution: null,
    target: "available",
    ...extra,
  };
}

describe("notificationText", () => {
  test("as 14 frases do catálogo", () => {
    expect(notificationText(notice("join_request"))).toBe(
      "Diego pediu para entrar"
    );
    expect(notificationText(notice("join_approved"))).toBe(
      "Você entrou no Quarta do Parque"
    );
    expect(notificationText(notice("join_refused"))).toBe(
      "Seu pedido para entrar foi recusado"
    );
    expect(
      notificationText(
        notice("event_created", {
          payload: {
            eventDate: "2026-10-10",
            eventTime: "16:00",
            place: "Arena Jardins da Serra",
          },
        })
      )
    ).toBe("Novo racha: sáb 10/10, 16h, na Arena Jardins da Serra");
    expect(
      notificationText(
        notice("event_changed", {
          payload: {
            eventDate: "2026-10-10",
            change: { time: "17:00" },
          },
        })
      )
    ).toBe("O racha de sáb 10/10 mudou: agora 17h");
    expect(
      notificationText(
        notice("event_cancelled", {
          payload: { eventDate: "2026-10-10" },
        })
      )
    ).toBe("O racha de sáb 10/10 foi cancelado");
    expect(
      notificationText(notice("sort_confirmed", { payload: { team: 2 } }))
    ).toBe("Sorteio feito: você está no Time 2");
    expect(
      notificationText(notice("team_changed", { payload: { team: 3 } }))
    ).toBe("Agora você está no Time 3");
    expect(
      notificationText(notice("role_changed", { payload: { role: "ADMIN" } }))
    ).toBe("Você agora é Admin");
    expect(
      notificationText(notice("role_changed", { payload: { role: "PLAYER" } }))
    ).toBe("Você agora é Jogador");
    expect(notificationText(notice("expelled"))).toBe(
      "Você foi removido do Racha"
    );
    expect(notificationText(notice("ownership_transferred"))).toBe(
      "Você agora é o Dono do Racha"
    );
    expect(notificationText(notice("conduction_taken"))).toBe(
      "Diego assumiu a condução"
    );
    expect(
      notificationText(
        notice("waitlist_promoted", {
          payload: { eventDate: "2026-10-10" },
        })
      )
    ).toBe("Abriu vaga: sua Presença no sáb 10/10 está confirmada");
    expect(
      notificationText(
        notice("credit_created", {
          payload: { amountCents: 20, validUntil: "2026-04-09" },
        })
      )
    ).toBe("Você ganhou R$ 20 de Crédito, válido até 09/04");
  });

  test("event_changed só diz o que veio em change, nesta ordem", () => {
    const base = { eventDate: "2026-10-10" };

    expect(
      notificationText(
        notice("event_changed", {
          payload: { ...base, change: { time: "16:30" } },
        })
      )
    ).toBe("O racha de sáb 10/10 mudou: agora 16h30");
    expect(
      notificationText(
        notice("event_changed", {
          payload: { ...base, change: { date: "2026-10-11" } },
        })
      )
    ).toBe("O racha de sáb 10/10 mudou: agora dom 11/10");
    expect(
      notificationText(
        notice("event_changed", {
          payload: { ...base, change: { place: "Quadra 2" } },
        })
      )
    ).toBe("O racha de sáb 10/10 mudou: agora na Quadra 2");
    expect(
      notificationText(
        notice("event_changed", {
          payload: {
            ...base,
            change: { date: "2026-10-11", time: "17:00" },
          },
        })
      )
    ).toBe("O racha de sáb 10/10 mudou: agora dom 11/10, 17h");
    expect(
      notificationText(
        notice("event_changed", {
          payload: {
            ...base,
            change: {
              date: "2026-10-11",
              time: "17:00",
              place: "Quadra 2",
            },
          },
        })
      )
    ).toBe("O racha de sáb 10/10 mudou: agora dom 11/10, 17h, na Quadra 2");
  });

  test("horário sem zero na hora e com segundos", () => {
    expect(
      notificationText(
        notice("event_created", {
          payload: {
            eventDate: "2026-10-10",
            eventTime: "09:00",
            place: "Arena",
          },
        })
      )
    ).toBe("Novo racha: sáb 10/10, 9h, na Arena");
    expect(
      notificationText(
        notice("event_created", {
          payload: {
            eventDate: "2026-10-10",
            eventTime: "09:05:00",
            place: "Arena",
          },
        })
      )
    ).toBe("Novo racha: sáb 10/10, 9h05, na Arena");
  });
});

describe("notificationFamily", () => {
  test("agrupa os 14 kinds", () => {
    const families: Record<TNotificationKind, TNotificationFamily> = {
      join_request: "racha",
      join_approved: "racha",
      join_refused: "racha",
      role_changed: "racha",
      expelled: "racha",
      ownership_transferred: "racha",
      event_created: "event",
      event_changed: "event",
      event_cancelled: "event",
      waitlist_promoted: "event",
      sort_confirmed: "team",
      team_changed: "team",
      conduction_taken: "team",
      credit_created: "money",
    };

    for (const kind of Object.keys(families) as TNotificationKind[]) {
      expect(notificationFamily(kind)).toBe(families[kind]);
    }
  });
});
