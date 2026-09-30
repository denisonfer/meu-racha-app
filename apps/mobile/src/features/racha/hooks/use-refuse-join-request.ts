import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myRachasKey } from "./use-my-rachas";
import { rachaKey } from "./use-racha";
import { rachaJoinRequestsKey } from "./use-racha-join-requests";
import { rachaMembersKey } from "./use-racha-members";

export function useRefuseJoinRequest(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (requestId: string) => rachaApi.refuseJoinRequest(requestId),
    // só a lista é aguardada: o botão segue carregando até o estado novo chegar
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: rachaMembersKey(rachaId),
      });
      void queryClient.invalidateQueries({ queryKey: myRachasKey });
      void queryClient.invalidateQueries({ queryKey: rachaKey(rachaId) });
      return queryClient.invalidateQueries({
        queryKey: rachaJoinRequestsKey(rachaId),
      });
    },
  });

  return {
    refuse: mutation.mutateAsync,
    refusingId: mutation.isPending ? (mutation.variables ?? null) : null,
  };
}
