import { describe, expect, test } from "bun:test";
import {
  ACTION_FAILED,
  ATTENDANCE_SPOT_LIMIT,
  FINISH_EVENT_PAYMENTS_NOT_REVIEWED,
  MATCH_ALREADY_OPEN,
  MATCH_ALREADY_REINFORCED,
  MATCH_INVALID_DONOR,
  MATCH_INVALID_GOALKEEPER,
  MATCH_INVALID_SCORER,
  MATCH_LOCKED,
  MATCH_NO_DONOR_TEAM,
  MATCH_NO_OPEN,
  MATCH_NOT_ENOUGH_TEAMS,
  MATCH_NOT_ON_FIELD,
  MATCH_PENALTY_WINNER_REQUIRED,
  SORT_NOT_CONDUCTOR,
  SORT_ROSTER_CHANGED,
  finishEventErrorMessage,
  finishEventPaidSummary,
  matchErrorMessage,
  matchFailureMessage,
  positionDetailChoose,
  positionDetailPendingMessage,
  sortAttendanceSummary,
  sortErrorMessage,
  sortFailureMessage,
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
  "position_detail_required",
  "position_detail_mismatch",
  "position_detail_pending",
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

describe("posição pendente", () => {
  const pendingError = (pendingNames: string[]) =>
    Object.assign(new Error("position_detail_pending"), { pendingNames });

  test("lista os nomes que o banco mandou", () => {
    expect(sortFailureMessage(pendingError(["Rita"]))).toBe(
      "Rita está com a posição pendente. Complete antes de sortear."
    );
    expect(sortFailureMessage(pendingError(["Caio", "Rita", "Zé"]))).toBe(
      "Caio, Rita e Zé estão com a posição pendente. Complete antes de sortear."
    );
  });

  test("sem nomes legíveis, a frase genérica", () => {
    expect(sortFailureMessage(new Error("position_detail_pending"))).toBe(
      positionDetailPendingMessage([])
    );
  });

  test("erro do seletor traz as duas opções da zona", () => {
    expect(positionDetailChoose(["Zagueiro", "Lateral"])).toBe(
      "Escolha Zagueiro ou Lateral para continuar."
    );
  });
});

describe("S1 do Sorteio", () => {
  test("resumo e bloqueio falam de quem veio", () => {
    expect(sortAttendanceSummary(11, 6)).toBe("11 confirmaram · 6 vieram");
    expect(sortMissingLinePlayers(2)).toContain("que vieram");
  });
});

const MATCH_ERROR_CODES = [
  "match_open",
  "no_open_match",
  "not_enough_teams",
  "match_locked",
  "penalty_winner_required",
  "invalid_goalkeeper",
  "invalid_scorer",
  "not_on_field",
  "already_reinforced",
  "invalid_donor",
  "no_donor",
  "not_conductor",
] as const;

describe("matchErrorMessage", () => {
  test.each(MATCH_ERROR_CODES)("%s tem mensagem própria", (code) => {
    const message = matchErrorMessage(code);
    expect(message).not.toBe(ACTION_FAILED);
    expect(message.length).toBeGreaterThan(0);
  });

  test("códigos da Partida batem com o texto fixo", () => {
    expect(matchErrorMessage("match_open")).toBe(MATCH_ALREADY_OPEN);
    expect(matchErrorMessage("no_open_match")).toBe(MATCH_NO_OPEN);
    expect(matchErrorMessage("not_enough_teams")).toBe(MATCH_NOT_ENOUGH_TEAMS);
    expect(matchErrorMessage("match_locked")).toBe(MATCH_LOCKED);
    expect(matchErrorMessage("penalty_winner_required")).toBe(
      MATCH_PENALTY_WINNER_REQUIRED
    );
    expect(matchErrorMessage("invalid_goalkeeper")).toBe(
      MATCH_INVALID_GOALKEEPER
    );
    expect(matchErrorMessage("invalid_scorer")).toBe(MATCH_INVALID_SCORER);
    expect(matchErrorMessage("not_on_field")).toBe(MATCH_NOT_ON_FIELD);
    expect(matchErrorMessage("already_reinforced")).toBe(
      MATCH_ALREADY_REINFORCED
    );
    expect(matchErrorMessage("invalid_donor")).toBe(MATCH_INVALID_DONOR);
    expect(matchErrorMessage("no_donor")).toBe(MATCH_NO_DONOR_TEAM);
    expect(matchErrorMessage("not_conductor")).toBe(SORT_NOT_CONDUCTOR);
  });

  test("código desconhecido e falha de rede caem na mensagem genérica", () => {
    expect(matchErrorMessage("xyz")).toBe(ACTION_FAILED);
    expect(matchFailureMessage(new Error("network_error"))).not.toBe(
      ACTION_FAILED
    );
    expect(matchFailureMessage(new Error("xyz"))).toBe(ACTION_FAILED);
  });
});
