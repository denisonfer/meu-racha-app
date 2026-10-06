/** Retrato da Partida — camelCase do jsonb de get_event_match. */

export type TMatchEventStatus = "upcoming" | "active" | "finished";

export type TMatchPortraitState = "open" | "ready";

export type TMatchStatus = "open" | "finished" | "discarded";

export type TMatchRole = "OUTFIELD" | "GOALKEEPER";

export type TMatchEntryKind =
  "start" | "reinforcement" | "inclusion" | "return" | "goalkeeper";

export type TMatchPerson = {
  kind: "member" | "guest";
  personId: string;
  profileId: string | null;
  guestId: string | null;
  displayName: string;
  photoUrl: string | null;
};

export type TMatchNextSide = {
  teamId: string;
  teamNumber: number;
  winStreak: number;
  goalkeeper: TMatchPerson | null;
  isComplete: boolean;
};

export type TMatchSide = TMatchNextSide & {
  score: number;
  outfieldCount: number;
  capacity: number;
  lineup: TMatchLineupEntry[];
};

export type TMatchGoal = {
  id: string;
  requestKey: string;
  teamId: string;
  teamNumber: number;
  isOwnGoal: boolean;
  scorer: TMatchPerson | null;
  assist: TMatchPerson | null;
  concededGoalkeeper: TMatchPerson | null;
  createdAt: string;
};

export type TMatchCardColor = "yellow" | "red";

/** Efeito do amarelo no Evento: sai por minutos, ou fica em campo só marcado. */
export type TYellowCardMode = "timed" | "mark";

export type TMatchCardRedReason = "direct" | "secondYellow";

export type TMatchCard = {
  id: string;
  person: TMatchPerson;
  teamId: string;
  isGoalkeeper: boolean;
  color: TMatchCardColor;
  redReason: TMatchCardRedReason | null;
  matchSecond: number;
  createdAt: string;
};

export type TMatchLineupEntry = {
  teamId: string;
  role: TMatchRole;
  person: TMatchPerson;
  enteredAt: string;
  leftAt: string | null;
  entryKind: TMatchEntryKind;
  leftBySelf: boolean;
  leftByRed: boolean;
};

export type TMatchReinforcementDonor = {
  teamId: string;
  teamNumber: number;
  queuePosition: number;
  outfieldCount: number;
};

export type TMatchPendingReinforcement = {
  person: TMatchPerson;
  teamId: string;
  teamNumber: number;
  leftAt: string;
};

export type TMatchArrival =
  | { kind: "field"; teamId: string; teamNumber: number }
  | { kind: "field_draw"; teamId: null; teamNumber: null }
  | { kind: "queue"; teamId: string; teamNumber: number }
  | { kind: "new_team"; teamId: null; teamNumber: number };

export type TMatchLeaveEvent = {
  kind: "leave";
  id: string;
  person: TMatchPerson;
  teamId: string;
  teamNumber: number;
  bySelf: boolean;
  reinforced: boolean;
  outfieldCount: number;
  capacity: number;
  createdAt: string;
};

export type TMatchReinforcementEvent = {
  kind: "reinforcement";
  id: string;
  entered: TMatchPerson;
  left: TMatchPerson;
  fromTeamId: string;
  fromTeamNumber: number;
  toTeamId: string;
  toTeamNumber: number;
  teamDrawn: boolean;
  createdAt: string;
};

export type TMatchArrivalEvent = {
  kind: "inclusion" | "return";
  id: string;
  person: TMatchPerson;
  teamId: string;
  teamNumber: number;
  createdAt: string;
};

export type TMatchCardEvent = {
  kind: "card";
  id: string;
  person: TMatchPerson;
  teamId: string;
  teamNumber: number;
  isGoalkeeper: boolean;
  color: TMatchCardColor;
  redReason: TMatchCardRedReason | null;
  matchSecond: number;
  createdAt: string;
};

export type TMatchEvent =
  | (TMatchGoal & { kind: "goal" })
  | TMatchLeaveEvent
  | TMatchReinforcementEvent
  | TMatchArrivalEvent
  | TMatchCardEvent;

export type TMatchItem = {
  id: string;
  number: number;
  status: TMatchStatus;
  home: TMatchSide;
  away: TMatchSide;
  challengerTeamId: string | null;
  isRematch: boolean;
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  endedAt: string | null;
  winnerTeamId: string | null;
  decidedByPenalties: boolean;
  seq: number;
  goals: TMatchGoal[];
  cards: TMatchCard[];
  lineup: TMatchLineupEntry[];
};

export type TNextMatch = {
  home: TMatchNextSide;
  away: TMatchNextSide;
  challengerTeamId: string | null;
  isRematch: boolean;
};

export type TMatchTeamQueueEntry = {
  teamId: string;
  teamNumber: number;
  queueOrder: number;
  winStreak: number;
  isComplete: boolean;
};

export type TMatchGoalkeeperQueueEntry = {
  person: TMatchPerson;
  queueOrder: number;
};

export type TEventMatch = {
  eventId: string;
  eventStatus: TMatchEventStatus;
  state: TMatchPortraitState;
  serverNow: string;
  durationMin: number | null;
  yellowCardMode: TYellowCardMode;
  yellowOutMin: number;
  startedAt: string | null;
  pausedAt: string | null;
  pausedSeconds: number | null;
  seq: number;
  match: TMatchItem | null;
  nextMatch: TNextMatch | null;
  teams: TMatchTeamQueueEntry[];
  goalkeeperQueue: TMatchGoalkeeperQueueEntry[];
  finishedMatches: TMatchItem[];
  viewer: { canConduct: boolean };
  reinforcementDonors: TMatchReinforcementDonor[];
  pendingReinforcements: TMatchPendingReinforcement[];
  events: TMatchEvent[];
  nextArrival: TMatchArrival;
};

export type TMatchFinishPreview = {
  matchId: string;
  score: { home: number; away: number };
  winnerTeamId: string | null;
  decidedByPenalties: boolean;
  consequence: string;
  fallback: string | null;
  nextIsRematch: boolean;
  nextChallengerTeamId: string | null;
};

export type TMatchClockInput = {
  startedAt: string | null;
  pausedAt: string | null;
  pausedSeconds: number | null;
};
