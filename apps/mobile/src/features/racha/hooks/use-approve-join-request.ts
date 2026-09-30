import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myRachasKey } from "./use-my-rachas";
import { rachaKey } from "./use-racha";
import { rachaJoinRequestsKey } from "./use-racha-join-requests";
import { rachaMembersKey } from "./use-racha-members";

type TApproveJoinRequestInput = {
  requestId: string;
  stars: number | null;
  isSuperStar: boolean;
};

export function useApproveJoinRequest(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ requestId, stars, isSuperStar }: TApproveJoinRequestInput) =>
      rachaApi.approveJoinRequest(requestId, stars, isSuperStar),
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
    approve: mutation.mutateAsync,
  };
}
