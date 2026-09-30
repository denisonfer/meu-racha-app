import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { TMyRacha } from "../racha-types";
import { myRachasKey } from "./use-my-rachas";

export function useDeleteRacha(id: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (): Promise<"deleted" | "not_owner"> => {
      try {
        await rachaApi.deleteRacha(id);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "not_allowed")
          throw error;
        // 0 linhas afetadas: pode ser outra pessoa ou uma tentativa anterior que já excluiu
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
