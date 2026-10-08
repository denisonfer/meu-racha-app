import { describe, expect, test } from "bun:test";
import type { TMemberCard } from "@meu-racha/domain";
import { cardOverall, memberCardProps } from "./member-card";

const keeper = {
  displayName: "Diego",
  photoUrl: null,
  playsAs: "GOALKEEPER" as const,
  primaryPosition: null,
};

const line = {
  displayName: "Diego",
  photoUrl: null,
  playsAs: "OUTFIELD" as const,
  primaryPosition: "FORWARD" as const,
};

describe("memberCardProps", () => {
  test("goleiro sem gol não ganha a quarta estatística, e o contexto é a Temporada", () => {
    const props = memberCardProps(
      keeper,
      false,
      {
        shownRole: "GOALKEEPER",
        overall: 55,
        seasonYear: 2026,
        playsAs: "GOALKEEPER",
        primaryPosition: null,
        line: { matches: 0, goals: 0, assists: 0, wins: 0 },
        keeper: { matches: 4, wins: 2, cleanSheets: 3, goals: 0 },
      },
      "Amigos do Jardins da Serra"
    );

    expect(props.overall).toBe(55);
    expect(props.badge).toBe("GOL");
    expect(props.stats.map((stat) => stat.label)).toEqual([
      "VITÓRIAS",
      "SEM SOFRER",
      "PARTIDAS",
    ]);
    expect(props.context).toBe("Amigos do Jardins da Serra · Temporada 2026");
  });

  test("sem carta, Overall de entrada e números zerados", () => {
    const props = memberCardProps(line, false);

    expect(props.overall).toBe(40);
    expect(props.badge).toBe("ATA");
    expect(props.context).toBe("Overall de entrada");
    expect(props.stats).toEqual([
      { label: "VITÓRIAS", value: 0 },
      { label: "GOLS", value: 0 },
      { label: "ASSIST.", value: 0 },
      { label: "PARTIDAS", value: 0 },
    ]);
  });

  test("papel mostrado de linha usa a posição do Racha, mesmo com Onde joga de goleiro", () => {
    const props = memberCardProps(keeper, false, {
      shownRole: "LINE",
      overall: 50,
      seasonYear: 2026,
      playsAs: "GOALKEEPER",
      primaryPosition: "DEFENDER",
      line: { matches: 4, goals: 1, assists: 0, wins: 1 },
      keeper: { matches: 1, wins: 0, cleanSheets: 0, goals: 0 },
    });

    expect(props.badge).toBe("DEF");
    expect(props.stats.map((stat) => stat.label)).toEqual([
      "VITÓRIAS",
      "GOLS",
      "ASSIST.",
      "PARTIDAS",
    ]);
  });
});

describe("cardOverall", () => {
  const card: TMemberCard = {
    profileId: "11111111-1111-1111-1111-111111111111",
    shownRole: "LINE",
    overall: 72,
    seasonYear: 2026,
    playsAs: "OUTFIELD",
    primaryPosition: "MIDFIELDER",
    line: { matches: 3, goals: 1, assists: 0, wins: 1 },
    keeper: { matches: 0, wins: 0, cleanSheets: 0, goals: 0 },
  };
  const cards = new Map([[card.profileId, card]]);

  test("Avulso e quem não está no mapa ficam em 40", () => {
    expect(cardOverall(cards, null)).toBe(40);
    expect(cardOverall(undefined, card.profileId)).toBe(40);
    expect(cardOverall(cards, "outro")).toBe(40);
    expect(cardOverall(cards, card.profileId)).toBe(72);
  });
});
