import { describe, expect, test } from "bun:test";
import {
  cardOutcome,
  isExpelled,
  runningYellows,
  yellowOutSeconds,
  yellowRemaining,
} from "./cards";
import type { TMatchCard } from "./types";

function card(
  partial: Pick<TMatchCard, "id" | "color" | "matchSecond"> & {
    personId?: string;
    redReason?: TMatchCard["redReason"];
  }
): TMatchCard {
  const personId = partial.personId ?? "p1";
  return {
    id: partial.id,
    person: {
      kind: "member",
      personId,
      profileId: personId,
      guestId: null,
      displayName: "Diego",
      photoUrl: null,
    },
    teamId: "team",
    isGoalkeeper: false,
    color: partial.color,
    redReason: partial.redReason ?? (partial.color === "red" ? "direct" : null),
    matchSecond: partial.matchSecond,
    createdAt: "2026-10-06T12:00:00+00:00",
  };
}

describe("cardOutcome", () => {
  test("amarelo sem anterior continua amarelo", () => {
    expect(cardOutcome([], "p1", "yellow")).toEqual({
      color: "yellow",
      reason: null,
    });
  });

  test("segundo amarelo, mesmo já cumprido, vira vermelho", () => {
    const fulfilled = card({ id: "a", color: "yellow", matchSecond: 0 });
    expect(cardOutcome([fulfilled], "p1", "yellow")).toEqual({
      color: "red",
      reason: "secondYellow",
    });
  });

  test("vermelho escolhido é direto, e o amarelo de outra pessoa não conta", () => {
    const other = card({
      id: "a",
      color: "yellow",
      matchSecond: 10,
      personId: "p2",
    });
    expect(cardOutcome([other], "p1", "yellow")).toEqual({
      color: "yellow",
      reason: null,
    });
    expect(cardOutcome([other], "p1", "red")).toEqual({
      color: "red",
      reason: "direct",
    });
  });
});

describe("yellowRemaining", () => {
  const yellow = card({ id: "a", color: "yellow", matchSecond: 340 });

  test("pausa não entra: o elapsed já descontado chega pronto", () => {
    // matchElapsedSeconds é quem tira a pausa; aqui 150 já é o relógio da Partida
    expect(yellowRemaining(yellow, 150, 120)).toBe(310);
    expect(yellowRemaining({ matchSecond: 100 }, 150, 120)).toBe(70);
  });

  test("zera no segundo exato do fim e não fica negativo", () => {
    expect(yellowRemaining(yellow, 340, 120)).toBe(120);
    expect(yellowRemaining(yellow, 459, 120)).toBe(1);
    expect(yellowRemaining(yellow, 460, 120)).toBe(0);
    expect(yellowRemaining(yellow, 461, 120)).toBe(0);
  });
});

describe("yellowOutSeconds", () => {
  test("timed usa os minutos do Evento; mark nunca corre", () => {
    expect(yellowOutSeconds("timed", 2)).toBe(120);
    expect(yellowOutSeconds("timed", 5)).toBe(300);
    expect(yellowOutSeconds("mark", 5)).toBe(0);
  });
});

describe("amarelo de 5 minutos", () => {
  const yellow = card({ id: "a", color: "yellow", matchSecond: 100 });

  test("resto e fim seguem os minutos do Evento, não 2", () => {
    expect(yellowRemaining(yellow, 220, 300)).toBe(180);
    expect(yellowRemaining(yellow, 399, 300)).toBe(1);
    expect(yellowRemaining(yellow, 400, 300)).toBe(0);
    expect(runningYellows([yellow], 250, 300)).toHaveLength(1);
    expect(runningYellows([yellow], 250, 120)).toHaveLength(0);
  });

  test("em mark (0 s) nenhum amarelo corre", () => {
    const out = yellowOutSeconds("mark", 5);
    expect(yellowRemaining(yellow, 100, out)).toBe(0);
    expect(runningYellows([yellow], 100, out)).toEqual([]);
  });
});

describe("runningYellows", () => {
  test("só amarelo com resto, o mais urgente primeiro e id no empate", () => {
    const later = card({ id: "c", color: "yellow", matchSecond: 80 });
    const soon = card({ id: "b", color: "yellow", matchSecond: 40 });
    const same = card({ id: "a", color: "yellow", matchSecond: 40 });
    const done = card({ id: "d", color: "yellow", matchSecond: 0 });
    const red = card({ id: "e", color: "red", matchSecond: 0 });
    expect(
      runningYellows([later, done, red, soon, same], 120, 120).map(
        (item) => item.id
      )
    ).toEqual(["a", "b", "c"]);
  });
});

describe("isExpelled", () => {
  test("vermelho direto ou de segundo amarelo expulsa; amarelo não", () => {
    const yellow = card({ id: "a", color: "yellow", matchSecond: 10 });
    const direct = card({ id: "b", color: "red", matchSecond: 20 });
    const second = card({
      id: "c",
      color: "red",
      matchSecond: 30,
      personId: "p2",
      redReason: "secondYellow",
    });
    expect(isExpelled([yellow], "p1")).toBe(false);
    expect(isExpelled([direct], "p1")).toBe(true);
    expect(isExpelled([second], "p1")).toBe(false);
    expect(isExpelled([second], "p2")).toBe(true);
  });
});
