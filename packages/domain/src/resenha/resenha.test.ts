import { describe, expect, test } from "bun:test";
import {
  cardsSummary,
  formatResenhaCivilDate,
  leaders,
  namesLine,
  topTeams,
} from "./resenha";

describe("leaders", () => {
  test("exclui zero e negativo e devolve o maior valor", () => {
    expect(
      leaders([
        { name: "Diego", value: 3 },
        { name: "Caio", value: 0 },
        { name: "Rafa", value: -1 },
      ])
    ).toEqual({ names: ["Diego"], count: 3 });
  });

  test("devolve todos os empatados em ordem alfabética pt-BR", () => {
    expect(
      leaders([
        { name: "Rafa", value: 2 },
        { name: "Diego", value: 2 },
        { name: "Juninho", value: 2 },
      ])
    ).toEqual({ names: ["Diego", "Juninho", "Rafa"], count: 2 });
  });

  test("ordena Álvaro antes de Bruno", () => {
    expect(
      leaders([
        { name: "Bruno", value: 1 },
        { name: "Álvaro", value: 1 },
      ])
    ).toEqual({ names: ["Álvaro", "Bruno"], count: 1 });
  });

  test("sem ninguém com valor > 0 devolve null", () => {
    expect(
      leaders([
        { name: "Diego", value: 0 },
        { name: "Caio", value: 0 },
      ])
    ).toBeNull();
    expect(leaders([])).toBeNull();
  });
});

describe("namesLine", () => {
  test("1 nome", () => {
    expect(namesLine(["Diego"])).toBe("Diego");
  });

  test("2 nomes com e", () => {
    expect(namesLine(["Diego", "Caio"])).toBe("Diego e Caio");
  });

  test("3 nomes com vírgula e e", () => {
    expect(namesLine(["Diego", "Caio", "Rafa"])).toBe("Diego, Caio e Rafa");
  });

  test("empate de 5: os 3 primeiros na ordem recebida +N", () => {
    expect(namesLine(["Caio", "Bruno", "Léo", "Samuel", "Pedro"])).toBe(
      "Caio, Bruno, Léo +2"
    );
  });
});

describe("topTeams", () => {
  test("devolve os Times do máximo em ordem numérica", () => {
    expect(
      topTeams([
        { teamNumber: 3, wins: 2 },
        { teamNumber: 1, wins: 2 },
        { teamNumber: 2, wins: 1 },
        { teamNumber: 0, wins: 0 },
      ])
    ).toEqual({ teamNumbers: [1, 3], wins: 2 });
  });

  test("só empates ou lista vazia devolve null", () => {
    expect(
      topTeams([
        { teamNumber: 1, wins: 0 },
        { teamNumber: 2, wins: 0 },
      ])
    ).toBeNull();
    expect(topTeams([])).toBeNull();
  });
});

describe("cardsSummary", () => {
  test("conta as cores e guarda os vermelhos na ordem recebida", () => {
    expect(
      cardsSummary([
        { color: "yellow", name: "Diego" },
        { color: "red", name: "Samuel" },
        { color: "yellow", name: "Caio" },
        { color: "red", name: "Rodrigo" },
      ])
    ).toEqual({
      yellow: 2,
      red: 2,
      redNames: ["Samuel", "Rodrigo"],
    });
  });
});

describe("formatResenhaCivilDate", () => {
  test("04/10/2026 é domingo, sem o fuso do aparelho", () => {
    expect(formatResenhaCivilDate("2026-10-04")).toEqual({
      weekdayShort: "dom",
      weekdayLong: "Domingo",
      weekdayShortUpper: "DOM",
      dayMonth: "04/10",
    });
  });

  test("03/10/2026 é sábado", () => {
    expect(formatResenhaCivilDate("2026-10-03")).toEqual({
      weekdayShort: "sáb",
      weekdayLong: "Sábado",
      weekdayShortUpper: "SÁB",
      dayMonth: "03/10",
    });
  });
});
