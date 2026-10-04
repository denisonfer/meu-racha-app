import {
  positionDetailOptions,
  type TPlaysAs,
  type TPosition,
  type TPositionDetail,
} from "@meu-racha/domain";
import {
  POSITION_DETAIL_NO_CHOICE,
  positionDetailFieldA11yLabel,
  positionDetailFieldLabel,
  type TPositionSlot,
} from "./racha-labels";
import { positionDetailChoose } from "./racha-messages";

export type TPositionDetailSlot = {
  slot: TPositionSlot;
  label: string;
  accessibilityLabel: string;
  // vazio: zona sem subdivisão, aparece só o texto
  options: { value: TPositionDetail; label: string }[];
  noChoiceText: string | null;
  requiredError: string;
};

/** Um item por zona declarada; Goleiro não tem nenhum. */
export function positionDetailSlots(member: {
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  secondaryPosition: TPosition | null;
}): TPositionDetailSlot[] {
  if (member.playsAs === "GOALKEEPER") return [];
  const zones: [TPositionSlot, TPosition | null][] = [
    ["primary", member.primaryPosition],
    ["secondary", member.secondaryPosition],
  ];
  return zones.flatMap(([slot, zone]) => {
    if (zone === null) return [];
    const options = positionDetailOptions(zone);
    return [
      {
        slot,
        label: positionDetailFieldLabel(zone, slot),
        accessibilityLabel: positionDetailFieldA11yLabel(zone, slot),
        options,
        noChoiceText:
          options.length > 0 ? null : (POSITION_DETAIL_NO_CHOICE[zone] ?? null),
        requiredError: positionDetailChoose(options.map((o) => o.label)),
      },
    ];
  });
}

export const hasDetailChoice = (slots: TPositionDetailSlot[]) =>
  slots.some((slot) => slot.options.length > 0);
