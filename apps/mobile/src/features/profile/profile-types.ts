import type { TPlaysAs, TPosition } from "@meu-racha/domain";

export type TMyProfile = {
  displayName: string;
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  photoUri: string | null;
  isEmailVerified: boolean;
};

export type TAccountDeletionCheck = {
  rachaCount: number;
  ownedRachas: { id: string; name: string; memberCount: number }[];
  conducting: { rachaId: string; rachaName: string; eventId: string }[];
};
