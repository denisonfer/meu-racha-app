import type { TBolinhasAvailability, TBolinhasTeam } from "./types";

// O banco decide e revalida tudo (private.event_bolinhas_can_pair). Estas funções
// espelham a regra só para montar as listas e o resumo.

const inQueue = (team: TBolinhasTeam) => team.queueOrder !== null;

/** Com a Partida aberta, os Times de queueOrder 1 e 2 estão em campo. */
export function teamsOnField(
  teams: TBolinhasTeam[],
  isMatchOpen: boolean
): ReadonlySet<number> {
  return new Set(
    isMatchOpen
      ? teams
          .filter((team) => team.queueOrder === 1 || team.queueOrder === 2)
          .map((team) => team.teamNumber)
      : []
  );
}

export const canReceive = (
  team: TBolinhasTeam,
  capacity: number,
  onField: ReadonlySet<number>
) =>
  inQueue(team) && !onField.has(team.teamNumber) && team.activeCount < capacity;

export const canGive = (
  team: TBolinhasTeam,
  receiver: TBolinhasTeam | null,
  onField: ReadonlySet<number>
) =>
  inQueue(team) &&
  !onField.has(team.teamNumber) &&
  team.teamNumber !== receiver?.teamNumber &&
  team.activeCount >= 1;

/** Azuis = vagas de quem recebe (no máximo todos de quem cede); o resto é vermelho. */
export function ballPlan(giverCount: number, spots: number) {
  const blue = Math.min(spots, giverCount);
  return { blue, red: giverCount - blue, allMove: giverCount <= spots };
}

export function bolinhasAvailability(
  teams: TBolinhasTeam[],
  capacity: number,
  onField: ReadonlySet<number>
): TBolinhasAvailability {
  const receivers = teams.filter((team) => canReceive(team, capacity, onField));
  if (receivers.length === 0) return "no_receiver";
  const hasPair = receivers.some((receiver) =>
    teams.some((team) => canGive(team, receiver, onField))
  );
  return hasPair ? "ok" : "no_giver";
}
