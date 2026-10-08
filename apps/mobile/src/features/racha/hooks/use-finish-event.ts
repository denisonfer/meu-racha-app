import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { openEventsKey } from "./use-open-events";
import { myRachaEventsKey } from "./use-my-racha-events";
import { myProfileCardKey, rachaCardsKey } from "./use-racha-cards";
import { rachaLastResenhaKey } from "./use-racha-last-resenha";
import { seasonEventsKey } from "./use-season-events";
import { seasonRankingKey } from "./use-season-ranking";

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
        queryClient.invalidateQueries({
          queryKey: rachaCardsKey(rachaId),
        }),
        queryClient.invalidateQueries({ queryKey: myProfileCardKey }),
        queryClient.invalidateQueries({
          queryKey: seasonRankingKey(rachaId),
        }),
        queryClient.invalidateQueries({
          queryKey: seasonEventsKey(rachaId),
        }),
      ]);
    },
  });

  return { finishEvent: mutation.mutateAsync };
}
