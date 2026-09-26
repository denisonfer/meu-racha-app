import type { TPlaysAs, TPosition } from "@meu-racha/domain";

export type TSignUpInput = {
  email: string;
  password: string;
  displayName: string;
  birthDate: string; // "1991-01-01"
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  secondaryPosition: TPosition | null;
};

export type TSignInInput = {
  email: string;
  password: string;
};

export type TSession = {
  userId: string;
  email: string;
};
