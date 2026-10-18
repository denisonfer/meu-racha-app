import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/features/auth";
import { useToast } from "@/ui/components";
import { profileKey } from "../../hooks/use-my-profile";
import { profileApi } from "../../profile-api";
import {
  emailCodeError,
  type TEmailCodeError,
} from "../../utils/email-code-error";
import {
  CONFIRM_EMAIL_CONFIRM_FAILED,
  CONFIRM_EMAIL_INVALID,
  CONFIRM_EMAIL_RATE_LIMITED,
  CONFIRM_EMAIL_SEND_FAILED,
  CONFIRM_EMAIL_SENT,
  EMAIL_CONFIRMED,
} from "../../utils/profile-messages";

const RESEND_COOLDOWN_SECONDS = 60;
const CODE_LENGTH = 6;

export function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function useConfirmEmailScreen() {
  const { session } = useSession();
  const userId = session?.userId;
  const email = session?.email ?? "";
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [phase, setPhase] = useState<"send" | "code">("send");
  const [code, setCode] = useState("");
  const [error, setError] = useState<TEmailCodeError | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  // refs: o estado fica velho dentro do closure (6º dígito + toque, colar duas vezes)
  const isVerifyingRef = useRef(false);
  // código de uso único: depois de aceito, o retry chama só a RPC
  const isCodeAcceptedRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    if (isSending || isVerifying || cooldown > 0) return;
    setError(null);
    setIsSending(true);
    try {
      await profileApi.sendEmailCode(email);
      // o toast só no reenvio: ao sair da fase "send" a tela já mostra o código
      if (phase === "code") showToast(CONFIRM_EMAIL_SENT, "success");
      setCode("");
      setPhase("code");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(emailCodeError(e));
    } finally {
      setIsSending(false);
    }
  };

  const verify = async (token: string) => {
    if (isVerifyingRef.current || token.length !== CODE_LENGTH) return;
    isVerifyingRef.current = true;
    setError(null);
    setIsVerifying(true);
    let step: "verify" | "confirm" = "verify";
    try {
      if (!isCodeAcceptedRef.current) {
        await profileApi.verifyEmailCode(email, token);
        isCodeAcceptedRef.current = true;
      }
      step = "confirm";
      await profileApi.confirmEmailVerified();
      await queryClient.invalidateQueries({ queryKey: profileKey(userId) });
      router.back();
      showToast(EMAIL_CONFIRMED, "success");
    } catch (e) {
      const kind = emailCodeError(e, step);
      // código inútil: o reenvio libera na hora
      if (kind === "invalid") setCooldown(0);
      setError(kind);
    } finally {
      isVerifyingRef.current = false;
      setIsVerifying(false);
    }
  };

  const changeCode = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (error === "invalid") setError(null);
    if (digits.length === CODE_LENGTH) void verify(digits);
  };

  return {
    phase,
    email,
    code,
    changeCode,
    isSending,
    isVerifying,
    cooldownLabel: cooldown > 0 ? formatCountdown(cooldown) : null,
    // "invalid" fica no campo; os outros erros vão acima do botão
    codeError: error === "invalid" ? CONFIRM_EMAIL_INVALID : undefined,
    notice:
      error === "rateLimited"
        ? CONFIRM_EMAIL_RATE_LIMITED
        : error === "sendFailed"
          ? CONFIRM_EMAIL_SEND_FAILED
          : error === "confirmFailed"
            ? CONFIRM_EMAIL_CONFIRM_FAILED
            : null,
    hasInvalidCode: error === "invalid",
    hasSendFailed: error === "sendFailed",
    hasConfirmFailed: error === "confirmFailed",
    send: () => void send(),
    confirm: () => void verify(code),
  };
}
