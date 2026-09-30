import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myJoinRequestsKey } from "./use-my-join-requests";

export function useRequestJoin() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (rachaId: string) => rachaApi.requestJoin(rachaId),
    // already_requested também invalida: o estado real (PENDING) aparece
    // no refetch do convite.
    // devolve só a promise dos pedidos: a mutation segue pendente até a
    // lista nova chegar. O convite não é esperado: o Convite sai logo depois
    // do pedido e não deve mostrar "Aguardando aprovação" por um instante.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["invite"] });
      return queryClient.invalidateQueries({ queryKey: myJoinRequestsKey });
    },
  });

  return {
    requestJoin: mutation.mutateAsync,
    errorCode: mutation.error?.message ?? null,
  };
}
