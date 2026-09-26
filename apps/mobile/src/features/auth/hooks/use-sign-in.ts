import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/ui/components";
import { authApi } from "../auth-api";
import { TSignInInput } from "../auth-types";
import { signInErrorMessage } from "../utils/auth-messages";

export function useSignIn() {
  const showToast = useToast();

  const mutation = useMutation({
    mutationFn: (input: TSignInInput) => authApi.signIn(input),
    onError: (error) => showToast(signInErrorMessage(error.message)),
  });

  return {
    signIn: mutation.mutate,
    isPending: mutation.isPending,
  };
}
