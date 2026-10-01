import type { TRachaRules } from "@meu-racha/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { myRachasKey } from "./use-my-rachas";

type TCreateRachaInput = {
  name: string;
  place: string;
  rules: TRachaRules;
  minAge: number | null;
};

export function useCreateRacha() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ name, place, rules, minAge }: TCreateRachaInput) =>
      rachaApi.createRacha(name, place, rules, minAge),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: myRachasKey });
    },
  });

  return {
    createRacha: mutation.mutateAsync,
    errorCode: mutation.error?.message ?? null,
  };
}
