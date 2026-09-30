import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { TMemberUpdate } from "../racha-types";
import { rachaKey } from "./use-racha";
import { rachaMembersKey } from "./use-racha-members";

export function useUpdateMember(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { profileId: string; update: TMemberUpdate }) =>
      rachaApi.updateMember(rachaId, args.profileId, args.update),
    // no admin_limit também: a lista traz o teto de Admins atualizado
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: rachaKey(rachaId) });
      return queryClient.invalidateQueries({
        queryKey: rachaMembersKey(rachaId),
      });
    },
  });

  return {
    updateMember: (profileId: string, update: TMemberUpdate) =>
      mutation.mutateAsync({ profileId, update }),
  };
}
