import { describe, expect, test } from "bun:test";
import {
  ballPlan,
  bolinhasAvailability,
  canGive,
  canReceive,
  teamsOnField,
} from "./rules";
import type { TBolinhasTeam } from "./types";

// Cenário do dia: Time 1 e 3 (5/5, próximo confronto), Time 4 (4/5), Time 2 (4/5), Time 5 (3/5)
const team = (
  teamNumber: number,
  queueOrder: number | null,
  activeCount: number
): TBolinhasTeam => ({ teamNumber, queueOrder, activeCount });
const DAY = [
  team(1, 1, 5),
  team(3, 2, 5),
  team(4, 3, 4),
  team(2, 4, 4),
  team(5, 5, 3),
];
const NONE: ReadonlySet<number> = new Set();

describe("teamsOnField", () => {
  test("Partida aberta: os de queueOrder 1 e 2 estão em campo", () => {
    expect([...teamsOnField(DAY, true)].sort()).toEqual([1, 3]);
  });

  test("entre Partidas ninguém está em campo", () => {
    expect(teamsOnField(DAY, false).size).toBe(0);
  });
});

describe("canReceive", () => {
  test("recebe quem tem vaga", () => {
    expect(canReceive(team(4, 3, 4), 5, NONE)).toBe(true);
  });

  test("Time completo não recebe", () => {
    expect(canReceive(team(1, 1, 5), 5, NONE)).toBe(false);
  });

  test("Time em campo não recebe, mesmo com vaga", () => {
    expect(canReceive(team(1, 1, 4), 5, new Set([1]))).toBe(false);
  });

  test("Time fora da fila não recebe", () => {
    expect(canReceive(team(6, null, 2), 5, NONE)).toBe(false);
  });
});

describe("canGive", () => {
  const receiver = team(4, 3, 4);

  test("cede quem tem ativo e não é o receptor", () => {
    expect(canGive(team(5, 5, 3), receiver, NONE)).toBe(true);
  });

  test("o próprio receptor não cede", () => {
    expect(canGive(receiver, receiver, NONE)).toBe(false);
  });

  test("Time em campo não cede", () => {
    expect(canGive(team(1, 1, 5), receiver, new Set([1]))).toBe(false);
  });

  test("Time sem ativo não cede", () => {
    expect(canGive(team(6, 6, 0), receiver, NONE)).toBe(false);
  });

  test("Time fora da fila não cede", () => {
    expect(canGive(team(6, null, 2), receiver, NONE)).toBe(false);
  });

  test("entre Partidas o próximo confronto pode ceder", () => {
    expect(canGive(team(1, 1, 5), receiver, NONE)).toBe(true);
  });
});

describe("ballPlan", () => {
  test("normal: 3 jogadores, 1 vaga = 1 azul e 2 vermelhas", () => {
    expect(ballPlan(3, 1)).toEqual({ blue: 1, red: 2, allMove: false });
  });

  test("iguais: todos vão, sem sorteio", () => {
    expect(ballPlan(2, 2)).toEqual({ blue: 2, red: 0, allMove: true });
  });

  test("menos jogadores que vagas: todos vão", () => {
    expect(ballPlan(2, 3)).toEqual({ blue: 2, red: 0, allMove: true });
  });
});

describe("bolinhasAvailability", () => {
  test("cenário do dia: ok", () => {
    expect(bolinhasAvailability(DAY, 5, NONE)).toBe("ok");
  });

  test("todos completos fora de campo: no_receiver", () => {
    const full = [team(1, 1, 5), team(3, 2, 5), team(4, 3, 5)];
    expect(bolinhasAvailability(full, 5, NONE)).toBe("no_receiver");
  });

  test("só incompleto em campo: no_receiver", () => {
    const teams = [team(1, 1, 4), team(3, 2, 5), team(4, 3, 5)];
    expect(bolinhasAvailability(teams, 5, new Set([1, 3]))).toBe("no_receiver");
  });

  test("um incompleto e mais ninguém: no_giver", () => {
    expect(bolinhasAvailability([team(4, 1, 4)], 5, NONE)).toBe("no_giver");
  });

  test("com a Partida aberta, incompleto fora de campo e outro Time com gente: ok", () => {
    expect(bolinhasAvailability(DAY, 5, new Set([1, 3]))).toBe("ok");
  });
});
