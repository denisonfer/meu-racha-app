import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { TShowToast } from "@/ui/components";
import type { TBlockedProfile } from "../moderation-types";
import { UNBLOCK_FAILED, unblocked } from "../utils/moderation-messages";

type TUnblockTarget = { profileId: string; displayName: string };

// Desbloquear é na hora: a pessoa sai da lista antes da RPC e volta, com o toast, se falhar.
export function unblockOptions(
  queryClient: QueryClient,
  blockedProfilesKey: QueryKey,
  unblock: (profileId: string) => Promise<void>,
  showToast: TShowToast,
  invalidateBlockViews: () => void
) {
  return {
    mutationFn: (target: TUnblockTarget) => unblock(target.profileId),
    onMutate: async (target: TUnblockTarget) => {
      await queryClient.cancelQueries({ queryKey: blockedProfilesKey });
      const previous =
        queryClient.getQueryData<TBlockedProfile[]>(blockedProfilesKey);
      if (previous) {
        queryClient.setQueryData(
          blockedProfilesKey,
          previous.filter((person) => person.profileId !== target.profileId)
        );
      }
      return { previous };
    },
    onError: (
      _error: Error,
      _target: TUnblockTarget,
      onMutateResult: { previous: TBlockedProfile[] | undefined } | undefined
    ) => {
      if (onMutateResult?.previous) {
        queryClient.setQueryData(blockedProfilesKey, onMutateResult.previous);
      }
      showToast(UNBLOCK_FAILED, "danger");
    },
    onSuccess: (_data: void, target: TUnblockTarget) => {
      showToast(unblocked(target.displayName), "success");
    },
    onSettled: () => {
      invalidateBlockViews();
      return queryClient.invalidateQueries({ queryKey: blockedProfilesKey });
    },
  };
}
