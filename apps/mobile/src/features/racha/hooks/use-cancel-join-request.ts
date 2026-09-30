import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myJoinRequestsKey } from "./use-my-join-requests";

export function useCancelJoinRequest() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (rachaId: string) => rachaApi.cancelJoinRequest(rachaId),
    // aguardada: o botão segue carregando até o estado novo chegar
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invite"] }),
        queryClient.invalidateQueries({ queryKey: myJoinRequestsKey }),
      ]),
  });

  return {
    cancelJoinRequest: mutation.mutateAsync,
    isCancelling: (rachaId: string) =>
      mutation.isPending && mutation.variables === rachaId,
  };
}
