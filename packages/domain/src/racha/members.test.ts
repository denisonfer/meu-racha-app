import { describe, test, expect } from "bun:test";
import {
  formatPlaysAs,
  formatAge,
  isBelowMinAge,
  groupInOrder,
  groupMembersByPosition,
} from "./members";
import {
  asksPositionDetail,
  isLayerPending,
  LAYER_GROUPS,
  layerGroupKey,
  positionDetailFits,
  positionDetailOptions,
  toPositionLayer,
  type TPositionLayer,
} from "./position-detail";

describe("formatPlaysAs", () => {
  test("returns 'Gol' for goalkeeper", () => {
    expect(formatPlaysAs("GOALKEEPER", null, null)).toBe("Gol");
  });

  test("formats outfield with primary and secondary positions", () => {
    expect(formatPlaysAs("OUTFIELD", "MIDFIELDER", "FORWARD")).toBe(
      "Linha · MEI / ATA"
    );
  });

  test("formats outfield with ANY primary position", () => {
    expect(formatPlaysAs("OUTFIELD", "ANY", null)).toBe("Linha · TODAS");
  });

  test("formats outfield with DEFENDER primary position", () => {
    expect(formatPlaysAs("OUTFIELD", "DEFENDER", null)).toBe("Linha · DEF");
  });
});

describe("isBelowMinAge", () => {
  test("returns true when age is below minAge", () => {
    expect(isBelowMinAge(29, 30)).toBe(true);
  });

  test("returns false when age equals minAge", () => {
    expect(isBelowMinAge(30, 30)).toBe(false);
  });

  test("returns false when minAge is null", () => {
    expect(isBelowMinAge(20, null)).toBe(false);
  });
});

describe("formatAge", () => {
  test("returns age with years for normal age", () => {
    expect(formatAge(34, 30)).toBe("34 anos");
  });

  test("adds minimum age message when below", () => {
    expect(formatAge(28, 30)).toBe("28 anos · abaixo da idade mínima (30)");
  });

  test("returns age with years when minAge is null", () => {
    expect(formatAge(28, null)).toBe("28 anos");
  });

  test("returns age with years when equal to minAge", () => {
    expect(formatAge(30, 30)).toBe("30 anos");
  });
});

describe("groupMembersByPosition", () => {
  test("groups members by position in correct order", () => {
    const members = [
      {
        displayName: "Zé",
        playsAs: "OUTFIELD" as const,
        primaryPosition: "MIDFIELDER" as const,
      },
      {
        displayName: "André",
        playsAs: "OUTFIELD" as const,
        primaryPosition: "MIDFIELDER" as const,
      },
      {
        displayName: "João",
        playsAs: "GOALKEEPER" as const,
        primaryPosition: null,
      },
      {
        displayName: "Pedro",
        playsAs: "OUTFIELD" as const,
        primaryPosition: "FORWARD" as const,
      },
      {
        displayName: "Lucas",
        playsAs: "OUTFIELD" as const,
        primaryPosition: "ANY" as const,
      },
    ];

    const groups = groupMembersByPosition(members);

    expect(groups).toHaveLength(4);
    expect(groups[0]!.key).toBe("GOALKEEPER");
    expect(groups[0]!.label).toBe("Goleiros");
    expect(groups[0]!.members).toHaveLength(1);
    expect(groups[0]!.members[0]!.displayName).toBe("João");

    expect(groups[1]!.key).toBe("MIDFIELDER");
    expect(groups[1]!.label).toBe("Meias");
    expect(groups[1]!.members).toHaveLength(2);
    expect(groups[1]!.members[0]!.displayName).toBe("André");
    expect(groups[1]!.members[1]!.displayName).toBe("Zé");

    expect(groups[2]!.key).toBe("FORWARD");
    expect(groups[2]!.label).toBe("Atacantes");
    expect(groups[2]!.members).toHaveLength(1);
    expect(groups[2]!.members[0]!.displayName).toBe("Pedro");

    expect(groups[3]!.key).toBe("ANY");
    expect(groups[3]!.label).toBe("Todas as posições");
    expect(groups[3]!.members).toHaveLength(1);
    expect(groups[3]!.members[0]!.displayName).toBe("Lucas");
  });

  test("skips empty position groups", () => {
    const members = [
      {
        displayName: "João",
        playsAs: "GOALKEEPER" as const,
        primaryPosition: null,
      },
    ];

    const groups = groupMembersByPosition(members);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe("GOALKEEPER");
  });

  test("returns empty array for empty members list", () => {
    const groups = groupMembersByPosition([]);
    expect(groups).toHaveLength(0);
  });

  test("sorts members within groups by displayName in pt-BR locale", () => {
    const members = [
      {
        displayName: "Bruno",
        playsAs: "OUTFIELD" as const,
        primaryPosition: "MIDFIELDER" as const,
      },
      {
        displayName: "Álvaro",
        playsAs: "OUTFIELD" as const,
        primaryPosition: "MIDFIELDER" as const,
      },
    ];

    const groups = groupMembersByPosition(members);

    expect(groups[0]!.members[0]!.displayName).toBe("Álvaro");
    expect(groups[0]!.members[1]!.displayName).toBe("Bruno");
  });
});

