import type { TPublishedSort, TSortPerson } from "../sorteio/types";

export const BOLINHAS_AVAILABILITY = ["ok", "no_receiver", "no_giver"] as const;
export type TBolinhasAvailability = (typeof BOLINHAS_AVAILABILITY)[number];

export type TBolinhasColor = "blue" | "red";

/** Um Time na fila, só com o que as regras das Bolinhas leem. */
export type TBolinhasTeam = {
  teamNumber: number;
  // null: fora da fila de jogo
  queueOrder: number | null;
  // jogadores de linha ativos
  activeCount: number;
};

export type TBolinhasPick = TSortPerson & {
  // id de Membro ou Avulso, o mesmo de quem chega ao Time de destino
  personId: string;
  color: TBolinhasColor;
};

/** Retorno de draw_event_bolinhas: a ordem da animação e o retrato novo dos Times. */
export type TDrawnBolinhas = {
  bolinhasId: string;
  allMove: boolean;
  order: TBolinhasPick[];
  published: Extract<TPublishedSort, { state: "published" }>;
};
