import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import type { TPositionDetails } from "../racha-types";
import { rachaMembersKey } from "./use-racha-members";

export function useSetMemberPositionDetails(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { profileId: string; details: TPositionDetails }) =>
      rachaApi.setMemberPositionDetails(rachaId, args.profileId, args.details),
    // a camada sai da subdivisão: Presença, proposta e Times de todo Evento releem
    onSettled: (_data, error) => {
      const refresh = Promise.all([
        queryClient.invalidateQueries({ queryKey: rachaMembersKey(rachaId) }),
        queryClient.invalidateQueries({
          queryKey: ["racha", rachaId, "event"],
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
    setMemberPositionDetails: (profileId: string, details: TPositionDetails) =>
      mutation.mutateAsync({ profileId, details }),
  };
}
