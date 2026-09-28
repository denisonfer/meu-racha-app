import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useForm } from "react-hook-form";
import { useChangePassword } from "../../hooks/use-change-password";
import { useRecoveryLink } from "../../hooks/use-recovery-link";
import {
  resetPasswordSchema,
  TResetPasswordForm,
} from "./reset-password-schema";

export function useResetPasswordScreen() {
  const { token_hash } = useLocalSearchParams<{ token_hash?: string }>();
  const { status, retry } = useRecoveryLink(token_hash);
  const { changePassword, isPending } = useChangePassword();

  const { control, handleSubmit } = useForm<TResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmation: "" },
    mode: "onBlur",
  });

  return {
    status,
    retry,
    control,
    isPending,
    submit: handleSubmit((values) =>
      changePassword(values.password, {
        onSuccess: () => router.replace("/rachas"),
      })
    ),
    requestNewLink: () => router.replace("/forgot-password"),
    backToSignIn: () => router.replace("/sign-in"),
  };
}
