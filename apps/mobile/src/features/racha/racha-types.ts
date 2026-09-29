import type { TRachaRules } from "@meu-racha/domain";
import type { Database } from "@/lib/database.types";

export type TMemberRole = Database["public"]["Enums"]["member_role"];

export type TMyRacha = {
  id: string;
  name: string;
  role: TMemberRole;
  memberCount: number;
};

export type TRacha = {
  id: string;
  name: string;
  inviteCode: string;
  rules: TRachaRules;
  role: TMemberRole;
  memberCount: number;
};

export type TCreatedRacha = {
  id: string;
  inviteCode: string;
};
