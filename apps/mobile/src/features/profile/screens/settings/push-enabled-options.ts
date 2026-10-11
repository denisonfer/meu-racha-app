import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { PUSH_SAVE_FAILED } from "../../utils/settings-messages";

// Troca otimista: o Switch muda na hora e volta, com o toast, se a RPC falhar.
export function pushEnabledOptions(
  queryClient: QueryClient,
  key: QueryKey,
  save: (enabled: boolean) => Promise<void>,
  showError: (message: string) => void
) {
  return {
    mutationFn: save,
    onMutate: async (enabled: boolean) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData(key, enabled);
      return { previous };
    },
    onError: (
      _error: Error,
      _enabled: boolean,
      onMutateResult: { previous: boolean | undefined } | undefined
    ) => {
      queryClient.setQueryData(key, onMutateResult?.previous);
      showError(PUSH_SAVE_FAILED);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  };
}
