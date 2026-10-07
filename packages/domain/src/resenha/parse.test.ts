import { describe, expect, test } from "bun:test";
import {
  parseEventResenha,
  parseRachaLastResenha,
  RESENHA_PAYLOAD_INVALID,
} from "./parse";

const photo = (path: string | null) => (path ? `https://x/${path}` : null);

const person = (
  id: string,
  name: string,
  kind: "member" | "guest" = "member"
) => ({
  kind,
  person_id: id,
  profile_id: kind === "member" ? id : null,
  guest_id: kind === "guest" ? id : null,
  display_name: name,
  avatar_path: kind === "member" ? `${id}.jpg` : null,
});

const VALID = {
  starts_on: "2026-10-04",
  place: "Arena Jardins da Serra",
  racha_name: "Amigos do Jardins da Serra",
  match_count: 5,
  people: [
    {
      person: person("11111111-1111-1111-1111-111111111111", "Diego"),
      goals: 3,
      assists: 0,
      wins: 2,
    },
    {
      person: person(
        "22222222-2222-2222-2222-222222222222",
        "Juninho",
        "guest"
      ),
      goals: 1,
      assists: 2,
      wins: 1,
    },
  ],
  teams: [
    { team_number: 0, wins: 0 },
    { team_number: 1, wins: 1 },
    { team_number: 2, wins: 3 },
  ],
  cards: [
    {
      person: person("11111111-1111-1111-1111-111111111111", "Diego"),
      color: "yellow",
      match_number: 2,
    },
    {
      person: person("33333333-3333-3333-3333-333333333333", "Samuel"),
      color: "red",
      match_number: 4,
    },
  ],
  scorer_card: {
    display_name: "Diego",
    avatar_path: "diego.jpg",
    plays_as: "OUTFIELD",
    primary_position: "FORWARD",
    is_super_star: true,
  },
};

const LAST = {
  event_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  starts_on: "2026-10-04",
  match_count: 5,
  scorers: ["Diego"],
  top_goals: 3,
};

describe("parseEventResenha", () => {
  test("parseia o payload válido em camelCase e resolve a foto", () => {
    const resenha = parseEventResenha(VALID, photo);
    expect(resenha.startsOn).toBe("2026-10-04");
    expect(resenha.place).toBe("Arena Jardins da Serra");
    expect(resenha.rachaName).toBe("Amigos do Jardins da Serra");
    expect(resenha.matchCount).toBe(5);
    expect(resenha.people[0]).toMatchObject({
      goals: 3,
      assists: 0,
      wins: 2,
      person: {
        kind: "member",
        personId: "11111111-1111-1111-1111-111111111111",
        displayName: "Diego",
        photoUrl: "https://x/11111111-1111-1111-1111-111111111111.jpg",
      },
    });
    expect(resenha.people[1]?.person).toMatchObject({
      kind: "guest",
      photoUrl: null,
    });
    expect(resenha.teams).toEqual([
      { teamNumber: 0, wins: 0 },
      { teamNumber: 1, wins: 1 },
      { teamNumber: 2, wins: 3 },
    ]);
    expect(resenha.cards[1]).toMatchObject({
      color: "red",
      matchNumber: 4,
      person: { displayName: "Samuel" },
    });
    expect(resenha.scorerCard).toEqual({
      displayName: "Diego",
      photoUrl: "https://x/diego.jpg",
      playsAs: "OUTFIELD",
      primaryPosition: "FORWARD",
      isSuperStar: true,
    });
  });

  test("aceita scorer_card nulo", () => {
    const resenha = parseEventResenha({ ...VALID, scorer_card: null }, photo);
    expect(resenha.scorerCard).toBeNull();
  });

  test("rejeita payload que não é objeto", () => {
    expect(() => parseEventResenha(null, photo)).toThrow(
      RESENHA_PAYLOAD_INVALID
    );
    expect(() => parseEventResenha([], photo)).toThrow(RESENHA_PAYLOAD_INVALID);
  });

  test("rejeita cor de cartão desconhecida", () => {
    const bad = {
      ...VALID,
      cards: [{ ...VALID.cards[0], color: "green" }],
    };
    expect(() => parseEventResenha(bad, photo)).toThrow(
      RESENHA_PAYLOAD_INVALID
    );
  });
});

describe("parseRachaLastResenha", () => {
  test("SQL null devolve null", () => {
    expect(parseRachaLastResenha(null)).toBeNull();
  });

  test("parseia o resumo da home", () => {
    expect(parseRachaLastResenha(LAST)).toEqual({
      eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      startsOn: "2026-10-04",
      matchCount: 5,
      scorers: ["Diego"],
      topGoals: 3,
    });
  });

  test("rejeita resumo sem event_id", () => {
    const { event_id: _eventId, ...rest } = LAST;
    expect(() => parseRachaLastResenha(rest)).toThrow(RESENHA_PAYLOAD_INVALID);
  });
});
