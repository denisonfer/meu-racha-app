import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { TRacha, TRachaLogistics } from "../racha-types";
import { rachaKey } from "./use-racha";

export function useUpdateRachaLogistics(id: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (logistics: TRachaLogistics) =>
      rachaApi.updateRachaLogistics(id, logistics),
    onSuccess: (_data, logistics) => {
      // se a recarga a seguir falhar, a home não pode reabrir com o local antigo
      queryClient.setQueryData<TRacha>(
        rachaKey(id),
        (old) =>
          old && {
            ...old,
            place: logistics.place,
            weekday: logistics.weekday,
            kickoffHour: logistics.kickoffHour,
            kickoffMinute: logistics.kickoffMinute,
            minAge: logistics.minAge,
            isPaid: logistics.isPaid,
            price: logistics.price,
            monthlyPrice: logistics.monthlyPrice,
            spotLimit: logistics.spotLimit,
          }
      );
    },
    // aguarda o Racha só no sucesso: no erro, sem rede a recarga demora e prenderia "Salvando".
    // a lista não mostra o local, então meus Rachas não entra nessa invalidação
    onSettled: (_data, error) => {
      if (error) {
        void queryClient.invalidateQueries({ queryKey: rachaKey(id) });
        return;
      }
      return queryClient.invalidateQueries({ queryKey: rachaKey(id) });
    },
  });

  return { updateRachaLogistics: mutation.mutateAsync };
}
