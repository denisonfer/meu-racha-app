import { describe, expect, test } from "bun:test";
import type { TPositionLayer, TSortPlayer, TSortTeam } from "@meu-racha/domain";
import { buildTeamCards } from "./build-sort-views";

const player = (
  name: string,
  primaryLayer: TPositionLayer | null
): TSortPlayer => ({
  kind: "member",
  profileId: name,
  guestId: null,
  displayName: name,
  photoUrl: null,
  stars: 3,
  isSuperStar: false,
  primaryPosition: "DEFENDER",
  secondaryPosition: null,
  primaryLayer,
  enteredAt: "2026-10-03T10:00:00Z",
});

const team = (players: TSortPlayer[]): TSortTeam => ({
  teamNumber: 1,
  queueOrder: 1,
  isActive: true,
  playerCount: players.length,
  isComplete: true,
  starSum: 0,
  superCount: 0,
  players,
  goalkeeper: null,
});

const noAction = () => null;

describe("buildTeamCards por subdivisão", () => {
  const players = [
    player("Ana", "FORWARD"),
    player("Bia", "CENTER_BACK"),
    player("Caio", "ATTACKING_MID"),
    player("Davi", "CENTER_BACK"),
  ];

  test("Evento 8+: grupos não vazios, defesa → ataque, ordem do banco dentro", () => {
    const [card] = buildTeamCards([team(players)], 8, noAction);
    expect(
      card?.playerGroups?.map((g) => [g.title, g.players.map((p) => p.name)])
    ).toEqual([
      ["Zagueiros · 2", ["Bia", "Davi"]],
      ["Meias · 1", ["Caio"]],
      ["Atacantes · 1", ["Ana"]],
    ]);
    expect(card?.players.map((p) => p.name)).toEqual([
      "Ana",
      "Bia",
      "Caio",
      "Davi",
    ]);
  });

  test("Evento 3–7 e tamanho desconhecido: card sem grupos", () => {
    expect(buildTeamCards([team(players)], 7, noAction)[0]?.playerGroups).toBe(
      null
    );
    expect(
      buildTeamCards([team(players)], null, noAction)[0]?.playerGroups
    ).toBe(null);
  });
});
