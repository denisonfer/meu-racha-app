import type { TRachaRules } from "@meu-racha/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myRachasKey } from "./use-my-rachas";

type TCreateRachaInput = { name: string; rules: TRachaRules };

export function useCreateRacha() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ name, rules }: TCreateRachaInput) =>
      rachaApi.createRacha(name, rules),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: myRachasKey });
    },
  });

  return {
    createRacha: mutation.mutateAsync,
    errorCode: mutation.error?.message ?? null,
  };
}
