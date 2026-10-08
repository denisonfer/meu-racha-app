export type TSeasonList = "goals" | "assists" | "wins";

export type TSeasonRankItem = {
  id: string;
  name: string;
  value: number;
};

export type TSeasonRankRow = {
  id: string;
  position: number;
  isMe: boolean;
};

export type TSeasonRankMe = {
  position: number;
  value: number;
};

export type TSeasonRankRows = {
  rows: TSeasonRankRow[];
  me: TSeasonRankMe | null;
};

export type TSeasonPlacing = {
  list: TSeasonList;
  position: number | null;
};

export type TSeasonBestPlacing = {
  list: TSeasonList;
  position: number;
};

export type TSeasonRankingMember = {
  profileId: string;
  displayName: string;
  photoUrl: string | null;
  isActive: boolean;
  overall: number;
  goals: number;
  assists: number;
  wins: number;
};

export type TSeasonRanking = {
  seasonYear: number;
  members: TSeasonRankingMember[];
};

export type TSeasonEvent = {
  eventId: string;
  startsOn: string;
  place: string;
  matchCount: number;
  scorers: string[];
  topGoals: number;
};
