import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import type { TPositionDetails } from "../racha-types";
import { myJoinRequestsKey } from "./use-my-join-requests";

export function useRequestJoin() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { rachaId: string; details?: TPositionDetails }) =>
      rachaApi.requestJoin(args.rachaId, args.details),
    // o convite não é aguardado: senão a tela 5 piscaria "Aguardando aprovação" antes de sair
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["invite"] });
      return queryClient.invalidateQueries({ queryKey: myJoinRequestsKey });
    },
  });

  return {
    requestJoin: (rachaId: string, details?: TPositionDetails) =>
      mutation.mutateAsync({ rachaId, details }),
    errorCode: mutation.error?.message ?? null,
  };
}
