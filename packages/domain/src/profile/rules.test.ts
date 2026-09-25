import { describe, expect, test } from "bun:test";
import { isOldEnough, isRealDate, isValidPositionSet } from "./rules";

const hoje = new Date("2026-03-15T12:00:00Z");

describe("isOldEnough", () => {
  test("faz 16 anos hoje: pode", () => {
    expect(isOldEnough("2010-03-15", hoje)).toBe(true);
  });

  test("faz 16 amanhã: não pode", () => {
    expect(isOldEnough("2010-03-16", hoje)).toBe(false);
  });

  test("data inválida não passa", () => {
    expect(isOldEnough("banana", hoje)).toBe(false);
  });
});

describe("isRealDate", () => {
  test("31 de fevereiro não existe", () => {
    expect(isRealDate("1991-02-31")).toBe(false);
  });

  test("29 de fevereiro em bissexto existe", () => {
    expect(isRealDate("1992-02-29")).toBe(true);
    expect(isRealDate("1991-02-29")).toBe(false);
  });
});

describe("isValidPositionSet", () => {
  const gol = { playsAs: "GOALKEEPER" } as const;
  const linha = { playsAs: "OUTFIELD" } as const;

  test("goleiro sem posição", () => {
    expect(
      isValidPositionSet({
        ...gol,
        primaryPosition: null,
        secondaryPosition: null,
      })
    ).toBe(true);
    expect(
      isValidPositionSet({
        ...gol,
        primaryPosition: "DEFENDER",
        secondaryPosition: null,
      })
    ).toBe(false);
  });

  test("linha com principal e secundária diferente", () => {
    expect(
      isValidPositionSet({
        ...linha,
        primaryPosition: "DEFENDER",
        secondaryPosition: "MIDFIELDER",
      })
    ).toBe(true);
    expect(
      isValidPositionSet({
        ...linha,
        primaryPosition: "DEFENDER",
        secondaryPosition: "DEFENDER",
      })
    ).toBe(false);
  });

  test("COR (ANY) não tem secundária", () => {
    expect(
      isValidPositionSet({
        ...linha,
        primaryPosition: "ANY",
        secondaryPosition: null,
      })
    ).toBe(true);
    expect(
      isValidPositionSet({
        ...linha,
        primaryPosition: "ANY",
        secondaryPosition: "MIDFIELDER",
      })
    ).toBe(false);
  });

  test("secundária não pode ser COR", () => {
    expect(
      isValidPositionSet({
        ...linha,
        primaryPosition: "DEFENDER",
        secondaryPosition: "ANY",
      })
    ).toBe(false);
  });
});
