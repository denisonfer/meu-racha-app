import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myRachasKey } from "./use-my-rachas";

export function useDeleteRacha(id: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => rachaApi.deleteRacha(id),
    // as consultas do Racha excluído não são invalidadas: recarregar daria erro
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myRachasKey }),
  });

  return { deleteRacha: mutation.mutateAsync };
}
