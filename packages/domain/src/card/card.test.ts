import { describe, expect, test } from "bun:test";
import { cardNameFit, initialsOf, levelFromOverall, roleBadge } from "./card";

describe("levelFromOverall", () => {
  test.each([
    [40, "base"],
    [59, "base"],
    [60, "promessa"],
    [74, "promessa"],
    [75, "craque"],
    [89, "craque"],
    [90, "monstro"],
    [98, "monstro"],
    [99, "lenda"],
  ] as const)("%i → %s", (overall, level) => {
    expect(levelFromOverall(overall)).toBe(level);
  });
});

describe("roleBadge", () => {
  test("goleiro é GOL, sem olhar a Posição", () => {
    expect(roleBadge("GOALKEEPER", null)).toBe("GOL");
  });

  test.each([
    ["DEFENDER", "DEF"],
    ["MIDFIELDER", "MEI"],
    ["FORWARD", "ATA"],
    ["ANY", "TODAS"],
  ] as const)("linha em %s → %s", (position, badge) => {
    expect(roleBadge("OUTFIELD", position)).toBe(badge);
  });

  test("linha sem Posição escolhida ainda não tem sigla", () => {
    expect(roleBadge("OUTFIELD", null)).toBeNull();
  });
});

describe("initialsOf", () => {
  test("primeira e última palavra", () => {
    expect(initialsOf("Zé Pequeno")).toBe("ZP");
    expect(initialsOf("Marcos da Silva")).toBe("MS");
  });

  test("uma palavra usa as duas primeiras letras", () => {
    expect(initialsOf("Tavinho")).toBe("TA");
  });

  test("espaços extras e nome vazio", () => {
    expect(initialsOf("  Seu   Jorge ")).toBe("SJ");
    expect(initialsOf("   ")).toBe("");
  });

  test("acento fica", () => {
    expect(initialsOf("élder ávila")).toBe("ÉÁ");
  });
});

describe("cardNameFit", () => {
  test("até 11 caracteres: 28", () => {
    expect(cardNameFit("Zé Pequeno")).toEqual({
      text: "ZÉ PEQUENO",
      fontSize: 28,
    });
    expect(cardNameFit("Seu Osvaldo")).toEqual({
      text: "SEU OSVALDO",
      fontSize: 28,
    });
  });

  test("12 a 14 caracteres: 24, sem cortar", () => {
    expect(cardNameFit("Marcos Silva")).toEqual({
      text: "MARCOS SILVA",
      fontSize: 24,
    });
    expect(cardNameFit("Marcos Vinicio")).toEqual({
      text: "MARCOS VINICIO",
      fontSize: 24,
    });
  });

  test("mais de 14: corta em 13 + reticências (exemplo do design system)", () => {
    expect(cardNameFit("Wellington Júnior")).toEqual({
      text: "WELLINGTON JÚ…",
      fontSize: 24,
    });
  });

  test("não deixa espaço antes da reticência", () => {
    expect(cardNameFit("Marcos Silva Neto").text).toBe("MARCOS SILVA…");
  });

  test("nome vazio", () => {
    expect(cardNameFit("  ")).toEqual({ text: "", fontSize: 28 });
  });
});
