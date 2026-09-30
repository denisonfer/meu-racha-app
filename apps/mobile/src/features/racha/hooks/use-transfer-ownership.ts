import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myRachasKey } from "./use-my-rachas";
import { rachaKey } from "./use-racha";
import { rachaMembersKey } from "./use-racha-members";

export function useTransferOwnership(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (profileId: string) =>
      rachaApi.transferOwnership(rachaId, profileId),
    // o papel do Dono muda na lista de Rachas (cargo no cartão)
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myRachasKey }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: rachaKey(rachaId) });
      return queryClient.invalidateQueries({
        queryKey: rachaMembersKey(rachaId),
      });
    },
  });

  return { transferOwnership: mutation.mutateAsync };
}
