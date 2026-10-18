export type TEmailCodeError =
  "invalid" | "rateLimited" | "sendFailed" | "confirmFailed";

// O auth devolve `otp_expired` (403) para código errado, já usado e vencido.
// Sem rede o erro não traz `code` nem `status` útil: cai em sendFailed.
// step "confirm": o código já foi aceito; qualquer falha da RPC é só da marcação
export function emailCodeError(
  error: unknown,
  step: "send" | "verify" | "confirm" = "verify"
): TEmailCodeError {
  if (step === "confirm") return "confirmFailed";
  const { code, status } = (error ?? {}) as { code?: string; status?: number };
  if (code === "otp_expired") return "invalid";
  if (code === "over_email_send_rate_limit" || status === 429)
    return "rateLimited";
  return "sendFailed";
}
