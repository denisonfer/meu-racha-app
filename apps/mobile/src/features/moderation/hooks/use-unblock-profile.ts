import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateBlockViews } from "@/features/racha";
import { useToast } from "@/ui/components";
import { moderationApi } from "../moderation-api";
import { unblockOptions } from "./unblock-options";
import { blockedProfilesKey } from "./use-blocked-profiles";

export function useUnblockProfile() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const mutation = useMutation(
    unblockOptions(
      queryClient,
      blockedProfilesKey,
      moderationApi.unblockProfile,
      showToast,
      () => invalidateBlockViews(queryClient)
    )
  );

  return {
    unblock: mutation.mutate,
    isUnblocking: mutation.isPending,
  };
}
