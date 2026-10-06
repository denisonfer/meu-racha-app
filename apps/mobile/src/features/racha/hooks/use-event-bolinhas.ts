import type { TDrawnBolinhas } from "@meu-racha/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { eventMatchKey } from "./use-event-match";
import { eventSortKey } from "./use-event-sort";

export const bolinhasRevealKey = (rachaId: string, eventId: string) =>
  ["racha", rachaId, "event", eventId, "bolinhas-reveal"] as const;

/** O que a revelação precisa: a ordem da RPC e o retrato novo dos Times, gravado ao abrir. */
export type TBolinhasReveal = {
  giverTeamNumber: number;
  receiverTeamNumber: number;
  drawn: TDrawnBolinhas;
};

/** Sorteia no banco. Os Times só entram no cache em `applyDrawn`, para a tela não piscar antes de navegar. */
export function useEventBolinhas(rachaId: string, eventId: string) {
  const queryClient = useQueryClient();
  const draw = useMutation({
    mutationFn: (input: { giverTeamId: string; receiverTeamId: string }) =>
      rachaApi.drawEventBolinhas({ eventId, ...input }),
  });

  const applyDrawn = (drawn: TDrawnBolinhas) => {
    queryClient.setQueryData(eventSortKey(rachaId, eventId), drawn.published);
    // a fila e o próximo confronto mudaram (Time que saiu da fila, contagens)
    void queryClient.invalidateQueries({
      queryKey: eventMatchKey(rachaId, eventId),
    });
  };

  const setReveal = (reveal: TBolinhasReveal) =>
    queryClient.setQueryData(bolinhasRevealKey(rachaId, eventId), reveal);

  return { drawBolinhas: draw.mutateAsync, applyDrawn, setReveal };
}

/** Passagem do sorteio da tela de escolha para a de revelação, pelo cache. */
export function useBolinhasRevealData(rachaId: string, eventId: string) {
  return useQuery<TBolinhasReveal | null>({
    queryKey: bolinhasRevealKey(rachaId, eventId),
    queryFn: async () => null,
    staleTime: Infinity,
    gcTime: Infinity,
    initialData: null,
  }).data;
}
