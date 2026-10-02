import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { openEventsKey } from "./use-open-events";

export function useAssumeEventConduction(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (eventId: string) => rachaApi.assumeEventConduction(eventId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: openEventsKey(rachaId) }),
  });

  return { assumeEventConduction: mutation.mutateAsync };
}
