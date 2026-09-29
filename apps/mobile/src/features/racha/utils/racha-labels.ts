import { TMemberRole } from "../racha-types";

export const ROLE_LABEL: Record<TMemberRole, string> = {
  OWNER: "DONO",
  ADMIN: "ADMIN",
  PLAYER: "JOGADOR",
};

export const memberCountLabel = (count: number) =>
  count === 1 ? "1 membro" : `${count} membros`;
