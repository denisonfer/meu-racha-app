import { normalizePixKey, TPixKeyType } from "@meu-racha/domain";

export type TPixKeyInput = {
  /** Normalizada; vazia quando o campo está vazio ou a chave é inválida. */
  key: string;
  type: TPixKeyType | null;
  isInvalid: boolean;
};

// O banco só copia a chave do Racha ao criar o Evento ou ao torná-lo pago; num Evento
// pago já existente, chave vazia é escolha do Dono e não pode ser repovoada
export const initialEventPixKey = (
  event: { isPaid: boolean; pixKey: string | null } | undefined,
  rachaKey: string | null
) => (event?.isPaid ? (event.pixKey ?? "") : event?.pixKey || rachaKey || "");

// a RPC recebe a chave já normalizada: o servidor apara menos espaços Unicode que o JS
export function checkPixKeyInput(text: string): TPixKeyInput {
  if (!text.trim()) return { key: "", type: null, isInvalid: false };
  const normalized = normalizePixKey(text);
  return normalized
    ? { key: normalized.key, type: normalized.type, isInvalid: false }
    : { key: "", type: null, isInvalid: true };
}
