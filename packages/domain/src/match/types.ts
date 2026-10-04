/** Retrato da Partida — camelCase do jsonb de get_event_match. */

export type TMatchEventStatus = "upcoming" | "active" | "finished";

export type TMatchPortraitState = "open" | "ready";

export type TMatchStatus = "open" | "finished" | "discarded";

export type TMatchRole = "OUTFIELD" | "GOALKEEPER";

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

export type TMatchSide = TMatchNextSide & { score: number };

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

export type TMatchLineupEntry = {
  teamId: string;
  role: TMatchRole;
  person: TMatchPerson;
  enteredAt: string;
  leftAt: string | null;
};

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
