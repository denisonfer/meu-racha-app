import { describe, expect, test } from "bun:test";
import {
  parseSeasonEvents,
  parseSeasonRanking,
  SEASON_PAYLOAD_INVALID,
} from "./parse";

const photo = (path: string | null) => (path ? `https://x/${path}` : null);

const RANKING = {
  season_year: 2026,
  members: [
    {
      profile_id: "11111111-1111-1111-1111-111111111111",
      display_name: "Diego",
      avatar_path: "diego.jpg",
      is_active: true,
      overall: 64,
      goals: 7,
      assists: 2,
      wins: 5,
    },
    {
      profile_id: "22222222-2222-2222-2222-222222222222",
      display_name: "Juninho",
      avatar_path: null,
      is_active: false,
      overall: 40,
      goals: 0,
      assists: 1,
      wins: 0,
    },
  ],
};

const EVENTS = [
  {
    event_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    starts_on: "2026-10-04",
    place: "Arena Jardins da Serra",
    match_count: 5,
    scorers: ["Diego"],
    top_goals: 3,
  },
  {
    event_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    starts_on: "2026-09-27",
    place: "Quadra 2",
    match_count: 0,
    scorers: [],
    top_goals: 0,
  },
];

describe("parseSeasonRanking", () => {
  test("parseia o payload válido em camelCase e resolve a foto", () => {
    expect(parseSeasonRanking(RANKING, photo)).toEqual({
      seasonYear: 2026,
      members: [
        {
          profileId: "11111111-1111-1111-1111-111111111111",
          displayName: "Diego",
          photoUrl: "https://x/diego.jpg",
          isActive: true,
          overall: 64,
          goals: 7,
          assists: 2,
          wins: 5,
        },
        {
          profileId: "22222222-2222-2222-2222-222222222222",
          displayName: "Juninho",
          photoUrl: null,
          isActive: false,
          overall: 40,
          goals: 0,
          assists: 1,
          wins: 0,
        },
      ],
    });
  });

  test("rejeita array, string no lugar de int e chave faltando", () => {
    expect(() => parseSeasonRanking([], photo)).toThrow(SEASON_PAYLOAD_INVALID);
    expect(() =>
      parseSeasonRanking({ ...RANKING, season_year: "2026" }, photo)
    ).toThrow(SEASON_PAYLOAD_INVALID);
    const { season_year: _year, ...noYear } = RANKING;
    expect(() => parseSeasonRanking(noYear, photo)).toThrow(
      SEASON_PAYLOAD_INVALID
    );
  });
});

describe("parseSeasonEvents", () => {
  test("parseia o array válido em camelCase e aceita lista vazia", () => {
    expect(parseSeasonEvents(EVENTS)).toEqual([
      {
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        startsOn: "2026-10-04",
        place: "Arena Jardins da Serra",
        matchCount: 5,
        scorers: ["Diego"],
        topGoals: 3,
      },
      {
        eventId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        startsOn: "2026-09-27",
        place: "Quadra 2",
        matchCount: 0,
        scorers: [],
        topGoals: 0,
      },
    ]);
    expect(parseSeasonEvents([])).toEqual([]);
  });

  test("rejeita objeto no lugar do array e número que não é inteiro", () => {
    expect(() => parseSeasonEvents(EVENTS[0])).toThrow(SEASON_PAYLOAD_INVALID);
    expect(() =>
      parseSeasonEvents([{ ...EVENTS[0], match_count: 1.5 }])
    ).toThrow(SEASON_PAYLOAD_INVALID);
  });
});
