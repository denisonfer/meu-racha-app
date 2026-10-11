import type { QueryClient } from "@tanstack/react-query";
import { PUSH_MUTE_FAILED } from "../utils/racha-messages";

export const rachaPushMutedKey = (rachaId: string) =>
  ["racha-push-muted", rachaId] as const;

// Troca otimista: o Switch muda na hora e volta, com o toast, se a RPC falhar.
export function rachaPushMutedOptions(
  queryClient: QueryClient,
  rachaId: string,
  save: (muted: boolean) => Promise<void>,
  showError: (message: string) => void
) {
  const key = rachaPushMutedKey(rachaId);
  return {
    mutationFn: save,
    onMutate: async (muted: boolean) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData(key, muted);
      return { previous };
    },
    onError: (
      _error: Error,
      _muted: boolean,
      onMutateResult: { previous: boolean | undefined } | undefined
    ) => {
      queryClient.setQueryData(key, onMutateResult?.previous);
      showError(PUSH_MUTE_FAILED);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  };
}