const person = (
  displayName: string,
  primaryLayer: TPositionLayer | null,
  playsAs: "OUTFIELD" | "GOALKEEPER" = "OUTFIELD"
) => ({ displayName, playsAs, primaryLayer });

describe("groupMembersByPosition por camada (Evento 8+)", () => {
  test("ordem defesa → ataque, Goleiros à parte e pendente no fim", () => {
    const groups = groupMembersByPosition(
      [
        person("Rita", null),
        person("Bruno", "FORWARD"),
        person("Dani", "ANY"),
        person("Maria", "DEFENSIVE_MID"),
        person("Lucas", "ATTACKING_MID"),
        person("Ana", "FULL_BACK"),
        person("João", "CENTER_BACK"),
        person("Marcos", null, "GOALKEEPER"),
      ],
      LAYER_GROUPS,
      layerGroupKey
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Goleiros",
      "Zagueiros",
      "Laterais",
      "Volantes",
      "Meias",
      "Atacantes",
      "Todas",
      "Posição pendente",
    ]);
    expect(groups[0]!.members[0]!.displayName).toBe("Marcos");
    expect(groups[7]!.key).toBe("PENDING");
    expect(groups[7]!.members[0]!.displayName).toBe("Rita");
  });

  test("só grupos não vazios, em ordem alfabética dentro do grupo", () => {
    const groups = groupMembersByPosition(
      [person("Tiago", "CENTER_BACK"), person("Hugo", "CENTER_BACK")],
      LAYER_GROUPS,
      layerGroupKey
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe("CENTER_BACK");
    expect(groups[0]!.members.map((m) => m.displayName)).toEqual([
      "Hugo",
      "Tiago",
    ]);
  });

  test("Goleiro com camada nula não é pendente", () => {
    expect(isLayerPending(person("Marcos", null, "GOALKEEPER"))).toBe(false);
    expect(isLayerPending(person("Rita", null))).toBe(true);
    expect(isLayerPending(person("Ana", "FULL_BACK"))).toBe(false);
  });

  test("padrão continua pela zona ampla (aba Membros)", () => {
    const groups = groupMembersByPosition([
      {
        displayName: "Zé",
        playsAs: "OUTFIELD" as const,
        primaryPosition: "MIDFIELDER" as const,
      },
    ]);
    expect(groups[0]!.key).toBe("MIDFIELDER");
    expect(groups[0]!.label).toBe("Meias");
  });
});

describe("groupInOrder", () => {
  test("mantém a ordem de entrada dentro do grupo (cards de Time)", () => {
    const groups = groupInOrder(
      [
        person("Zé", "CENTER_BACK"),
        person("Bruno", "FORWARD"),
        person("Ana", "CENTER_BACK"),
      ],
      LAYER_GROUPS,
      layerGroupKey
    );
    expect(groups.map((group) => group.key)).toEqual([
      "CENTER_BACK",
      "FORWARD",
    ]);
    expect(groups[0]!.members.map((m) => m.displayName)).toEqual(["Zé", "Ana"]);
  });
});

describe("subdivisão de posição", () => {
  test("pergunta a partir de 8 na linha", () => {
    expect(asksPositionDetail(7)).toBe(false);
    expect(asksPositionDetail(8)).toBe(true);
    expect(asksPositionDetail(10)).toBe(true);
  });

  test("só DEFENSOR e MEIO_CAMPO têm opções", () => {
    expect(positionDetailOptions("DEFENDER").map((o) => o.label)).toEqual([
      "Zagueiro",
      "Lateral",
    ]);
    expect(positionDetailOptions("MIDFIELDER").map((o) => o.label)).toEqual([
      "Volante",
      "Meia",
    ]);
    expect(positionDetailOptions("FORWARD")).toEqual([]);
    expect(positionDetailOptions("ANY")).toEqual([]);
    expect(positionDetailOptions(null)).toEqual([]);
  });

  test("combina com a zona como position_detail_fits", () => {
    expect(positionDetailFits("DEFENDER", "CENTER_BACK")).toBe(true);
    expect(positionDetailFits("DEFENDER", "DEFENSIVE_MID")).toBe(false);
    expect(positionDetailFits("MIDFIELDER", "ATTACKING_MID")).toBe(true);
    expect(positionDetailFits("FORWARD", "FULL_BACK")).toBe(false);
    expect(positionDetailFits("FORWARD", null)).toBe(true);
  });

  test("camada desconhecida vira nula", () => {
    expect(toPositionLayer("FULL_BACK")).toBe("FULL_BACK");
    expect(toPositionLayer("GOALKEEPER")).toBeNull();
    expect(toPositionLayer(null)).toBeNull();
  });
});
