import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myJoinRequestsKey } from "./use-my-join-requests";

export function useRequestJoin() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (rachaId: string) => rachaApi.requestJoin(rachaId),
    // o convite não é aguardado: senão a tela 5 piscaria "Aguardando aprovação" antes de sair
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
