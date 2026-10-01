import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { TRacha, TRachaSettings } from "../racha-types";
import { myRachasKey } from "./use-my-rachas";
import { rachaKey } from "./use-racha";

export function useUpdateRacha(id: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (settings: TRachaSettings) =>
      rachaApi.updateRacha(id, settings),
    onSuccess: (_data, settings) => {
      // se a recarga a seguir falhar, Configurações não pode reabrir com os valores antigos
      queryClient.setQueryData<TRacha>(
        rachaKey(id),
        (old) =>
          old && {
            ...old,
            name: settings.name,
            rules: settings.rules,
          }
      );
    },
    // aguarda o Racha só no sucesso: no erro, sem rede a recarga demora e prenderia "Salvando"
    onSettled: (_data, error) => {
      void queryClient.invalidateQueries({ queryKey: myRachasKey });
      if (error) {
        void queryClient.invalidateQueries({ queryKey: rachaKey(id) });
        return;
      }
      return queryClient.invalidateQueries({ queryKey: rachaKey(id) });
    },
  });

  return { updateRacha: mutation.mutateAsync };
}
