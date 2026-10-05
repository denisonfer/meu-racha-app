import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import type { TAttendanceTarget, TGuestInput } from "../racha-types";
import { eventAttendanceKey } from "./use-event-attendance";
import { eventMatchKey } from "./use-event-match";
import { myRachaEventsKey } from "./use-my-racha-events";
import { openEventsKey } from "./use-open-events";

export const eventSortKey = (rachaId: string, eventId: string) =>
  ["racha", rachaId, "event", eventId, "sort"] as const;

/** Times publicados: o mesmo conteúdo para todo Membro; só o bloco viewer muda. */
export function useEventSort(rachaId: string, eventId: string) {
  return useQuery({
    queryKey: eventSortKey(rachaId, eventId),
    queryFn: () => rachaApi.getEventSort(eventId),
  });
}

/**
 * Saída, Inclusão e Volta (Condutor, e Saída própria). Sem atualização
 * otimista: o Time só muda na tela depois que o banco confirma.
 */
export function useEventSortOperations(rachaId: string, eventId: string) {
  const queryClient = useQueryClient();

  // Saída, Inclusão e Volta mexem na Presença e na vaga ocupada, que o Caixa e
  // os contadores do Evento leem; o Caixa vive na lista de Presença
  const settle = (_data: unknown, error: Error | null) => {
    const refresh = Promise.all([
      queryClient.invalidateQueries({
        queryKey: eventSortKey(rachaId, eventId),
      }),
      queryClient.invalidateQueries({
        queryKey: eventMatchKey(rachaId, eventId),
      }),
      queryClient.invalidateQueries({
        queryKey: eventAttendanceKey(rachaId, eventId),
      }),
      queryClient.invalidateQueries({ queryKey: openEventsKey(rachaId) }),
      queryClient.invalidateQueries({ queryKey: myRachaEventsKey }),
    ]);
    // no erro, sem rede a recarga demora e prenderia o botão
    if (error) {
      void refresh;
      return;
    }
    return refresh;
  };

  const leave = useMutation({
    mutationFn: (target: TAttendanceTarget) =>
      rachaApi.leaveEventSort(eventId, target),
    onSettled: settle,
  });

  const includeMember = useMutation({
    mutationFn: (profileId: string) =>
      rachaApi.includeEventSortMember(eventId, profileId),
    onSettled: settle,
  });

  const includeGuest = useMutation({
    mutationFn: (input: TGuestInput) =>
      rachaApi.includeEventSortGuest(eventId, input),
    onSettled: settle,
  });

  const returnPlayer = useMutation({
    mutationFn: (target: TAttendanceTarget) =>
      rachaApi.returnEventSortPlayer(eventId, target),
    onSettled: settle,
  });

  return {
    leaveEventSort: leave.mutateAsync,
    includeEventSortMember: includeMember.mutateAsync,
    includeEventSortGuest: includeGuest.mutateAsync,
    returnEventSortPlayer: returnPlayer.mutateAsync,
  };
}
