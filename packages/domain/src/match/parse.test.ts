import { describe, expect, test } from "bun:test";
import {
  MATCH_PAYLOAD_INVALID,
  parseEventMatch,
  parseMatchFinishPreview,
} from "./parse";
import { MATCH_OPEN, MATCH_PREVIEW, MATCH_READY } from "./parse.fixtures";

const photo = (path: string | null) => (path ? `https://x/${path}` : null);

describe("parseEventMatch", () => {
  test("open mapeia Partida, Gol, fila e viewer", () => {
    const portrait = parseEventMatch(MATCH_OPEN, photo);
    expect(portrait).toMatchObject({
      eventId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      eventStatus: "active",
      state: "open",
      durationMin: 7,
      pausedSeconds: 12,
      seq: 41,
      viewer: { canConduct: true },
    });
    expect(portrait.match?.home).toMatchObject({
      teamNumber: 1,
      score: 1,
      isComplete: true,
    });
    expect(portrait.match?.goals[0]).toMatchObject({
      teamNumber: 1,
      isOwnGoal: false,
      scorer: { displayName: "Caio", photoUrl: "https://x/p/caio.png" },
      assist: null,
    });
    expect(portrait.nextMatch).toBeNull();
    expect(portrait.goalkeeperQueue[0]?.person.kind).toBe("guest");
  });

  test("ready mapeia próximo confronto e Partidas encerradas", () => {
    const portrait = parseEventMatch(MATCH_READY, photo);
    expect(portrait.state).toBe("ready");
    expect(portrait.match).toBeNull();
    expect(portrait.durationMin).toBeNull();
    expect(portrait.pausedSeconds).toBeNull();
    expect(portrait.nextMatch).toMatchObject({
      isRematch: true,
      home: { teamNumber: 1 },
      away: { goalkeeper: null },
    });
    expect(portrait.finishedMatches[0]).toMatchObject({
      status: "finished",
      winnerTeamId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(portrait.viewer.canConduct).toBe(false);
  });

  test.each([
    ["não é objeto", null],
    ["estado desconhecido", { ...MATCH_OPEN, state: "between" }],
    ["sem viewer", { ...MATCH_OPEN, viewer: null }],
    [
      "lado sem score",
      { ...MATCH_OPEN, match: { ...MATCH_OPEN.match, home: { team_id: "x" } } },
    ],
  ])("rejeita %s", (_name, json) => {
    expect(() => parseEventMatch(json, photo)).toThrow(MATCH_PAYLOAD_INVALID);
  });
});

describe("parseMatchFinishPreview", () => {
  test("mapeia placar e consequência", () => {
    expect(parseMatchFinishPreview(MATCH_PREVIEW)).toEqual({
      matchId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      score: { home: 1, away: 0 },
      winnerTeamId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      decidedByPenalties: false,
      consequence: "winner_stays",
      fallback: null,
      nextIsRematch: false,
      nextChallengerTeamId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    });
  });

  test("rejeita sem placar", () => {
    const { score: _score, ...rest } = MATCH_PREVIEW;
    expect(() => parseMatchFinishPreview(rest)).toThrow(MATCH_PAYLOAD_INVALID);
  });
});
