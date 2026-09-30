import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myRachasKey } from "./use-my-rachas";

export function useLeaveRacha(rachaId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => rachaApi.leaveRacha(rachaId),
    // as consultas do Racha deixado não são invalidadas: recarregar daria erro
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: myRachasKey }),
        // o Convite em cache ainda diria MEMBER
        queryClient.invalidateQueries({ queryKey: ["invite"] }),
      ]),
  });

  return { leaveRacha: mutation.mutateAsync };
}
