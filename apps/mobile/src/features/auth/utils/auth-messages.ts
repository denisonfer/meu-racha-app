import { PASSWORD_MIN } from "@meu-racha/domain";

/**
 * Erro cru do backend → recado para a pessoa. Todo pt-BR de erro de auth mora
 * aqui; a api fala em código, a tela fala em português.
 */
export const EMAIL_TAKEN_MESSAGE = "Esse e-mail já tem conta";

export function signUpErrorMessage(raw: string): string {
  if (raw.includes("terms_not_accepted"))
    return "Aceite os Termos para criar a conta.";
  if (raw.includes("under_minimum_age"))
    return "É preciso ter 16 anos ou mais.";
  if (raw.includes("implausible_birth_date"))
    return "Confira o ano de nascimento.";
  if (raw.includes("display_name_is_reasonable"))
    return "Esse nome não parece um nome: use letras, sem números.";
  if (raw.includes("already registered")) return "Esse e-mail já tem conta.";
  return "Não foi possível criar a conta. Tente de novo.";
}

export const PHOTO_PICK_ERROR =
  "Essa foto é grande demais ou não é um formato aceito. Mantivemos a anterior.";
export const PHOTO_UPLOAD_FAILED =
  "Não deu pra salvar sua foto. Tente de novo.";

export function signInErrorMessage(raw: string): string {
  if (raw.includes("network_error"))
    return "Sem conexão. Verifique a internet e tente de novo.";
  if (raw.includes("over_request_rate_limit"))
    return "Muitas tentativas. Espere alguns minutos.";

  return "E-mail ou senha inválidos.";
}

export function requestResetErrorMessage(raw: string): string {
  if (raw.includes("network_error"))
    return "Sem conexão. Verifique a internet e tente de novo.";

  return "Não foi possível enviar o link. Tente de novo.";
}

export function changePasswordErrorMessage(raw: string): string {
  if (raw.includes("network_error"))
    return "Sem conexão. Verifique a internet e tente de novo.";
  if (raw.includes("sessions_not_ended"))
    return "Senha trocada. Falta encerrar as outras sessões — toque para tentar de novo.";
  if (raw.includes("same_password"))
    return "A nova senha precisa ser diferente da anterior.";
  if (raw.includes("weak_password"))
    return `Mínimo de ${PASSWORD_MIN} caracteres.`;

  return "Não foi possível trocar a senha. Tente de novo.";
}
