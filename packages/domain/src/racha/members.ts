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
export type TPositionGroup<T, K extends string = TPositionGroupKey> = {
  key: K;
  label: string;
  members: T[];
};
export type TPositionGroupDef<K extends string> = { key: K; label: string };

const GROUPS: TPositionGroupDef<TPositionGroupKey>[] = [
  { key: "GOALKEEPER", label: "Goleiros" },
  { key: "DEFENDER", label: "Defensores" },
  { key: "MIDFIELDER", label: "Meias" },
  { key: "FORWARD", label: "Atacantes" },
  { key: "ANY", label: "Todas as posições" },
];

type TZoneGrouped = {
  displayName: string;
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
};

const zoneKeyOf = (member: TZoneGrouped): TPositionGroupKey =>
  member.playsAs === "GOALKEEPER"
    ? "GOALKEEPER"
    : (member.primaryPosition ?? "ANY");

/** Agrupa na ordem dos grupos, sem reordenar dentro de cada um; só grupos não vazios. */
export function groupInOrder<T, K extends string>(
  items: T[],
  groups: readonly TPositionGroupDef<K>[],
  keyOf: (item: T) => K
): TPositionGroup<T, K>[] {
  return groups
    .map(({ key, label }) => ({
      key,
      label,
      members: items.filter((item) => keyOf(item) === key),
    }))
    .filter((group) => group.members.length > 0);
}

/** Sem grupos nem chave, agrupa pela zona ampla (aba Membros). */
export function groupMembersByPosition<T extends TZoneGrouped>(
  members: T[]
): TPositionGroup<T>[];
export function groupMembersByPosition<
  T extends { displayName: string },
  K extends string,
>(
  members: T[],
  groups: readonly TPositionGroupDef<K>[],
  keyOf: (member: T) => K
): TPositionGroup<T, K>[];
export function groupMembersByPosition(
  members: TZoneGrouped[],
  groups: readonly TPositionGroupDef<string>[] = GROUPS,
  keyOf: (member: TZoneGrouped) => string = zoneKeyOf
): TPositionGroup<TZoneGrouped, string>[] {
  const sorted = [...members].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "pt-BR")
  );
  return groupInOrder(sorted, groups, keyOf);
}
