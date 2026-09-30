import { TMemberRole } from "../racha-types";

export const ROLE_LABEL: Record<TMemberRole, string> = {
  OWNER: "DONO",
  ADMIN: "ADMIN",
  PLAYER: "JOGADOR",
};

export const ROLE_ACCESSIBILITY_LABEL: Record<TMemberRole, string> = {
  OWNER: "Dono",
  ADMIN: "Admin",
  PLAYER: "Jogador",
};

export const memberCountLabel = (count: number) =>
  count === 1 ? "1 membro" : `${count} membros`;

export const pendingWord = (count: number) =>
  count === 1 ? "pedido para entrar" : "pedidos para entrar";

export const pendingCountLabel = (count: number) =>
  `${count} ${pendingWord(count)}`;

export const pendingBadgeLabel = (count: number) =>
  count === 1 ? "1 PEDIDO" : `${count} PEDIDOS`;

export const starsLabel = (count: number) =>
  count === 1 ? "1 Estrela" : `${count} Estrelas`;
