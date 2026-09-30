import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { TRachaSettings } from "../racha-types";
import { myRachasKey } from "./use-my-rachas";
import { rachaKey } from "./use-racha";

export function useUpdateRacha(id: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (settings: TRachaSettings) =>
      rachaApi.updateRacha(id, settings),
    // aguarda o Racha: a home já abre com o nome e as regras novas
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: myRachasKey });
      return queryClient.invalidateQueries({ queryKey: rachaKey(id) });
    },
  });

  return { updateRacha: mutation.mutateAsync };
}
