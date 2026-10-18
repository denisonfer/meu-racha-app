export const EMAIL_ALERT_TITLE = "Confirme seu e-mail";
export const EMAIL_ALERT_TEXT =
  "Você precisa dele para cadastrar a chave PIX de um racha.";
export const EMAIL_ALERT_ACTION = "Confirmar e-mail";
export const CONFIRM_EMAIL_TITLE = "Confirmar e-mail";
export const CONFIRM_EMAIL_SEND_HEADING = "Vamos confirmar seu e-mail";
export const CONFIRM_EMAIL_SEND_TEXT =
  "Vamos mandar um código de 6 números para";
export const CONFIRM_EMAIL_SEND = "Enviar código";
export const CONFIRM_EMAIL_CODE_HEADING = "Digite o código";
export const CONFIRM_EMAIL_CODE_TEXT = "Mandamos 6 números para";
export const CONFIRM_EMAIL_CODE_LABEL = "Código";
export const CONFIRM_EMAIL_CODE_HINT =
  "Vale por 1 hora. Não chegou? Olhe o spam.";
export const CONFIRM_EMAIL_CONFIRM = "Confirmar";
export const confirmEmailResendIn = (mmss: string) =>
  `Reenviar código em ${mmss}`;
export const CONFIRM_EMAIL_RESEND = "Reenviar código";
export const CONFIRM_EMAIL_RESEND_INVALID = "Enviar outro código";
// o Supabase devolve o mesmo erro para código errado, já usado e vencido
export const CONFIRM_EMAIL_INVALID =
  "Código errado ou vencido. Confira ou peça outro abaixo.";
export const CONFIRM_EMAIL_RATE_LIMITED =
  "Muitas tentativas. Espere um pouco e peça outro código.";
export const CONFIRM_EMAIL_SEND_FAILED =
  "Não foi possível enviar o código. Confira a internet e tente de novo.";
export const CONFIRM_EMAIL_RETRY = "Tentar de novo";
export const CONFIRM_EMAIL_SENT = "Código enviado.";
export const EMAIL_CONFIRMED = "E-mail confirmado.";
export const CONFIRM_EMAIL_CONFIRM_FAILED =
  "Código aceito, mas não deu para confirmar. Tente de novo.";
