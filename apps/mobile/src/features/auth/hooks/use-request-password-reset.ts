import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/ui/components";
import { authApi } from "../auth-api";
import { requestResetErrorMessage } from "../utils/auth-messages";

export function useRequestPasswordReset() {
  const showToast = useToast();

  const mutation = useMutation({
    mutationFn: (email: string) => authApi.requestPasswordReset(email),
    onError: (error) => showToast(requestResetErrorMessage(error.message)),
  });

  return { requestReset: mutation.mutate, isPending: mutation.isPending };
}
