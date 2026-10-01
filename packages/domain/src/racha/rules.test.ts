import { describe, expect, test } from "bun:test";
import {
  DEFAULT_RACHA_RULES,
  formatRulesSummary,
  isSameRules,
  RACHA_NAME_PATTERN,
  spotLimitFloor,
  type TRachaRules,
  type TTieRule,
} from "./rules";

describe("spotLimitFloor", () => {
  test("5 na linha → piso 10", () => {
    expect(spotLimitFloor(5)).toBe(10);
  });

  test("3 na linha → piso 6", () => {
    expect(spotLimitFloor(3)).toBe(6);
  });
});

describe("formatRulesSummary", () => {
  test("padrões do motor", () => {
    expect(formatRulesSummary(DEFAULT_RACHA_RULES)).toEqual([
      "5 na linha",
      "Rei da Quadra",
      "Sai ambos",
      "10 min",
    ]);
  });

  test("Rotação não mostra a regra de empate", () => {
    expect(
      formatRulesSummary({ ...DEFAULT_RACHA_RULES, gameMode: "ROTATION" })
    ).toEqual(["5 na linha", "Rotação", "10 min"]);
  });

  test("Máximo de Vitórias mostra o teto", () => {
    const summary = formatRulesSummary({
      ...DEFAULT_RACHA_RULES,
      gameMode: "MAX_WINS",
      maxConsecutiveWins: 3,
    });
    expect(summary[1]).toBe("Máx. 3 vitórias");
  });

  test("posição no sorteio entra antes da duração", () => {
    expect(
      formatRulesSummary({ ...DEFAULT_RACHA_RULES, considerPosition: true })
    ).toEqual([
      "5 na linha",
      "Rei da Quadra",
      "Sai ambos",
      "Posição no sorteio",
      "10 min",
    ]);
  });

  test("sem duração é sem relógio", () => {
    expect(
      formatRulesSummary({ ...DEFAULT_RACHA_RULES, matchDurationMin: null }).at(
        -1
      )
    ).toBe("sem relógio");
  });

  const tieLabels: [TTieRule, string][] = [
    ["BOTH_OUT", "Sai ambos"],
    ["BOTH_STAY", "Fica ambos"],
    ["PENALTIES", "Pênaltis"],
    ["CHALLENGER_WINS", "Desafiante leva"],
  ];
  for (const [tieRule, label] of tieLabels) {
    test(`empate ${tieRule} vira "${label}"`, () => {
      expect(formatRulesSummary({ ...DEFAULT_RACHA_RULES, tieRule })[2]).toBe(
        label
      );
    });
  }
});

describe("isSameRules", () => {
  test("cópia com os mesmos valores é igual", () => {
    expect(isSameRules(DEFAULT_RACHA_RULES, { ...DEFAULT_RACHA_RULES })).toBe(
      true
    );
  });

  const changes: Partial<TRachaRules> = {
    outfieldPerTeam: 6,
    gameMode: "ROTATION",
    maxConsecutiveWins: 3,
    tieRule: "PENALTIES",
    tieReturnOrder: "TEAM_ORDER",
    considerPosition: true,
    matchDurationMin: null,
  };
  for (const [key, value] of Object.entries(changes) as [
    keyof TRachaRules,
    TRachaRules[keyof TRachaRules],
  ][]) {
    test(`diferente em "${key}" não é igual`, () => {
      expect(
        isSameRules(DEFAULT_RACHA_RULES, {
          ...DEFAULT_RACHA_RULES,
          [key]: value,
        })
      ).toBe(false);
    });
  }
});

describe("RACHA_NAME_PATTERN", () => {
  for (const name of [
    "Racha da Quadra do Zé",
    "Racha 7 de Setembro",
    "D'Ávila F.C.",
  ]) {
    test(`aceita "${name}"`, () => {
      expect(RACHA_NAME_PATTERN.test(name)).toBe(true);
    });
  }

  for (const name of ["123", "7 de Setembro", "Racha 🔥", "Racha #1", " "]) {
    test(`recusa "${name}"`, () => {
      expect(RACHA_NAME_PATTERN.test(name)).toBe(false);
    });
  }
});
