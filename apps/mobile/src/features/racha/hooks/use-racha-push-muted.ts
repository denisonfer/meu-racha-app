import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRachaPushMuted, setRachaPushMuted } from "@/features/notification";
import { useToast } from "@/ui/components";
import {
  rachaPushMutedKey,
  rachaPushMutedOptions,
} from "./racha-push-muted-options";

export function useRachaPushMuted(rachaId: string) {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const query = useQuery({
    queryKey: rachaPushMutedKey(rachaId),
    queryFn: () => getRachaPushMuted(rachaId),
    enabled: Boolean(rachaId),
  });
  const mutation = useMutation(
    rachaPushMutedOptions(
      queryClient,
      rachaId,
      (muted) => setRachaPushMuted(rachaId, muted),
      (message) => showToast(message, "danger")
    )
  );

  return { muted: query.data ?? false, setMuted: mutation.mutate };
}
