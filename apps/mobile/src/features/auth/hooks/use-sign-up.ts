import { useMutation } from "@tanstack/react-query";
import { authApi } from "../auth-api";
import { TSignUpInput } from "../auth-types";

export function useSignUp() {
  const mutation = useMutation({
    mutationFn: (input: TSignUpInput) => authApi.signUp(input),
  });

  return {
    signUp: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error?.message ?? null,
    user: mutation.data ?? null,
  };
}
