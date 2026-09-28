import type { TPlaysAs, TPosition } from "@meu-racha/domain";

export type TMyProfile = {
  displayName: string;
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  photoUri: string | null;
};
