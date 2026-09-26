import { describe, expect, test } from "bun:test";
import {
  DISPLAY_NAME_PATTERN,
  hasLetter,
  isNotTooOld,
  isOldEnough,
  isRealDate,
  isValidPositionSet,
} from "./rules";

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

describe("hasLetter", () => {
  test("recusa username só com número ou símbolo", () => {
    expect(hasLetter("1234")).toBe(false);
    expect(hasLetter("___")).toBe(false);
    expect(hasLetter("")).toBe(false);
  });

  test("aceita username com letra", () => {
    expect(hasLetter("ze10")).toBe(true);
    expect(hasLetter("zepequeno")).toBe(true);
  });
});

describe("DISPLAY_NAME_PATTERN", () => {
  test("aceita nome de gente", () => {
    for (const name of [
      "Zé",
      "José Pequeno",
      "D'Angelo",
      "Jean-Pierre",
      "J. Silva",
      "Müller",
    ]) {
      expect(DISPLAY_NAME_PATTERN.test(name)).toBe(true);
    }
  });

  test("recusa número e símbolo", () => {
    for (const name of [
      "1234",
      "1234a",
      "!@#$%a",
      "a!@#",
      "Zé10",
      "123 Silva",
    ]) {
      expect(DISPLAY_NAME_PATTERN.test(name)).toBe(false);
    }
  });
});

describe("isNotTooOld", () => {
  test("01/03/1000 não é data de nascimento", () => {
    expect(isNotTooOld("1000-03-01", hoje)).toBe(false);
  });

  test("90 anos passa, 91 não", () => {
    expect(isNotTooOld("1936-03-15", hoje)).toBe(true);
    expect(isNotTooOld("1935-03-15", hoje)).toBe(false);
  });
});
