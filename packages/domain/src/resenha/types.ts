import type { TMemberCardStats } from "../card";
import type { TPlaysAs, TPosition } from "../profile";
import type { TMatchPerson } from "../match/types";

export type TResenhaPersonStats = {
  person: TMatchPerson;
  goals: number;
  assists: number;
  wins: number;
};

export type TResenhaTeam = {
  teamNumber: number;
  wins: number;
};

export type TResenhaCardColor = "yellow" | "red";

export type TResenhaCard = {
  person: TMatchPerson;
  color: TResenhaCardColor;
  matchNumber: number;
};

export type TResenhaScorerCard = {
  displayName: string;
  photoUrl: string | null;
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  isSuperStar: boolean;
} & TMemberCardStats;

export type TResenha = {
  startsOn: string;
  place: string;
  rachaName: string;
  matchCount: number;
  people: TResenhaPersonStats[];
  teams: TResenhaTeam[];
  cards: TResenhaCard[];
  scorerCard: TResenhaScorerCard | null;
};

export type TResenhaSummary = {
  eventId: string;
  startsOn: string;
  matchCount: number;
  scorers: string[];
  topGoals: number;
};

export type TResenhaLeaders = {
  names: string[];
  count: number;
};

export type TResenhaTopTeams = {
  teamNumbers: number[];
  wins: number;
};

export type TResenhaCardsSummary = {
  yellow: number;
  red: number;
  redNames: string[];
};

export type TResenhaCivilDate = {
  weekdayShort: string;
  weekdayLong: string;
  weekdayShortUpper: string;
  dayMonth: string;
};
