import { zodResolver } from "@hookform/resolvers/zod";
import { Href, router, useLocalSearchParams } from "expo-router";
import { useForm } from "react-hook-form";
import { useChangePassword } from "../../hooks/use-change-password";
import { useRecoveryLink } from "../../hooks/use-recovery-link";
import { useSession } from "../../hooks/use-session";
import { takePendingDestination } from "../../utils/pending-destination";
import {
  resetPasswordSchema,
  TResetPasswordForm,
} from "./reset-password-schema";

export function useResetPasswordScreen() {
  const { token_hash } = useLocalSearchParams<{ token_hash?: string }>();
  const { status, retry } = useRecoveryLink(token_hash);
  const { changePassword, isPending } = useChangePassword();
  const { session } = useSession();

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
        onSuccess: async () => {
          const destination = session
            ? await takePendingDestination(session.userId)
            : null;
          router.replace((destination ?? "/rachas") as Href);
        },
      })
    ),
    requestNewLink: () => router.replace("/forgot-password"),
    backToSignIn: () => router.replace("/sign-in"),
  };
}
