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
  place: string;
  weekday: number | null;
  kickoffHour: number | null;
  kickoffMinute: number | null;
  isPaid: boolean;
  price: number | null;
  monthlyPrice: number | null;
  spotLimit: number | null;
};

export type TCreatedRacha = {
  id: string;
  inviteCode: string;
};

export type TRachaSettings = {
  name: string;
  rules: TRachaRules;
};

export type TRachaLogistics = {
  place: string;
  weekday: number | null;
  kickoffHour: number | null;
  kickoffMinute: number | null;
  minAge: number | null;
  isPaid: boolean;
  price: number | null;
  monthlyPrice: number | null;
  spotLimit: number | null;
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

export type TMemberUpdate = {
  stars: number | null;
  isSuperStar: boolean;
  // null mantém o Cargo
  role: TMemberRole | null;
};

export type TRachaNotice = {
  id: string;
  rachaName: string;
  kind: Database["public"]["Enums"]["racha_notice_kind"];
};

export type TEventStatus = Database["public"]["Enums"]["event_status"];

export type TAttendanceStatus =
  Database["public"]["Enums"]["attendance_status"];

export type TMyRachaEvent = {
  rachaId: string;
  id: string;
  status: TEventStatus;
  startsOn: string;
  startsAt: string;
  place: string;
  confirmedCount: number;
  myStatus: TAttendanceStatus | null;
  myQueuePosition: number | null;
};

export type TOpenEvent = {
  id: string;
  status: TEventStatus;
  startsOn: string;
  startsAt: string;
  place: string;
  isPaid: boolean;
  price: number | null;
  spotLimit: number | null;
  outfieldPerTeam: number;
  conductorId: string | null;
  conductorName: string | null;
  confirmedCount: number;
  myStatus: TAttendanceStatus | null;
  myQueuePosition: number | null;
};

export type TEventInput = {
  startsOn: string;
  kickoffHour: number | null;
  kickoffMinute: number | null;
  place: string;
  isPaid: boolean;
  price: number | null;
  spotLimit: number | null;
};

export type TAttendancePerson = {
  kind: "member" | "guest";
  profileId: string | null;
  guestId: string | null;
  name: string;
  photoUrl: string | null;
  initials: string;
  // Membro e Avulso: Overall do Card; fatia sem partidas → OVERALL_MIN (40)
  overall: number;
  // Avulso: confirmed implícito → null
  status: TAttendanceStatus | null;
  queuePosition: number | null;
  didAttend: boolean;
  isPaidEffective: boolean;
  isMonthlyPass: boolean;
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  secondaryPosition: TPosition | null;
  role: TMemberRole | null;
  stars: number | null;
  isSuperStar: boolean;
  paymentNote: string | null;
};

export type TGuestInput = {
  displayName: string;
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  secondaryPosition: TPosition | null;
  stars: number | null;
  isSuperStar: boolean;
};

export type TAttendanceTarget =
  { kind: "member"; profileId: string } | { kind: "guest"; guestId: string };
