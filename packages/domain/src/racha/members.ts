import { roleBadge } from "../card/card";
import { TPlaysAs, TPosition } from "../profile/types";

// espelham o check member_stars_range do banco
export const STARS_MIN = 1;
export const STARS_MAX = 5;

export function formatPlaysAs(
  playsAs: TPlaysAs,
  primary: TPosition | null,
  secondary: TPosition | null
): string {
  if (playsAs === "GOALKEEPER") return "Gol";
  const positions = [primary, secondary]
    .filter((position): position is TPosition => position !== null)
    .map((position) => roleBadge("OUTFIELD", position));
  return `Linha · ${positions.join(" / ")}`;
}

export const isBelowMinAge = (age: number, minAge: number | null) =>
  minAge !== null && age < minAge;

export function formatAge(age: number, minAge: number | null): string {
  const text = `${age} anos`;
  return isBelowMinAge(age, minAge)
    ? `${text} · abaixo da idade mínima (${minAge})`
    : text;
}

export type TPositionGroupKey = "GOALKEEPER" | TPosition;
export type TPositionGroup<T> = {
  key: TPositionGroupKey;
  label: string;
  members: T[];
};

const GROUPS: { key: TPositionGroupKey; label: string }[] = [
  { key: "GOALKEEPER", label: "Goleiros" },
  { key: "DEFENDER", label: "Defensores" },
  { key: "MIDFIELDER", label: "Meias" },
  { key: "FORWARD", label: "Atacantes" },
  { key: "ANY", label: "Todas as posições" },
];

export function groupMembersByPosition<
  T extends {
    displayName: string;
    playsAs: TPlaysAs;
    primaryPosition: TPosition | null;
  },
>(members: T[]): TPositionGroup<T>[] {
  const keyOf = (member: T): TPositionGroupKey =>
    member.playsAs === "GOALKEEPER"
      ? "GOALKEEPER"
      : (member.primaryPosition ?? "ANY");

  return GROUPS.map(({ key, label }) => ({
    key,
    label,
    members: members
      .filter((member) => keyOf(member) === key)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR")),
  })).filter((group) => group.members.length > 0);
}
