// a RLS esconde o Racha de quem saiu, foi expulso ou teve o Racha excluído:
// getRacha não acha a linha (PGRST116) ou acha sem o "me"; as RPCs dizem not_allowed
const NO_ACCESS_CODES = ["PGRST116", "not_a_member", "not_allowed"];

export const isNoAccessError = (error: unknown) =>
  error instanceof Error && NO_ACCESS_CODES.includes(error.message);
