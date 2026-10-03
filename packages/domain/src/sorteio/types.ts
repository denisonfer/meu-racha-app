import type { TPlaysAs, TPosition } from "../profile";

export type TSortMode = "normal" | "split";

export type TSortBalanceLabel =
  "Muito equilibrado" | "Equilibrado" | "Razoável" | "Desequilibrado";

export type TSortAttendanceStatus =
  "confirmed" | "waitlisted" | "cancelled" | "left";

/** Membro ou Avulso, sempre identificado por exatamente um dos dois ids. */
export type TSortPerson = {
  kind: "member" | "guest";
  profileId: string | null;
  guestId: string | null;
  displayName: string;
  photoUrl: string | null;
};

/** Retrato do jogador de linha no Sorteio; Estrelas e Posições não acompanham edições. */
export type TSortPlayer = TSortPerson & {
  stars: number;
  isSuperStar: boolean;
  primaryPosition: TPosition | null;
  secondaryPosition: TPosition | null;
  enteredAt: string;
};

export type TSortTeam = {
  teamNumber: number;
  // null: Time incompleto fora da fila de jogo
  queueOrder: number | null;
  isActive: boolean;
  playerCount: number;
  // Time incompleto (a sobra) é o que tem isComplete = false
  isComplete: boolean;
  // soma atual dos jogadores que seguem no Time; o score abaixo é histórico
  starSum: number;
  superCount: number;
  players: TSortPlayer[];
  goalkeeper: TSortPerson | null;
};

export type TSortGoalkeeperQueueEntry = TSortPerson & { queueOrder: number };

export type TSortBalance = {
  score: number;
  label: TSortBalanceLabel;
  diff: number;
  superDiff: number;
  cappedBySuper: boolean;
};

/** Super Estrelas que o Sorteio não conseguiu separar, por Time. */
export type TSortSuperWarning = {
  teamNumber: number;
  // ids de Membro ou Avulso dos jogadores de TSortTeam.players
  playerIds: string[];
};

type TSortProposalCounts = {
  eventId: string;
  lineCount: number;
  goalkeeperCount: number;
  minLinePlayers: number;
  canSort: boolean;
  considerPosition: boolean;
  // linha e goleiros contam só quem veio; confirmados sem "veio" ficam fora do Sorteio
  confirmedCount: number;
  notAttendedCount: number;
};

export type TSortProposal =
  | (TSortProposalCounts & { state: "none" | "stale" })
  | (TSortProposalCounts & {
      state: "ready";
      version: number;
      mode: TSortMode;
      balance: TSortBalance;
      superWarning: TSortSuperWarning[];
      teams: TSortTeam[];
      goalkeepersPerTeam: boolean;
      goalkeeperQueue: TSortGoalkeeperQueueEntry[];
    });

export type TSortWaitingReason = "waitlisted" | "not_attended";

export type TSortWaitingPlayer = {
  profileId: string;
  displayName: string;
  photoUrl: string | null;
  playsAs: TPlaysAs;
  // null para not_attended: confirmou e não veio, não está na fila
  queuePosition: number | null;
  reason: TSortWaitingReason;
};

export type TSortLeftPlayer = TSortPerson & {
  playsAs: TPlaysAs;
  didAttend: boolean;
};

/** O que o espectador pode fazer; vem do banco, o app não deriva papel. */
export type TSortViewer = {
  myStatus: TSortAttendanceStatus | null;
  canInclude: boolean;
  canReturn: boolean;
  canLeaveAny: boolean;
  canLeaveSelf: boolean;
};

export type TPublishedSort =
  | { state: "none" }
  | {
      state: "published";
      eventId: string;
      eventStatus: "upcoming" | "active" | "finished";
      conductorId: string | null;
      isConductor: boolean;
      confirmedAt: string;
      outfieldPerTeam: number;
      mode: TSortMode;
      balance: TSortBalance;
      superWarning: TSortSuperWarning[];
      teams: TSortTeam[];
      goalkeepersPerTeam: boolean;
      goalkeeperQueue: TSortGoalkeeperQueueEntry[];
      viewer: TSortViewer;
      waitingForInclusion: TSortWaitingPlayer[];
      left: TSortLeftPlayer[];
    };
