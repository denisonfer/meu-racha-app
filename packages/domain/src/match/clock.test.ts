import { describe, expect, test } from "bun:test";
import { matchElapsedSeconds, serverOffsetMs, splitOvertime } from "./clock";

const t0 = Date.parse("2026-10-04T15:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("matchElapsedSeconds", () => {
  test("correndo: conta do início até agora", () => {
    expect(
      matchElapsedSeconds(
        { startedAt: iso(t0), pausedAt: null, pausedSeconds: 0 },
        t0 + 90_000
      )
    ).toBe(90);
  });

  test("pausada: congela em pausedAt e ignora o agora", () => {
    expect(
      matchElapsedSeconds(
        {
          startedAt: iso(t0),
          pausedAt: iso(t0 + 60_000),
          pausedSeconds: 0,
        },
        t0 + 180_000
      )
    ).toBe(60);
  });

  test("retomada: desconta as pausas já encerradas", () => {
    expect(
      matchElapsedSeconds(
        { startedAt: iso(t0), pausedAt: null, pausedSeconds: 30 },
        t0 + 120_000
      )
    ).toBe(90);
  });

  test("pausa depois de outra: soma pausedSeconds com a corrente", () => {
    expect(
      matchElapsedSeconds(
        {
          startedAt: iso(t0),
          pausedAt: iso(t0 + 100_000),
          pausedSeconds: 20,
        },
        t0 + 200_000
      )
    ).toBe(80);
  });

  test("sem início ou relógio do aparelho antes do apito: zero", () => {
    expect(
      matchElapsedSeconds(
        { startedAt: null, pausedAt: null, pausedSeconds: 0 },
        t0
      )
    ).toBe(0);
    expect(
      matchElapsedSeconds(
        { startedAt: iso(t0), pausedAt: null, pausedSeconds: 0 },
        t0 - 5_000
      )
    ).toBe(0);
  });
});

describe("splitOvertime", () => {
  test("dentro do limite e no limite: sem acréscimo", () => {
    expect(splitOvertime(6 * 60, 7)).toEqual({ main: 360, overtime: null });
    expect(splitOvertime(7 * 60, 7)).toEqual({ main: 420, overtime: null });
  });

  test("acréscimo: principal para no limite", () => {
    expect(splitOvertime(8 * 60, 7)).toEqual({ main: 420, overtime: 60 });
  });

  test("sem Duração: o principal é o elapsed inteiro", () => {
    expect(splitOvertime(120, null)).toEqual({ main: 120, overtime: null });
  });
});

describe("serverOffsetMs", () => {
  test("aparelho adiantado: offset negativo", () => {
    expect(serverOffsetMs("2026-10-04T15:00:00.000Z", t0 + 2_000)).toBe(-2000);
  });

  test("aparelho atrasado: offset positivo", () => {
    expect(serverOffsetMs("2026-10-04T15:00:02.000Z", t0)).toBe(2000);
  });

  test("relógios iguais: zero", () => {
    expect(serverOffsetMs("2026-10-04T15:00:00.000Z", t0)).toBe(0);
  });
});
