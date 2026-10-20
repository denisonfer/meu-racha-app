export type TPixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// Limite de 77 caracteres do e-mail na chave PIX (Manual de Padrões para Iniciação do Pix).
// Só ASCII imprimível: o BR Code conta o comprimento em bytes e o CRC é sobre bytes ASCII.
// "@" fica fora das partes: o e-mail da chave tem um só.
const EMAIL =
  /^[\x21-\x3f\x41-\x7e]+@[\x21-\x3f\x41-\x7e]+\.[\x21-\x3f\x41-\x7e]+$/;
const MOBILE_11 = /^[1-9]{2}9\d{8}$/;

// Dígito verificador módulo 11 sobre os `length` primeiros dígitos, com os pesos dados da esquerda para a direita.
function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce(
    (acc, weight, i) => acc + Number(digits[i]) * weight,
    0
  );
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

const CPF_WEIGHTS = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function hasValidCheckDigits(d: string, weights: number[]): boolean {
  const n = weights.length;
  return (
    checkDigit(d, weights.slice(1)) === Number(d[n - 1]) &&
    checkDigit(d, weights) === Number(d[n])
  );
}

function isCpf(d: string): boolean {
  return (
    /^\d{11}$/.test(d) &&
    !/^(\d)\1+$/.test(d) &&
    hasValidCheckDigits(d, CPF_WEIGHTS)
  );
}

function isCnpj(d: string): boolean {
  return (
    /^\d{14}$/.test(d) &&
    !/^(\d)\1+$/.test(d) &&
    hasValidCheckDigits(d, CNPJ_WEIGHTS)
  );
}

/** Normaliza a chave digitada e detecta o tipo; `null` quando não é uma chave PIX válida. */
export function normalizePixKey(
  raw: string
): { key: string; type: TPixKeyType } | null {
  const text = raw.trim();
  if (!text) return null;

  if (text.includes("@")) {
    const email = text.toLowerCase();
    return email.length <= 77 && EMAIL.test(email)
      ? { key: email, type: "email" }
      : null;
  }

  const lower = text.toLowerCase();
  if (UUID_V4.test(lower)) return { key: lower, type: "random" };

  if (!/^[\d\s().+/-]+$/.test(text)) return null;
  const digits = text.replace(/\D/g, "");
  const phone = (national: string) =>
    MOBILE_11.test(national)
      ? { key: `+55${national}`, type: "phone" as const }
      : null;

  // Com +55 ou máscara de telefone a intenção é celular, mesmo que os dígitos formem um CPF.
  if (text.startsWith("+"))
    return digits.startsWith("55") ? phone(digits.slice(2)) : null;
  if (/[()\s]/.test(text) && digits.length === 11) return phone(digits);

  if (isCpf(digits)) return { key: digits, type: "cpf" };
  if (isCnpj(digits)) return { key: digits, type: "cnpj" };
  // Só dígitos, 11, e não é CPF válido: celular. Com pontuação de CPF ("529.982.247-24") é CPF errado.
  return /^\d{11}$/.test(text) ? phone(digits) : null;
}

const DOT = "•";

/** Chave parcialmente escondida para exibir ao Jogador. */
export function maskPixKey(key: string, type: TPixKeyType): string {
  switch (type) {
    case "email": {
      const at = key.lastIndexOf("@");
      return `${key.slice(0, 2)}${DOT.repeat(3)}${key.slice(at)}`;
    }
    case "phone":
      return `(${DOT.repeat(2)}) ${DOT.repeat(5)}-${key.slice(-4)}`;
    case "cpf":
      return `${DOT.repeat(3)}.${key.slice(3, 6)}.${key.slice(6, 9)}-${DOT.repeat(2)}`;
    case "cnpj":
      return `${DOT.repeat(2)}.${key.slice(2, 5)}.${key.slice(5, 8)}/${key.slice(8, 12)}-${DOT.repeat(2)}`;
    case "random":
      return `${key.slice(0, 4)}${DOT.repeat(3)}${key.slice(-4)}`;
  }
}

const LABELS: Record<TPixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "e-mail",
  phone: "celular",
  random: "aleatória",
};

export function pixKeyTypeLabel(type: TPixKeyType): string {
  return LABELS[type];
}
