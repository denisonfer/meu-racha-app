import type { TPlaysAs, TPosition } from "../profile/types";

export type TShownRole = "LINE" | "GOALKEEPER";

export type TLineCardNumbers = {
  matches: number;
  goals: number;
  assists: number;
  wins: number;
};

export type TKeeperCardNumbers = {
  matches: number;
  wins: number;
  cleanSheets: number;
  goals: number;
};

/** Números e Overall prontos do banco. Sem profileId: a Resenha não manda um. */
export type TMemberCardStats = {
  shownRole: TShownRole;
  overall: number;
  line: TLineCardNumbers;
  keeper: TKeeperCardNumbers;
  seasonYear: number;
  /** Onde joga e posição larga do Membro naquele Racha, não do Cadastro. */
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
};

export type TMemberCard = TMemberCardStats & {
  profileId: string;
};

export type TMyProfileCard = {
  rachaName: string;
  card: TMemberCard;
};
