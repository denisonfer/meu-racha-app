import type { TPlaysAs, TPosition, TRachaRules } from "@meu-racha/domain";
import type { Database } from "@/lib/database.types";

export type TMemberRole = Database["public"]["Enums"]["member_role"];

export type TMyRacha = {
  id: string;
  name: string;
  role: TMemberRole;
  memberCount: number;
  pendingCount: number;
};

export type TRacha = {
  id: string;
  name: string;
  inviteCode: string;
  rules: TRachaRules;
  role: TMemberRole;
  memberCount: number;
  pendingCount: number;
  minAge: number | null;
};

export type TCreatedRacha = {
  id: string;
  inviteCode: string;
};

export type TRachaSettings = {
  name: string;
  minAge: number | null;
  rules: TRachaRules;
};

export type TInviteStatus = "MEMBER" | "PENDING";

export type TInvite = {
  rachaId: string;
  name: string;
  memberCount: number;
  ownerName: string;
  minAge: number | null;
  myStatus: TInviteStatus | null;
};

export type TMyJoinRequest = {
  rachaId: string;
  rachaName: string;
};

export type TJoinRequest = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  age: number;
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  secondaryPosition: TPosition | null;
};

export type TRachaMember = {
  profileId: string;
  displayName: string;
  photoUrl: string | null;
  role: TMemberRole;
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  secondaryPosition: TPosition | null;
  stars: number | null;
  isSuperStar: boolean;
};
