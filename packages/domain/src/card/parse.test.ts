import { describe, expect, test } from "bun:test";
import { seasonLabel } from "./card";
import {
  CARD_PAYLOAD_INVALID,
  parseMyProfileCard,
  parseRachaCards,
} from "./parse";

const LINE = {
  profile_id: "11111111-1111-1111-1111-111111111111",
  shown_role: "LINE",
  overall: 47,
  line: { matches: 3, goals: 2, assists: 1, wins: 1 },
  keeper: { matches: 0, wins: 0, clean_sheets: 0, goals: 0 },
  season_year: 2026,
  plays_as: "OUTFIELD",
  primary_position: "FORWARD",
};

const KEEPER = {
  profile_id: "22222222-2222-2222-2222-222222222222",
  shown_role: "GOALKEEPER",
  overall: 40,
  line: { matches: 1, goals: 0, assists: 0, wins: 0 },
  keeper: { matches: 2, wins: 1, clean_sheets: 1, goals: 0 },
  season_year: 2026,
  plays_as: "GOALKEEPER",
  primary_position: null,
};

describe("parseRachaCards", () => {
  test("parseia linha e goleiro, e preserva gols zerados do goleiro", () => {
    expect(parseRachaCards([LINE, KEEPER])).toEqual([
      {
        profileId: LINE.profile_id,
        shownRole: "LINE",
        overall: 47,
        line: { matches: 3, goals: 2, assists: 1, wins: 1 },
        keeper: { matches: 0, wins: 0, cleanSheets: 0, goals: 0 },
        seasonYear: 2026,
        playsAs: "OUTFIELD",
        primaryPosition: "FORWARD",
      },
      {
        profileId: KEEPER.profile_id,
        shownRole: "GOALKEEPER",
        overall: 40,
        line: { matches: 1, goals: 0, assists: 0, wins: 0 },
        keeper: { matches: 2, wins: 1, cleanSheets: 1, goals: 0 },
        seasonYear: 2026,
        playsAs: "GOALKEEPER",
        primaryPosition: null,
      },
    ]);
  });

  test("rejeita o que não é array e papel desconhecido", () => {
    expect(() => parseRachaCards(null)).toThrow(CARD_PAYLOAD_INVALID);
    expect(() => parseRachaCards({ ...LINE })).toThrow(CARD_PAYLOAD_INVALID);
    expect(() =>
      parseRachaCards([{ ...LINE, shown_role: "OUTFIELD" }])
    ).toThrow(CARD_PAYLOAD_INVALID);
    const { plays_as: _playsAs, ...noPlays } = LINE;
    const { primary_position: _position, ...noPosition } = LINE;
    expect(() => parseRachaCards([noPlays])).toThrow(CARD_PAYLOAD_INVALID);
    expect(() => parseRachaCards([noPosition])).toThrow(CARD_PAYLOAD_INVALID);
  });

  test("rejeita número que não é inteiro", () => {
    expect(() => parseRachaCards([{ ...LINE, overall: 47.5 }])).toThrow(
      CARD_PAYLOAD_INVALID
    );
  });
});

describe("parseMyProfileCard", () => {
  test("SQL null devolve null", () => {
    expect(parseMyProfileCard(null)).toBeNull();
  });

  test("parseia o Racha e a carta", () => {
    expect(
      parseMyProfileCard({
        racha_name: "Amigos do Jardins da Serra",
        card: KEEPER,
      })
    ).toEqual({
      rachaName: "Amigos do Jardins da Serra",
      card: {
        profileId: KEEPER.profile_id,
        shownRole: "GOALKEEPER",
        overall: 40,
        line: { matches: 1, goals: 0, assists: 0, wins: 0 },
        keeper: { matches: 2, wins: 1, cleanSheets: 1, goals: 0 },
        seasonYear: 2026,
        playsAs: "GOALKEEPER",
        primaryPosition: null,
      },
    });
  });

  test("rejeita objeto sem carta", () => {
    expect(() =>
      parseMyProfileCard({ racha_name: "Amigos", card: null })
    ).toThrow(CARD_PAYLOAD_INVALID);
  });
});

describe("seasonLabel", () => {
  test("rótulo da Temporada com o ano em que ela começou", () => {
    expect(seasonLabel(2026)).toBe("Temporada 2026");
  });
});
