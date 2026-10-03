import { describe, expect, test } from "bun:test";
import {
  ACTION_FAILED,
  ATTENDANCE_SPOT_LIMIT,
  FINISH_EVENT_PAYMENTS_NOT_REVIEWED,
  SORT_ROSTER_CHANGED,
  finishEventErrorMessage,
  finishEventPaidSummary,
  sortAttendanceSummary,
  sortErrorMessage,
  sortMissingLinePlayers,
} from "./racha-messages";

// todos os códigos que as RPCs do Sorteio levantam e o app trata
const SORT_ERROR_CODES = [
  "not_conductor",
  "not_member",
  "already_confirmed",
  "event_not_upcoming",
  "not_enough_players",
  "no_proposal",
  "roster_changed",
  "proposal_outdated",
  "goalkeeper_not_found",
  "team_full",
  "sort_confirmed",
  "sort_not_confirmed",
  "event_not_active",
  "not_confirmed",
  "already_participating",
  "use_return",
  "not_left",
  "spot_limit",
];

describe("sortErrorMessage", () => {
  test.each(SORT_ERROR_CODES)("%s tem mensagem própria", (code) => {
    const message = sortErrorMessage(code);
    expect(message).not.toBe(ACTION_FAILED);
    expect(message.length).toBeGreaterThan(0);
  });

  test("elenco mudou e proposta velha pedem novo Sorteio", () => {
    expect(sortErrorMessage("roster_changed")).toBe(SORT_ROSTER_CHANGED);
    expect(sortErrorMessage("proposal_outdated")).toBe(SORT_ROSTER_CHANGED);
    expect(SORT_ROSTER_CHANGED).toBe("A lista mudou. Sorteie novamente.");
  });

  test("spot_limit reaproveita a mensagem de vaga", () => {
    expect(sortErrorMessage("spot_limit")).toBe(ATTENDANCE_SPOT_LIMIT);
  });

  test("código desconhecido e falha de rede caem na mensagem genérica", () => {
    expect(sortErrorMessage("network_error")).toBe(ACTION_FAILED);
    expect(sortErrorMessage("xyz")).toBe(ACTION_FAILED);
  });
});

describe("encerrar evento pago", () => {
  test("payments_not_reviewed tem mensagem própria; o resto cai no genérico", () => {
    expect(finishEventErrorMessage(new Error("payments_not_reviewed"))).toBe(
      FINISH_EVENT_PAYMENTS_NOT_REVIEWED
    );
    expect(finishEventErrorMessage(new Error("not_allowed"))).toBe(
      ACTION_FAILED
    );
  });

  test("resumo com e sem Meta", () => {
    expect(finishEventPaidSummary(12, 9, 10)).toBe(
      "12 vieram · 9 pagaram · Meta 10"
    );
    expect(finishEventPaidSummary(12, 9, null)).toBe(
      "12 vieram · 9 pagaram · Meta não definida"
    );
  });
});

describe("S1 do Sorteio", () => {
  test("resumo e bloqueio falam de quem veio", () => {
    expect(sortAttendanceSummary(11, 6)).toBe("11 confirmaram · 6 vieram");
    expect(sortMissingLinePlayers(2)).toContain("que vieram");
  });
});
