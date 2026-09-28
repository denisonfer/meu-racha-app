import { TPlaysAs, TPosition } from "./types";

export const MIN_AGE = 16;
export const MAX_AGE = 90;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;
export const PASSWORD_MIN = 8;

export function isOldEnough(birthDateISO: string, today: Date): boolean {
  const birth = new Date(birthDateISO);
  if (Number.isNaN(birth.getTime())) return false;

  const limit = new Date(today);
  limit.setFullYear(limit.getFullYear() - MIN_AGE);

  return birth <= limit;
}

export function isRealDate(dateISO: string): boolean {
  const match = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(`${dateISO}T00:00:00Z`);

  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
  );
}

export function isValidPositionSet(p: {
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  secondaryPosition: TPosition | null;
}): boolean {
  if (p.playsAs === "GOALKEEPER") {
    return p.primaryPosition === null && p.secondaryPosition === null;
  }
  if (p.primaryPosition === null) return false;
  if (p.primaryPosition === "ANY") return p.secondaryPosition === null;

  return (
    p.secondaryPosition !== null &&
    p.secondaryPosition !== "ANY" &&
    p.secondaryPosition !== p.primaryPosition
  );
}

export const DISPLAY_NAME_PATTERN = /^[a-zA-ZÀ-ÖØ-öø-ÿ][a-zA-ZÀ-ÖØ-öø-ÿ '.-]*$/;

export function isNotTooOld(birthDateISO: string, today: Date): boolean {
  const birth = new Date(`${birthDateISO}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return false;

  const limit = new Date(today);
  limit.setFullYear(limit.getFullYear() - MAX_AGE);
  limit.setHours(0, 0, 0, 0);

  return birth >= limit;
}
