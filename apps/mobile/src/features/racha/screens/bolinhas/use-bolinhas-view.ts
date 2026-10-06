import {
  teamsOnField,
  type TBolinhasAvailability,
  type TBolinhasTeam,
} from "@meu-racha/domain";
import { useLocalSearchParams } from "expo-router";
import { useEventMatch } from "../../hooks/use-event-match";
import { useEventSort } from "../../hooks/use-event-sort";
import { useRacha } from "../../hooks/use-racha";

export type TBolinhasQueueTeam = TBolinhasTeam & {
  // o Sorteio publicado não traz o id do Time; vem da fila da Partida
  teamId: string | null;
  names: string[];
};

/** Os Times publicados e a fila da Partida, no formato que a tela de escolha lê. */
export function useBolinhasView() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const sortQuery = useEventSort(id, eventId);
  const matchQuery = useEventMatch(id, eventId);
  const { data: racha } = useRacha(id);
  const published =
    sortQuery.data?.state === "published" ? sortQuery.data : null;
  const isMatchOpen = (matchQuery.data?.match ?? null) !== null;

  const queue: TBolinhasQueueTeam[] = (published?.teams ?? [])
    .filter((team) => team.queueOrder !== null)
    .sort((a, b) => (a.queueOrder ?? 0) - (b.queueOrder ?? 0))
    .map((team) => ({
      teamNumber: team.teamNumber,
      queueOrder: team.queueOrder,
      activeCount: team.players.length,
      teamId: team.teamId,
      names: team.players.map((player) => player.displayName),
    }));
  // a disponibilidade vem do banco: o botão, a tela e a RPC não divergem
  const availability: TBolinhasAvailability =
    published?.bolinhasAvailability ?? "ok";

  return {
    id,
    eventId,
    rachaName: racha?.name ?? "",
    capacity: published?.outfieldPerTeam ?? racha?.rules.outfieldPerTeam ?? 5,
    isMatchOpen,
    isLoading: sortQuery.isPending || matchQuery.isPending,
    queue,
    onField: teamsOnField(queue, isMatchOpen),
    availability,
  };
}
