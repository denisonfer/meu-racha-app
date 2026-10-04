import type { TPosition } from "@meu-racha/domain";
import { TEventStatus, TMemberRole } from "../racha-types";
import { SORT_TEAMS_DEFINED } from "./racha-messages";

export type TPositionSlot = "primary" | "secondary";

const SLOT_WORD: Record<TPositionSlot, string> = {
  primary: "principal",
  secondary: "secundária",
};

const ZONE_PHRASE: Record<TPosition, string> = {
  DEFENDER: "Na defesa",
  MIDFIELDER: "No meio-campo",
  FORWARD: "No ataque",
  ANY: "Em todas",
};

/** Rótulo visível do seletor: "Na defesa (principal)". */
export const positionDetailFieldLabel = (
  zone: TPosition,
  slot: TPositionSlot
) => `${ZONE_PHRASE[zone]} (${SLOT_WORD[slot]})`;

/** No Avulso o seletor fica logo abaixo da zona, que já diz se é principal. */
export const positionDetailZoneLabel = (zone: TPosition) => ZONE_PHRASE[zone];

/** Na Solicitação o seletor fica abaixo da zona do Perfil, em leitura. */
export const positionDetailJoinLabel = (zone: TPosition) =>
  `${ZONE_PHRASE[zone]}, você joga de`;

export const ZONE_NAME: Record<TPosition, string> = {
  DEFENDER: "Defensor",
  MIDFIELDER: "Meio-campo",
  FORWARD: "Atacante",
  ANY: "Todas",
};

/** Rótulo do leitor de tela: "Na defesa, principal". */
export const positionDetailFieldA11yLabel = (
  zone: TPosition,
  slot: TPositionSlot
) => `${ZONE_PHRASE[zone]}, ${SLOT_WORD[slot]}`;

// ATACANTE e TODAS têm uma única subdivisão: aparece como texto, sem escolha
export const POSITION_DETAIL_NO_CHOICE: Partial<Record<TPosition, string>> = {
  FORWARD: "Atacante. Não precisa escolher.",
  ANY: "Todas. Não precisa escolher.",
};

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

/** Evento active sem Sorteio é o legado: continua “em curso”. */
export const eventKicker = (status: TEventStatus, sortConfirmed: boolean) =>
  status === "active"
    ? sortConfirmed
      ? SORT_TEAMS_DEFINED
      : "Evento em curso"
    : "Evento agendado";
