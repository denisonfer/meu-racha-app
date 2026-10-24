import { normalizePixKey, TPixKeyType } from "@meu-racha/domain";

export type TPixKeyInput = {
  /** Normalizada; vazia quando o campo está vazio ou a chave é inválida. */
  key: string;
  type: TPixKeyType | null;
  isInvalid: boolean;
};

type TSavedPixKey = { pixKey: string | null; pixKeyHolder: string | null };

/** Chave e titular salvos, como o formulário parte deles; vazio quando não há. */
export type TPixKeyValue = { key: string; holder: string };

// O banco só copia a chave do Racha ao criar o Evento ou ao torná-lo pago; num Evento
// pago já existente, chave vazia é escolha do Dono e não pode ser repovoada.
// O titular vem sempre de onde veio a chave
export function initialEventPixKey(
  event: (TSavedPixKey & { isPaid: boolean }) | undefined,
  racha: TSavedPixKey | undefined
): TPixKeyValue {
  const source = event?.isPaid || event?.pixKey ? event : racha;
  return { key: source?.pixKey ?? "", holder: source?.pixKeyHolder ?? "" };
}

// o mesmo limite do check no banco, que conta caracteres e não unidades UTF-16
export const isValidPixKeyHolder = (text: string) => {
  const length = [...text.trim()].length;
  return length >= 2 && length <= 60;
};

// a RPC recebe a chave já normalizada: o servidor apara menos espaços Unicode que o JS
export function checkPixKeyInput(text: string): TPixKeyInput {
  if (!text.trim()) return { key: "", type: null, isInvalid: false };
  const normalized = normalizePixKey(text);
  return normalized
    ? { key: normalized.key, type: normalized.type, isInvalid: false }
    : { key: "", type: null, isInvalid: true };
}
