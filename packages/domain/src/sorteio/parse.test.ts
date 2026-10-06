import { describe, expect, test } from "bun:test";
import {
  parsePublishedSort,
  parseSortProposal,
  SORT_PAYLOAD_INVALID,
} from "./parse";
import {
  PROPOSAL_NONE,
  PROPOSAL_NOT_ATTENDED,
  PROPOSAL_READY,
  PROPOSAL_STALE,
  PUBLISHED,
} from "./parse.fixtures";

const photo = (path: string | null) => (path ? `https://x/${path}` : null);

describe("parseSortProposal", () => {
  test("none e stale trazem só as contagens da S1", () => {
    for (const [json, state] of [
      [PROPOSAL_NONE, "none"],
      [PROPOSAL_STALE, "stale"],
    ] as const) {
      const proposal = parseSortProposal(json, photo);
      expect(proposal.state).toBe(state);
      expect(proposal.minLinePlayers).toBe(6);
      expect("teams" in proposal).toBe(false);
    }
    expect(parseSortProposal(PROPOSAL_NONE, photo)).toMatchObject({
      lineCount: 7,
      goalkeeperCount: 3,
      canSort: true,
      confirmedCount: 10,
      notAttendedCount: 0,
    });
    expect(parseSortProposal(PROPOSAL_NOT_ATTENDED, photo)).toMatchObject({
      lineCount: 6,
      confirmedCount: 11,
      notAttendedCount: 5,
    });
  });

  test("ready mapeia Times, sobra, Goleiro por Time e score", () => {
    const proposal = parseSortProposal(PROPOSAL_READY, photo);
    if (proposal.state !== "ready") throw new Error("esperava ready");
    expect(proposal.version).toBe(1);
    expect(proposal.balance).toEqual({
      score: 91.67,
      label: "Muito equilibrado",
      diff: 1,
      superDiff: 0,
      cappedBySuper: false,
    });
    expect(proposal.teams.map((t) => t.isComplete)).toEqual([
      true,
      true,
      false,
    ]);
    expect(proposal.teams[0]?.players[0]).toMatchObject({
      displayName: "Jogador C",
      stars: 4,
      primaryPosition: "DEFENDER",
      photoUrl: null,
    });
    expect(proposal.teams[2]?.goalkeeper?.displayName).toBe("Goleiro A");
    expect(proposal.goalkeepersPerTeam).toBe(true);
    expect(proposal.goalkeeperQueue).toEqual([]);
    expect(proposal.superWarning).toEqual([]);
  });

  test("aviso de Super Estrelas: team_index vira número do Time", () => {
    const withWarning = {
      ...PROPOSAL_READY,
      super_warning: [{ team_index: 0, player_ids: ["a", "b", "c"] }],
    };
    const proposal = parseSortProposal(withWarning, photo);
    if (proposal.state !== "ready") throw new Error("esperava ready");
    expect(proposal.superWarning).toEqual([
      { teamNumber: 1, playerIds: ["a", "b", "c"] },
    ]);
  });

  test("resolve a foto pelo resolvedor recebido", () => {
    const withAvatar = structuredClone(PROPOSAL_READY);
    (
      withAvatar.teams[0]!.players[0] as { avatar_path: string | null }
    ).avatar_path = "p/1.png";
    const proposal = parseSortProposal(withAvatar, photo);
    if (proposal.state !== "ready") throw new Error("esperava ready");
    expect(proposal.teams[0]?.players[0]?.photoUrl).toBe("https://x/p/1.png");
  });

  test.each([
    ["não é objeto", null],
    ["estado desconhecido", { ...PROPOSAL_NONE, state: "x" }],
    ["sem contagem", { state: "none", event_id: "e" }],
    [
      "rótulo fora do conjunto",
      {
        ...PROPOSAL_READY,
        balance: { ...PROPOSAL_READY.balance, label: "Ótimo" },
      },
    ],
  ])("rejeita %s", (_name, json) => {
    expect(() => parseSortProposal(json, photo)).toThrow(SORT_PAYLOAD_INVALID);
  });
});

