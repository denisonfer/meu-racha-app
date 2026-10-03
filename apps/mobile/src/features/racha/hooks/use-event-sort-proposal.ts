import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { eventAttendanceKey } from "./use-event-attendance";
import { eventSortKey } from "./use-event-sort";
import { myRachasKey } from "./use-my-rachas";
import { openEventsKey } from "./use-open-events";

export const eventSortProposalKey = (rachaId: string, eventId: string) =>
  ["racha", rachaId, "event", eventId, "sort-proposal"] as const;

/** Rascunho do Sorteio; o banco só o entrega ao Condutor, então só ele liga a query. */
export function useEventSortProposal(
  rachaId: string,
  eventId: string,
  isConductor: boolean
) {
  return useQuery({
    queryKey: eventSortProposalKey(rachaId, eventId),
    queryFn: () => rachaApi.getEventSortProposal(eventId),
    enabled: isConductor,
  });
}

/**
 * Sortear/re-sortear, trocar Goleiros e confirmar. A proposta e os Times só
 * mudam na tela com a resposta do banco; erro não deixa confirmação otimista.
 */
export function useEventSortDraft(rachaId: string, eventId: string) {
  const queryClient = useQueryClient();
  const proposalKey = eventSortProposalKey(rachaId, eventId);

  const prepare = useMutation({
    mutationFn: () => rachaApi.prepareEventSort(eventId),
    onSuccess: (proposal) => queryClient.setQueryData(proposalKey, proposal),
    // o erro mais comum (elenco mudou) deixa o rascunho antigo inválido
    onError: () => queryClient.invalidateQueries({ queryKey: proposalKey }),
  });

  const swapGoalkeepers = useMutation({
    mutationFn: (vars: {
      version: number;
      goalkeeperA: string;
      goalkeeperB: string;
    }) =>
      rachaApi.swapEventSortGoalkeepers(
        eventId,
        vars.version,
        vars.goalkeeperA,
        vars.goalkeeperB
      ),
    onSuccess: (proposal) => queryClient.setQueryData(proposalKey, proposal),
    onError: () => queryClient.invalidateQueries({ queryKey: proposalKey }),
  });

  const confirm = useMutation({
    mutationFn: (version: number) =>
      rachaApi.confirmEventSort(eventId, version),
    onSuccess: (published) => {
      queryClient.setQueryData(eventSortKey(rachaId, eventId), published);
      // o rascunho acabou: reler daria already_confirmed
      queryClient.removeQueries({ queryKey: proposalKey });
    },
    // elenco mudou ou versão velha: o rascunho na tela já não vale
    onError: () => queryClient.invalidateQueries({ queryKey: proposalKey }),
    onSettled: (_data, error) => {
      // Evento passa a active e a Presença muda de regra na mesma transação
      const refresh = Promise.all([
        queryClient.invalidateQueries({ queryKey: myRachasKey }),
        queryClient.invalidateQueries({ queryKey: openEventsKey(rachaId) }),
        queryClient.invalidateQueries({
          queryKey: eventAttendanceKey(rachaId, eventId),
        }),
        queryClient.invalidateQueries({
          queryKey: eventSortKey(rachaId, eventId),
        }),
      ]);
      // no erro, sem rede a recarga demora e prenderia o botão
      if (error) {
        void refresh;
        return;
      }
      return refresh;
    },
  });

  return {
    prepareEventSort: prepare.mutateAsync,
    swapEventSortGoalkeepers: swapGoalkeepers.mutateAsync,
    confirmEventSort: confirm.mutateAsync,
  };
}
