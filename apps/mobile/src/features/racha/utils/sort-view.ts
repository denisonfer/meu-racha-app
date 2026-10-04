import {
  isLayerPending,
  roleBadge,
  type TSortGoalkeeperQueueEntry,
  type TSortPerson,
  type TSortPlayer,
  type TSortSuperWarning,
  type TSortTeam,
} from "@meu-racha/domain";
import type { TAttendancePerson } from "../racha-types";

/**
 * Quem trava o Sorteio: entra no elenco (confirmado ou Avulso, com "veio") e
 * é de linha sem camada. Mesmo corte de private.assert_no_position_detail_pending.
 */
export const sortPendingPeople = (people: TAttendancePerson[]) =>
  people
    .filter(
      (person) =>
        person.didAttend &&
        (person.kind === "guest"
          ? person.status !== "left"
          : person.status === "confirmed") &&
        isLayerPending(person)
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

/** Membro ou Avulso: o banco identifica por exatamente um dos dois ids. */
export const sortPersonId = (person: TSortPerson): string =>
  person.profileId ?? person.guestId ?? "";

export function sortPositionText(player: TSortPlayer): string {
  const badges = [player.primaryPosition, player.secondaryPosition]
    .map((position) => roleBadge("OUTFIELD", position))
    .filter((badge) => badge !== null);
  return badges.join(" / ");
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Quantos jogadores faltam para o Time ficar completo; 0 quando não dá para saber. */
export function missingToComplete(
  outfieldPerTeam: number | null,
  playerCount: number
): number {
  if (outfieldPerTeam === null) return 0;
  return Math.max(0, outfieldPerTeam - playerCount);
}

/** Uma frase por Time com Super Estrelas que o Sorteio não separou. */
export function superWarningNames(
  warnings: TSortSuperWarning[],
  teams: TSortTeam[]
): string[][] {
  return warnings.map((warning) => {
    const team = teams.find((item) => item.teamNumber === warning.teamNumber);
    return warning.playerIds
      .map((id) => team?.players.find((player) => sortPersonId(player) === id))
      .filter((player) => player !== undefined)
      .map((player) => player.displayName);
  });
}

export type TSortGoalkeeperEntry = {
  id: string;
  person: TSortPerson;
  // Time ou posição na fila do gol
  teamNumber: number | null;
  queueOrder: number | null;
};

/** Todos os Goleiros da proposta, nos Times e na fila, para a troca. */
export function sortGoalkeeperEntries(
  teams: TSortTeam[],
  queue: TSortGoalkeeperQueueEntry[]
): TSortGoalkeeperEntry[] {
  const inTeams = teams.flatMap((team) =>
    team.goalkeeper
      ? [
          {
            id: sortPersonId(team.goalkeeper),
            person: team.goalkeeper,
            teamNumber: team.teamNumber,
            queueOrder: null,
          },
        ]
      : []
  );
  const inQueue = [...queue]
    .sort((a, b) => a.queueOrder - b.queueOrder)
    .map((entry) => ({
      id: sortPersonId(entry),
      person: entry,
      teamNumber: null,
      queueOrder: entry.queueOrder,
    }));
  return [...inTeams, ...inQueue];
}
