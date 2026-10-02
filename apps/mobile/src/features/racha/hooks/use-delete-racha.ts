import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { TMyRacha } from "../racha-types";
import { openEventsKey } from "./use-open-events";
import { myRachasKey } from "./use-my-rachas";

export function useDeleteRacha(id: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (): Promise<"deleted" | "not_owner" | "event_active"> => {
      try {
        await rachaApi.deleteRacha(id);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "not_allowed")
          throw error;
        // 0 linhas: evento rolando, outra pessoa, ou exclusão que já passou
        const events = await queryClient.fetchQuery({
          queryKey: openEventsKey(id),
          queryFn: () => rachaApi.listOpenEvents(id),
          staleTime: 0,
        });
        if (events.some((event) => event.status === "active")) {
          return "event_active";
        }
        await queryClient.invalidateQueries({ queryKey: myRachasKey });
        const rachas = queryClient.getQueryData<TMyRacha[]>(myRachasKey);
        return rachas?.some((racha) => racha.id === id)
          ? "not_owner"
          : "deleted";
      }
      // as consultas do Racha excluído não são invalidadas: recarregar daria erro
      await queryClient.invalidateQueries({ queryKey: myRachasKey });
      return "deleted";
    },
  });

  return { deleteRacha: mutation.mutateAsync };
}
