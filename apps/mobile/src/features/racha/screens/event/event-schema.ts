import {
  HOUR_MAX,
  HOUR_MIN,
  MINUTE_MAX,
  MINUTE_MIN,
  PLACE_MAX,
  PRICE_MAX,
  PRICE_MIN,
  SPOT_LIMIT_MAX,
  dateMaskToISO,
  isCivilDateBefore,
  isEventPlaceAllowed,
  isEventStartNotFuture,
  isRealDate,
  spotLimitFloor,
} from "@meu-racha/domain";
import { z } from "zod";
import {
  EVENT_DATE_INVALID,
  EVENT_DATE_PAST,
  EVENT_TIME_PAST,
  EVENT_PLACE_REQUIRED,
  HOUR_INVALID,
  KICKOFF_REQUIRED,
  MINUTE_INVALID,
  PLACE_TOO_LONG,
  PAYER_TARGET_INVALID,
  PAYER_TARGET_REQUIRED,
  PRICE_INVALID,
  PRICE_REQUIRED,
  SPOT_LIMIT_TOO_BIG,
  eventSpotLimitTooSmall,
} from "../../utils/racha-messages";

const hour = z
  .number()
  .int()
  .min(HOUR_MIN, HOUR_INVALID)
  .max(HOUR_MAX, HOUR_INVALID)
  .nullable();

const minute = z
  .number()
  .int()
  .min(MINUTE_MIN, MINUTE_INVALID)
  .max(MINUTE_MAX, MINUTE_INVALID)
  .nullable();

const price = z
  .number()
  .int()
  .min(PRICE_MIN, PRICE_INVALID)
  .max(PRICE_MAX, PRICE_INVALID)
  .nullable();

// nowCivil é o relógio de Brasília; a tela injeta o valor e o banco decide por último.
export function buildEventSchema(
  outfieldPerTeam: number,
  nowCivil: string,
  requireFuture = true
) {
  const floor = spotLimitFloor(outfieldPerTeam);
  const today = nowCivil.slice(0, 10);
  const currentMoment = nowCivil.includes("T")
    ? nowCivil
    : `${nowCivil}T00:00:00`;

  return z
    .object({
      startsOn: z.string(),
      kickoffHour: hour,
      kickoffMinute: minute,
      // overwrite: o banco recusa local diferente de btrim(place)
      place: z.string().trim(),
      isPaid: z.boolean(),
      price,
      spotLimit: z
        .number()
        .int()
        .max(SPOT_LIMIT_MAX, SPOT_LIMIT_TOO_BIG)
        .nullable(),
      payerTarget: z.number().int().nullable(),
    })
    .superRefine((value, ctx) => {
      const iso = dateMaskToISO(value.startsOn);
      if (!iso) {
        // máscara ainda não é DD/MM/AAAA: trava o Salvar e não pinta o campo
        ctx.addIssue({
          code: "custom",
          message: "",
          path: ["startsOnPending"],
        });
      } else if (!isRealDate(iso)) {
        ctx.addIssue({
          code: "custom",
          message: EVENT_DATE_INVALID,
          path: ["startsOn"],
        });
      } else if (isCivilDateBefore(iso, today)) {
        ctx.addIssue({
          code: "custom",
          message: EVENT_DATE_PAST,
          path: ["startsOn"],
        });
      } else if (
        requireFuture &&
        value.kickoffHour !== null &&
        value.kickoffMinute !== null &&
        isEventStartNotFuture(
          iso,
          value.kickoffHour,
          value.kickoffMinute,
          currentMoment
        )
      ) {
        ctx.addIssue({
          code: "custom",
          message: EVENT_TIME_PAST,
          path: ["slot"],
        });
      }

      if (value.kickoffHour === null || value.kickoffMinute === null) {
        ctx.addIssue({
          code: "custom",
          message: KICKOFF_REQUIRED,
          path: ["slot"],
        });
      }

      if (value.place.length > PLACE_MAX) {
        ctx.addIssue({
          code: "custom",
          message: PLACE_TOO_LONG,
          path: ["place"],
        });
      } else if (!isEventPlaceAllowed(value.place)) {
        ctx.addIssue({
          code: "custom",
          message: EVENT_PLACE_REQUIRED,
          path: ["place"],
        });
      }

      if (value.isPaid && value.price === null) {
        ctx.addIssue({
          code: "custom",
          message: PRICE_REQUIRED,
          path: ["price"],
        });
      }

      if (value.isPaid && value.payerTarget === null) {
        ctx.addIssue({
          code: "custom",
          message: PAYER_TARGET_REQUIRED,
          path: ["payerTarget"],
        });
      } else if (
        value.isPaid &&
        value.payerTarget !== null &&
        value.payerTarget <= 0
      ) {
        ctx.addIssue({
          code: "custom",
          message: PAYER_TARGET_INVALID,
          path: ["payerTarget"],
        });
      }

      if (value.spotLimit !== null && value.spotLimit < floor) {
        ctx.addIssue({
          code: "custom",
          message: eventSpotLimitTooSmall(floor),
          path: ["spotLimit"],
        });
      }
    });
}

export type TEventForm = z.infer<ReturnType<typeof buildEventSchema>>;

export function isoDateToMask(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

export function kickoffFromStartsAt(startsAt: string): {
  kickoffHour: number;
  kickoffMinute: number;
} {
  const [hourPart, minutePart] = startsAt.split(":");
  return {
    kickoffHour: Number(hourPart),
    kickoffMinute: Number(minutePart),
  };
}
