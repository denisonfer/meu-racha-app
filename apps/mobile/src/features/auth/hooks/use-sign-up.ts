import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/ui/components";
import { authApi } from "../auth-api";
import { TSignUpInput } from "../auth-types";
import { signUpErrorMessage } from "../utils/auth-messages";

export function useSignUp() {
  const showToast = useToast();

  const mutation = useMutation({
    mutationFn: (input: TSignUpInput) => authApi.signUp(input),
    onSuccess: () => showToast("Conta criada. Bem-vindo ao Racha!", "success"),
    onError: (error) => showToast(signUpErrorMessage(error.message)),
  });

  return {
    signUp: mutation.mutate,
    isPending: mutation.isPending,
    user: mutation.data ?? null,
  };
}
