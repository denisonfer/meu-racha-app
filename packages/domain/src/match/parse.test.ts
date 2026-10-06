import { describe, expect, test } from "bun:test";
import {
  MATCH_PAYLOAD_INVALID,
  parseEventMatch,
  parseMatchFinishPreview,
} from "./parse";
import {
  MATCH_OPEN,
  MATCH_OPEN_CARD,
  MATCH_OPEN_DONOR,
  MATCH_OPEN_EVENTS,
  MATCH_OPEN_FIELD_DRAW,
  MATCH_OPEN_PENDING_SELF,
  MATCH_PREVIEW,
  MATCH_READY,
} from "./parse.fixtures";

const photo = (path: string | null) => (path ? `https://x/${path}` : null);

describe("parseEventMatch", () => {
  test("open mapeia Partida, Gol, fila e viewer", () => {
    const portrait = parseEventMatch(MATCH_OPEN, photo);
    expect(portrait).toMatchObject({
      eventId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      eventStatus: "active",
      state: "open",
      durationMin: 7,
      yellowCardMode: "timed",
      yellowOutMin: 2,
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

  test("open mapeia elenco do lado, donors vazios e destino em campo", () => {
    const portrait = parseEventMatch(MATCH_OPEN, photo);
    expect(portrait.match?.home).toMatchObject({
      outfieldCount: 5,
      capacity: 5,
    });
    expect(portrait.match?.away).toMatchObject({
      outfieldCount: 4,
      capacity: 5,
    });
    expect(portrait.match?.home.lineup[0]).toMatchObject({
      role: "OUTFIELD",
      person: { displayName: "Lucas M." },
      entryKind: "start",
      leftBySelf: false,
      leftByRed: false,
      leftAt: null,
    });
    expect(portrait.match?.cards).toEqual([]);
    expect(portrait.match?.lineup[0]).toMatchObject({
      role: "GOALKEEPER",
      entryKind: "goalkeeper",
    });
    expect(portrait.reinforcementDonors).toEqual([]);
    expect(portrait.pendingReinforcements).toEqual([]);
    expect(portrait.events[0]).toMatchObject({ kind: "goal", teamNumber: 1 });
    expect(portrait.nextArrival).toEqual({
      kind: "field",
      teamId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      teamNumber: 2,
    });
    expect(portrait.nextMatch).toBeNull();
  });

  test("ready mapeia próximo confronto sem os campos de elenco do lado", () => {
    const portrait = parseEventMatch(MATCH_READY, photo);
    expect(portrait.state).toBe("ready");
    expect(portrait.match).toBeNull();
    expect(portrait.durationMin).toBeNull();
    expect(portrait.yellowCardMode).toBe("mark");
    expect(portrait.yellowOutMin).toBe(7);
    expect(portrait.pausedSeconds).toBeNull();
    expect(portrait.nextMatch).toMatchObject({
      isRematch: true,
      home: { teamNumber: 1 },
      away: { goalkeeper: null },
    });
    expect(portrait.nextMatch?.home).not.toHaveProperty("outfieldCount");
    expect(portrait.nextMatch?.home).not.toHaveProperty("lineup");
    expect(portrait.finishedMatches[0]).toMatchObject({
      status: "finished",
      winnerTeamId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(portrait.finishedMatches[0]?.home.outfieldCount).toBe(5);
    expect(portrait.viewer.canConduct).toBe(false);
    expect(portrait.reinforcementDonors).toEqual([]);
    expect(portrait.events).toEqual([]);
    expect(portrait.nextArrival).toEqual({
      kind: "new_team",
      teamId: null,
      teamNumber: 3,
    });
  });

  test("doador com um jogador de linha", () => {
    const portrait = parseEventMatch(MATCH_OPEN_DONOR, photo);
    expect(portrait.reinforcementDonors).toEqual([
      {
        teamId: "88888888-8888-8888-8888-888888888888",
        teamNumber: 4,
        queuePosition: 1,
        outfieldCount: 1,
      },
    ]);
    expect(portrait.nextArrival).toMatchObject({
      kind: "queue",
      teamNumber: 4,
    });
  });

  test("saída própria pendente", () => {
    const portrait = parseEventMatch(MATCH_OPEN_PENDING_SELF, photo);
    expect(portrait.pendingReinforcements).toEqual([
      {
        person: expect.objectContaining({ displayName: "Lucas M." }),
        teamId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        teamNumber: 2,
        leftAt: "2026-10-04T15:03:00+00:00",
      },
    ]);
  });

  test("field_draw deixa teamId e teamNumber nulos", () => {
    const portrait = parseEventMatch(MATCH_OPEN_FIELD_DRAW, photo);
    expect(portrait.nextArrival).toEqual({
      kind: "field_draw",
      teamId: null,
      teamNumber: null,
    });
  });

  test("cartão no retrato e lance de cartão", () => {
    const portrait = parseEventMatch(MATCH_OPEN_CARD, photo);
    expect(portrait.match?.cards[0]).toMatchObject({
      id: "12121212-1212-1212-1212-121212121212",
      color: "yellow",
      redReason: null,
      isGoalkeeper: false,
      matchSecond: 340,
      person: { displayName: "Lucas M." },
      teamId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(portrait.match?.home.lineup[0]?.leftByRed).toBe(false);
    expect(portrait.match?.lineup[0]).toMatchObject({
      leftByRed: true,
      leftAt: "2026-10-04T15:06:40+00:00",
    });
    expect(portrait.events[0]).toMatchObject({
      kind: "card",
      color: "red",
      redReason: "secondYellow",
      isGoalkeeper: true,
      matchSecond: 400,
      teamNumber: 1,
      person: { displayName: "Caio" },
    });
  });

  test("lista de lances com os cinco kinds", () => {
    const portrait = parseEventMatch(MATCH_OPEN_EVENTS, photo);
    expect(portrait.events.map((item) => item.kind)).toEqual([
      "reinforcement",
      "leave",
      "goal",
      "inclusion",
      "return",
    ]);
    expect(portrait.events[0]).toMatchObject({
      kind: "reinforcement",
      entered: { displayName: "Pedro H." },
      left: { displayName: "Lucas M." },
      fromTeamNumber: 3,
      toTeamNumber: 2,
      teamDrawn: false,
    });
    expect(portrait.events[1]).toMatchObject({
      kind: "leave",
      person: { displayName: "Lucas M." },
      bySelf: true,
      reinforced: true,
      outfieldCount: 4,
      capacity: 5,
    });
    expect(portrait.events[3]).toMatchObject({
      kind: "inclusion",
      person: { displayName: "Caio" },
      teamNumber: 1,
    });
    expect(portrait.events[4]).toMatchObject({
      kind: "return",
      person: { displayName: "Avulso Z" },
      teamNumber: 2,
    });
  });

  test.each([
    ["não é objeto", null],
    ["estado desconhecido", { ...MATCH_OPEN, state: "between" }],
    ["sem viewer", { ...MATCH_OPEN, viewer: null }],
    [
      "lado sem score",
      { ...MATCH_OPEN, match: { ...MATCH_OPEN.match, home: { team_id: "x" } } },
    ],
    ["sem donors", { ...MATCH_OPEN, reinforcement_donors: undefined }],
    ["sem events", { ...MATCH_OPEN, events: undefined }],
    [
      "sem cards",
      { ...MATCH_OPEN, match: { ...MATCH_OPEN.match, cards: undefined } },
    ],
    [
      "vermelho sem motivo",
      {
        ...MATCH_OPEN,
        match: {
          ...MATCH_OPEN.match,
          cards: [
            {
              id: "x",
              person: {
                kind: "member",
                person_id: "p",
                profile_id: "p",
                guest_id: null,
                display_name: "A",
                avatar_path: null,
              },
              team_id: "t",
              is_goalkeeper: false,
              color: "red",
              red_reason: null,
              match_second: 1,
              created_at: "2026-10-04T15:00:00+00:00",
            },
          ],
        },
      },
    ],
    ["sem next_arrival", { ...MATCH_OPEN, next_arrival: undefined }],
    [
      "kind de lance desconhecido",
      { ...MATCH_OPEN, events: [{ kind: "include" }] },
    ],
    [
      "field_draw com Time",
      {
        ...MATCH_OPEN,
        next_arrival: {
          kind: "field_draw",
          team_id: "x",
          team_number: 1,
        },
      },
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
