import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { openEventsKey } from "./use-open-events";
import { rachaPixKeyKey } from "./use-racha-pix-key";

export function useSetEventPixKey(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ eventId, key }: { eventId: string; key: string }) =>
      rachaApi.setEventPixKey(eventId, key),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: openEventsKey(rachaId) }),
        queryClient.invalidateQueries({ queryKey: rachaPixKeyKey(rachaId) }),
      ]),
  });

  return { setEventPixKey: mutation.mutateAsync };
}
