import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { openEventsKey } from "./use-open-events";
import { myRachaEventsKey } from "./use-my-racha-events";
import { rachaLastResenhaKey } from "./use-racha-last-resenha";

export function useFinishEvent(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      eventId,
      paymentsReviewed,
    }: {
      eventId: string;
      paymentsReviewed: boolean;
    }) => rachaApi.finishEvent(eventId, paymentsReviewed),
    // aguarda a agenda só no sucesso: no erro, sem rede a recarga demora e prenderia o botão.
    onSettled: (_data, error) => {
      const refreshList = queryClient.invalidateQueries({
        queryKey: myRachaEventsKey,
      });
      if (error) {
        void refreshList;
        void queryClient.invalidateQueries({
          queryKey: openEventsKey(rachaId),
        });
        return;
      }
      return Promise.all([
        refreshList,
        queryClient.invalidateQueries({ queryKey: openEventsKey(rachaId) }),
        queryClient.invalidateQueries({
          queryKey: rachaLastResenhaKey(rachaId),
        }),
      ]);
    },
  });

  return { finishEvent: mutation.mutateAsync };
}
