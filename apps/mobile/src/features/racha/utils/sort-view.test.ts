import { describe, expect, test } from "bun:test";
import type { TSortPerson, TSortPlayer, TSortTeam } from "@meu-racha/domain";
import {
  joinNames,
  missingToComplete,
  sortGoalkeeperEntries,
  sortPendingPeople,
  sortPositionText,
  superWarningNames,
} from "./sort-view";
import type { TAttendancePerson } from "../racha-types";

const attendee = (
  name: string,
  patch: Partial<TAttendancePerson> = {}
): TAttendancePerson => ({
  kind: "member",
  profileId: name,
  guestId: null,
  name,
  photoUrl: null,
  initials: name.slice(0, 2),
  overall: 40,
  status: "confirmed",
  queuePosition: null,
  didAttend: true,
  isPaidEffective: false,
  isMonthlyPass: false,
  playsAs: "OUTFIELD",
  primaryPosition: "DEFENDER",
  secondaryPosition: null,
  primaryLayer: null,
  role: "PLAYER",
  stars: 3,
  isSuperStar: false,
  paymentNote: null,
  creditBalance: null,
  ...patch,
});

describe("sortPendingPeople", () => {
  test("só quem veio, de linha e sem camada, em ordem alfabética", () => {
    const people = [
      attendee("Bruno"),
      attendee("Ana"),
      attendee("Caio", { primaryLayer: "CENTER_BACK" }),
      attendee("Davi", { didAttend: false }),
      attendee("Edu", { playsAs: "GOALKEEPER", primaryPosition: null }),
      attendee("Fábio", { status: "waitlisted" }),
      attendee("Gil", { status: "left" }),
    ];
    expect(sortPendingPeople(people).map((p) => p.name)).toEqual([
      "Ana",
      "Bruno",
    ]);
  });

  test("Avulso entra com status nulo e sai se saiu", () => {
    const guest = (name: string, status: TAttendancePerson["status"]) =>
      attendee(name, { kind: "guest", profileId: null, guestId: name, status });
    expect(
      sortPendingPeople([guest("Léo", null), guest("Rui", "left")]).map(
        (p) => p.name
      )
    ).toEqual(["Léo"]);
  });
});

const person = (id: string, name: string): TSortPerson => ({
  kind: "member",
  profileId: id,
  guestId: null,
  displayName: name,
  photoUrl: null,
});

const player = (id: string, name: string): TSortPlayer => ({
  ...person(id, name),
  stars: 3,
  isSuperStar: true,
  primaryPosition: "DEFENDER",
  secondaryPosition: "ANY",
  primaryLayer: "DEFENDER",
  enteredAt: "2026-10-03T10:00:00Z",
});

const team = (n: number, players: TSortPlayer[], gk: TSortPerson | null) =>
  ({
    teamNumber: n,
    queueOrder: n,
    isActive: true,
    playerCount: players.length,
    isComplete: true,
    starSum: 0,
    superCount: 0,
    players,
    goalkeeper: gk,
  }) satisfies TSortTeam;

describe("sort-view", () => {
  test("joinNames junta com vírgula e e", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Ana"])).toBe("Ana");
    expect(joinNames(["Ana", "Bia"])).toBe("Ana e Bia");
    expect(joinNames(["Ana", "Bia", "Caio"])).toBe("Ana, Bia e Caio");
  });

  test("Posição principal e secundária viram siglas", () => {
    expect(sortPositionText(player("a", "Ana"))).toBe("DEF / TODAS");
  });

  test("quanto falta para completar nunca é negativo nem inventado", () => {
    expect(missingToComplete(5, 1)).toBe(4);
    expect(missingToComplete(5, 6)).toBe(0);
    expect(missingToComplete(null, 1)).toBe(0);
  });

  test("aviso de Super Estrelas lista os nomes do Time certo", () => {
    const teams = [
      team(1, [player("a", "Ana"), player("b", "Bia")], null),
      team(2, [player("c", "Caio")], null),
    ];
    expect(
      superWarningNames([{ teamNumber: 1, playerIds: ["a", "b"] }], teams)
    ).toEqual([["Ana", "Bia"]]);
  });

  test("Goleiros: os dos Times primeiro, depois a fila em ordem", () => {
    const entries = sortGoalkeeperEntries(
      [team(1, [], person("g1", "Gil")), team(2, [], null)],
      [
        { ...person("g3", "Zé"), queueOrder: 2 },
        { ...person("g2", "Lu"), queueOrder: 1 },
      ]
    );
    expect(entries.map((e) => [e.id, e.teamNumber, e.queueOrder])).toEqual([
      ["g1", 1, null],
      ["g2", null, 1],
      ["g3", null, 2],
    ]);
  });
});
