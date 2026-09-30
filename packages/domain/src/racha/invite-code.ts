// Alfabeto do create_racha: sem 0/O e 1/I, porque o código é digitado por
// quem recebeu um print. Espelha o check invite_code_format do banco.
export const INVITE_CODE_LENGTH = 6;
const NOT_IN_ALPHABET = /[^A-HJ-NP-Z2-9]/g;

export function normalizeInviteCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(NOT_IN_ALPHABET, "")
    .slice(0, INVITE_CODE_LENGTH);
}
