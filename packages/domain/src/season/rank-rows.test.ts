import { describe, expect, test } from "bun:test";
import { bestPlacing, rankRows } from "./rank-rows";

function item(id: string, name: string, value: number) {
  return { id, name, value };
}

describe("rankRows", () => {
  test("empate no 3º abre buraco no 5º", () => {
    const { rows, me } = rankRows(
      [
        item("a", "Ana", 10),
        item("b", "Bia", 8),
        item("c", "Caio", 5),
        item("d", "Diego", 5),
        item("e", "Eva", 3),
      ],
      null
    );

    expect(rows.map((row) => ({ id: row.id, position: row.position }))).toEqual(
      [
        { id: "a", position: 1 },
        { id: "b", position: 2 },
        { id: "c", position: 3 },
        { id: "d", position: 3 },
        { id: "e", position: 5 },
      ]
    );
    expect(me).toBeNull();
  });

  test("três empatados no 10º viram 12 linhas e me nulo se eu sou um deles", () => {
    const ahead = Array.from({ length: 9 }, (_, i) =>
      item(`a${i + 1}`, `A${i + 1}`, 20 - i)
    );
    const tied = [
      item("t1", "T1", 5),
      item("t2", "T2", 5),
      item("t3", "T3", 5),
    ];
    const behind = [item("b1", "B1", 1)];

    const { rows, me } = rankRows([...ahead, ...tied, ...behind], "t2");

    expect(rows).toHaveLength(12);
    expect(rows.slice(9).map((row) => row.id)).toEqual(["t1", "t2", "t3"]);
    expect(rows.slice(9).every((row) => row.position === 10)).toBe(true);
    expect(rows.find((row) => row.id === "t2")?.isMe).toBe(true);
    expect(rows.some((row) => row.id === "b1")).toBe(false);
    expect(me).toBeNull();
  });

  test("eu no 14º fico em me e as 10 linhas não incluem empate na borda", () => {
    const items = Array.from({ length: 14 }, (_, i) =>
      item(`p${i + 1}`, `P${String(i + 1).padStart(2, "0")}`, 14 - i)
    );

    const { rows, me } = rankRows(items, "p14");

    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.id)).toEqual(
      items.slice(0, 10).map((entry) => entry.id)
    );
    expect(rows.every((row) => !row.isMe)).toBe(true);
    expect(me).toEqual({ position: 14, value: 1 });
  });

  test("eu com zero não entro em rows e me é nulo", () => {
    const { rows, me } = rankRows(
      [item("me", "Eu", 0), item("a", "Ana", 4), item("b", "Bia", 2)],
      "me"
    );

    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
    expect(rows.every((row) => !row.isMe)).toBe(true);
    expect(me).toBeNull();
  });

  test("no empate de valor ordena nomes com localeCompare pt-BR", () => {
    const { rows } = rankRows(
      [item("b", "Bruno", 3), item("c", "Çesar", 3), item("a", "Álvaro", 3)],
      null
    );

    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});

describe("bestPlacing", () => {
  test("mesma posição em gols e assistências escolhe gols", () => {
    expect(
      bestPlacing([
        { list: "assists", position: 4 },
        { list: "wins", position: 4 },
        { list: "goals", position: 4 },
      ])
    ).toEqual({ list: "goals", position: 4 });
  });

  test("sem nenhuma posição no top 10 devolve null", () => {
    expect(
      bestPlacing([
        { list: "goals", position: 11 },
        { list: "assists", position: null },
        { list: "wins", position: 12 },
      ])
    ).toBeNull();
  });
});