describe("parsePublishedSort", () => {
  test("state none", () => {
    expect(parsePublishedSort({ state: "none" }, photo)).toEqual({
      state: "none",
    });
  });

  test("published mapeia viewer, Avulso, fila, aguardando e saiu", () => {
    const sort = parsePublishedSort(PUBLISHED, photo);
    if (sort.state !== "published") throw new Error("esperava published");
    expect(sort).toMatchObject({
      eventStatus: "active",
      isConductor: true,
      outfieldPerTeam: 3,
      mode: "normal",
      viewer: {
        myStatus: null,
        canInclude: true,
        canReturn: true,
        canLeaveAny: true,
        canLeaveSelf: false,
      },
    });
    // score é histórico; somas atuais vêm dos Times
    expect(sort.balance.score).toBe(91.67);
    expect(sort.teams.map((t) => t.starSum)).toEqual([9, 9]);
    const guest = sort.teams[1]?.players.find((p) => p.kind === "guest");
    expect(guest).toMatchObject({
      displayName: "Avulso Z",
      isSuperStar: true,
      profileId: null,
    });
    expect(guest?.guestId).not.toBeNull();
    expect(sort.goalkeeperQueue.map((g) => g.queueOrder)).toEqual([1]);
    expect(sort.waitingForInclusion).toEqual([
      expect.objectContaining({
        displayName: "Jogador G",
        queuePosition: 1,
        playsAs: "OUTFIELD",
        reason: "waitlisted",
      }),
      expect.objectContaining({
        displayName: "Jogador H",
        queuePosition: null,
        reason: "not_attended",
      }),
    ]);
    expect(sort.left).toEqual([
      expect.objectContaining({ displayName: "Jogador B", didAttend: false }),
    ]);
    expect(sort.nextArrival).toEqual({
      kind: "queue",
      teamId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      teamNumber: 3,
    });
  });

  test("published traz a disponibilidade e sem última Bolinhas", () => {
    const sort = parsePublishedSort(PUBLISHED, photo);
    if (sort.state !== "published") throw new Error("esperava published");
    expect(sort.bolinhasAvailability).toBe("ok");
    expect(sort.lastBolinhas).toBeNull();
  });

  test("published mapeia a última Bolinhas com quem mudou", () => {
    const sort = parsePublishedSort(
      {
        ...PUBLISHED,
        bolinhas_availability: "no_receiver",
        last_bolinhas: {
          giver_team_number: 5,
          receiver_team_number: 4,
          all_move: false,
          created_at: "2026-10-05T20:00:00+00:00",
          moved: [
            {
              kind: "member",
              person_id: "1a989607-5dc4-47ee-8250-82567406d86c",
              profile_id: "1a989607-5dc4-47ee-8250-82567406d86c",
              guest_id: null,
              display_name: "Jogador D",
              avatar_path: null,
              from_team_number: 5,
            },
          ],
        },
      },
      photo
    );
    if (sort.state !== "published") throw new Error("esperava published");
    expect(sort.bolinhasAvailability).toBe("no_receiver");
    expect(sort.lastBolinhas).toMatchObject({
      giverTeamNumber: 5,
      receiverTeamNumber: 4,
      allMove: false,
    });
    expect(sort.lastBolinhas?.moved).toEqual([
      expect.objectContaining({ displayName: "Jogador D", fromTeamNumber: 5 }),
    ]);
  });

  test("rejeita published sem bolinhas_availability", () => {
    const { bolinhas_availability: _a, ...rest } = PUBLISHED;
    expect(() => parsePublishedSort(rest, photo)).toThrow(SORT_PAYLOAD_INVALID);
  });

  test("published mapeia field_draw sem Time", () => {
    const sort = parsePublishedSort(
      {
        ...PUBLISHED,
        next_arrival: { kind: "field_draw", team_id: null, team_number: null },
      },
      photo
    );
    if (sort.state !== "published") throw new Error("esperava published");
    expect(sort.nextArrival).toEqual({
      kind: "field_draw",
      teamId: null,
      teamNumber: null,
    });
  });

  test("Goleiro de Time ausente vira null (fila do gol)", () => {
    const queueOnly = structuredClone(PUBLISHED);
    queueOnly.goalkeepers_per_team = false;
    (queueOnly.teams[0] as { goalkeeper: unknown }).goalkeeper = null;
    const sort = parsePublishedSort(queueOnly, photo);
    if (sort.state !== "published") throw new Error("esperava published");
    expect(sort.teams[0]?.goalkeeper).toBeNull();
    expect(sort.goalkeepersPerTeam).toBe(false);
  });

  test("rejeita published sem viewer", () => {
    const { viewer: _viewer, ...rest } = PUBLISHED;
    expect(() => parsePublishedSort(rest, photo)).toThrow(SORT_PAYLOAD_INVALID);
  });

  test("rejeita published sem next_arrival", () => {
    const { next_arrival: _next, ...rest } = PUBLISHED;
    expect(() => parsePublishedSort(rest, photo)).toThrow(SORT_PAYLOAD_INVALID);
  });
});
