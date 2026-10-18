import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { TEventInput } from "../racha-types";
import { openEventsKey } from "./use-open-events";
import { myRachaEventsKey } from "./use-my-racha-events";

export function useUpdateEvent(rachaId: string, eventId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    // idOverride: Evento criado nesta tela, cujo id só existe depois do hook
    mutationFn: ({ input, id }: { input: TEventInput; id?: string }) =>
      rachaApi.updateEvent(id ?? eventId, input),
    // aguarda a agenda só no sucesso: no erro, sem rede a recarga demora e prenderia "Salvando".
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

  return {
    updateEvent: (input: TEventInput, id?: string) =>
      mutation.mutateAsync({ input, id }),
  };
}
