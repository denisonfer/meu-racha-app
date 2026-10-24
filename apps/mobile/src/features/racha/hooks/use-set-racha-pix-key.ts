import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { openEventsKey } from "./use-open-events";
import { rachaPixKeyKey } from "./use-racha-pix-key";

export function useSetRachaPixKey(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ key, holder }: { key: string; holder: string }) =>
      rachaApi.setRachaPixKey(rachaId, key, holder),
    // a chave do Racha também reescreve a dos Eventos abertos
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: rachaPixKeyKey(rachaId) }),
        queryClient.invalidateQueries({ queryKey: openEventsKey(rachaId) }),
      ]),
  });

  return { setRachaPixKey: mutation.mutateAsync };
}
