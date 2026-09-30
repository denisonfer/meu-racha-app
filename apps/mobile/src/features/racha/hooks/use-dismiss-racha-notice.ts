import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { rachaNoticesKey } from "./use-racha-notices";

export function useDismissRachaNotice() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: rachaApi.dismissRachaNotice,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rachaNoticesKey }),
  });

  return { dismiss: mutation.mutateAsync };
}
