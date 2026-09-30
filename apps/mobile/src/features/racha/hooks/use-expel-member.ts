import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { rachaKey } from "./use-racha";
import { rachaMembersKey } from "./use-racha-members";

export function useExpelMember(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (profileId: string) => rachaApi.expelMember(rachaId, profileId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: rachaKey(rachaId) });
      return queryClient.invalidateQueries({
        queryKey: rachaMembersKey(rachaId),
      });
    },
  });

  return { expelMember: mutation.mutateAsync };
}
