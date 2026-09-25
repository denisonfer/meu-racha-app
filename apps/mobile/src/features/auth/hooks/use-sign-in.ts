import { useMutation } from "@tanstack/react-query";
import { authApi } from "../auth-api";
import { TSignInInput } from "../auth-types";

export function useSignIn() {
  const mutation = useMutation({
    mutationFn: (input: TSignInInput) => authApi.signIn(input),
  });

  return {
    signIn: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}
