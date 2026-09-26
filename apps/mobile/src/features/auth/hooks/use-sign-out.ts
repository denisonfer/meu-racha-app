import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/ui/components";
import { authApi } from "../auth-api";

export function useSignOut() {
  const showToast = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: authApi.signOut,
    onSuccess: () => queryClient.clear(),
    onError: () => showToast("Não foi possível sair. Tente de novo."),
  });

  return { signOut: mutation.mutate, isPending: mutation.isPending };
}
