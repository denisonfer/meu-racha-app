import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { openEventsKey } from "./use-open-events";
import { rachaPixKeyKey } from "./use-racha-pix-key";

export function useSetEventPixKey(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      eventId,
      key,
      holder,
    }: {
      eventId: string;
      key: string;
      holder: string;
    }) => rachaApi.setEventPixKey(eventId, key, holder),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: openEventsKey(rachaId) }),
        queryClient.invalidateQueries({ queryKey: rachaPixKeyKey(rachaId) }),
      ]),
  });

  return { setEventPixKey: mutation.mutateAsync };
}
