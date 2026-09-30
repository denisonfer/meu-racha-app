import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myJoinRequestsKey } from "./use-my-join-requests";

export function useCancelJoinRequest() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (rachaId: string) => rachaApi.cancelJoinRequest(rachaId),
    // join_request_not_pending também invalida: o estado real aparece no
    // refetch (outro aparelho cancelou, ou foi recusado nesse meio-tempo).
    // devolve a promise: a mutation segue pendente até o estado novo chegar
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invite"] }),
        queryClient.invalidateQueries({ queryKey: myJoinRequestsKey }),
      ]),
  });

  return {
    cancelJoinRequest: mutation.mutateAsync,
    // pelo variables da mutation em andamento, pra o cartão certo mostrar
    // "Cancelando" mesmo com vários pedidos na lista.
    isCancelling: (rachaId: string) =>
      mutation.isPending && mutation.variables === rachaId,
  };
}
