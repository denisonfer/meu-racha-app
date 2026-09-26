/**
 * Erro cru do backend → recado para a pessoa. Todo pt-BR de erro de auth mora
 * aqui; a api fala em código, a tela fala em português.
 */
export function signUpErrorMessage(raw: string): string {
  if (raw.includes("under_minimum_age"))
    return "É preciso ter 16 anos ou mais.";
  if (raw.includes("implausible_birth_date"))
    return "Confira o ano de nascimento.";
  if (raw.includes("display_name_is_reasonable"))
    return "Esse nome não parece um nome: use letras, sem números.";
  if (raw.includes("username_is_valid"))
    return "Esse username não é válido. Use ao menos uma letra.";
  if (raw.includes("profile_username_key"))
    return "Esse username já está em uso.";
  if (raw.includes("already registered")) return "Esse e-mail já tem conta.";
  return "Não foi possível criar a conta. Tente de novo.";
}

export function signInErrorMessage(raw: string): string {
  if (raw.includes("network_error"))
    return "Sem conexão. Verifique a internet e tente de novo.";
  if (raw.includes("session_failed"))
    return "Não foi possível entrar. Tente de novo.";
  // o resto é credencial inválida: a Edge Function não diz qual campo errou
  return "Usuário ou senha inválidos.";
}
