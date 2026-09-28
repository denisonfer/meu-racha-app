import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRequestPasswordReset } from "../../hooks/use-request-password-reset";
import {
  forgotPasswordSchema,
  TForgotPasswordForm,
} from "./forgot-password-schema";

const RESEND_COOLDOWN_SECONDS = 60;

export function useForgotPasswordScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { requestReset, isPending } = useRequestPasswordReset();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const { control, handleSubmit } = useForm<TForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: email ?? "" },
    mode: "onBlur",
  });

  const send = (address: string) =>
    requestReset(address, {
      onSuccess: () => {
        setSentTo(address);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      },
    });

  return {
    control,
    isPending,
    isSent: sentTo !== null,
    cooldown,
    submit: handleSubmit((values) => send(values.email)),
    resend: () => sentTo && send(sentTo),
    backToSignIn: () => router.replace("/sign-in"),
  };
}
