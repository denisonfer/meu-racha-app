import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { openEventsKey } from "./use-open-events";
import { myRachaEventsKey } from "./use-my-racha-events";

export function useFinishEvent(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (eventId: string) => rachaApi.finishEvent(eventId),
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
      ]);
    },
  });

  return { finishEvent: mutation.mutateAsync };
}
