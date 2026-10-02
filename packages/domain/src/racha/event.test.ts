import { describe, expect, test } from "bun:test";
import {
  formatEventWhen,
  isCivilDateBefore,
  isEventPlaceAllowed,
  isEventStartNotFuture,
} from "./event";

describe("isEventPlaceAllowed", () => {
  test("recusa vazio e A definir", () => {
    expect(isEventPlaceAllowed("")).toBe(false);
    expect(isEventPlaceAllowed("  A definir  ")).toBe(false);
  });
  test("aceita um local de verdade", () => {
    expect(isEventPlaceAllowed(" Quadra do Zé ")).toBe(true);
  });
});

describe("isCivilDateBefore", () => {
  test("ontem é passado e hoje não é", () => {
    expect(isCivilDateBefore("2026-09-30", "2026-10-01")).toBe(true);
    expect(isCivilDateBefore("2026-10-01", "2026-10-01")).toBe(false);
  });
});

describe("isEventStartNotFuture", () => {
  test("rejeita hora passada e minuto atual; aceita minuto seguinte e amanhã", () => {
    const now = "2026-10-01T23:05:11";
    expect(isEventStartNotFuture("2026-10-01", 19, 0, now)).toBe(true);
    expect(isEventStartNotFuture("2026-10-01", 23, 5, now)).toBe(true);
    expect(isEventStartNotFuture("2026-10-01", 23, 6, now)).toBe(false);
    expect(isEventStartNotFuture("2026-10-02", 0, 0, now)).toBe(false);
  });
});

describe("formatEventWhen", () => {
  test("quinta 8 de outubro às 19:00", () => {
    expect(formatEventWhen("2026-10-08", "19:00:00")).toBe(
      "Qui, 8 out · 19:00"
    );
  });
});
