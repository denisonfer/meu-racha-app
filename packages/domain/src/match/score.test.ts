import { describe, expect, test } from "bun:test";
import { applyGoal, score, type Goal, type LiveMatch } from "./score";

const match: LiveMatch = {
  id: "m1",
  seq: 1,
  homeTeamId: "verde",
  awayTeamId: "preto",
  goals: [],
};

const goal = (id: string, teamId: string): Goal => ({
  id,
  teamId,
  scorerId: "p1",
  assistById: null,
});

describe("score", () => {
  test("partida sem Gol começa 0 a 0", () => {
    expect(score(match)).toEqual({ home: 0, away: 0 });
  });

  test("conta Gol de cada lado", () => {
    const m = applyGoal(applyGoal(match, goal("g1", "verde"), 2), goal("g2", "preto"), 3);
    expect(score(m)).toEqual({ home: 1, away: 1 });
  });
});

describe("applyGoal", () => {
  test("o mesmo Gol aplicado duas vezes não duplica", () => {
    const once = applyGoal(match, goal("g1", "verde"), 2);
    const twice = applyGoal(once, goal("g1", "verde"), 3);
    expect(score(twice)).toEqual({ home: 1, away: 0 });
    expect(twice.seq).toBe(2); // o seq do duplicado é ignorado junto com ele
  });

  test("não muta o estado anterior", () => {
    const depois = applyGoal(match, goal("g1", "verde"), 2);
    expect(match.goals).toHaveLength(0);
    expect(depois.goals).toHaveLength(1);
  });

  test("gol contra sobe o placar sem creditar ninguém", () => {
    const m = applyGoal(match, { ...goal("g1", "verde"), scorerId: null }, 2);
    expect(score(m)).toEqual({ home: 1, away: 0 });
    expect(m.goals[0]?.scorerId).toBeNull();
  });
});
