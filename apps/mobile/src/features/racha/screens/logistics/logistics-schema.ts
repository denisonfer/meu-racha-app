import {
  HOUR_MAX,
  HOUR_MIN,
  MINUTE_MAX,
  MINUTE_MIN,
  MIN_AGE_MAX,
  MIN_AGE_MIN,
  PLACE_MAX,
  PRICE_MAX,
  PRICE_MIN,
  SPOT_LIMIT_MAX,
  spotLimitFloor,
} from "@meu-racha/domain";
import { z } from "zod";
import {
  HOUR_INVALID,
  KICKOFF_REQUIRED,
  MINUTE_INVALID,
  MIN_AGE_INVALID,
  MONTHLY_PRICE_INVALID,
  PLACE_REQUIRED,
  PLACE_TOO_LONG,
  PAYER_TARGET_INVALID,
  PAYER_TARGET_REQUIRED,
  PRICE_INVALID,
  PRICE_REQUIRED,
  SPOT_LIMIT_TOO_BIG,
  WEEKDAY_REQUIRED,
  spotLimitTooSmall,
} from "../../utils/racha-messages";

const optionalHour = z
  .number()
  .int()
  .min(HOUR_MIN, HOUR_INVALID)
  .max(HOUR_MAX, HOUR_INVALID)
  .nullable();

const optionalMinute = z
  .number()
  .int()
  .min(MINUTE_MIN, MINUTE_INVALID)
  .max(MINUTE_MAX, MINUTE_INVALID)
  .nullable();

const optionalPrice = (message: string) =>
  z.number().int().min(PRICE_MIN, message).max(PRICE_MAX, message).nullable();

// a linha entra por fora: o piso das vagas muda se alguém alterar o motor
// com esta tela aberta, e a mensagem usa o número recarregado
export function buildLogisticsSchema(outfieldPerTeam: number) {
  const floor = spotLimitFloor(outfieldPerTeam);

  return z
    .object({
      // overwrite: o banco recusa local diferente de btrim(place)
      place: z
        .string()
        .trim()
        .min(1, PLACE_REQUIRED)
        .max(PLACE_MAX, PLACE_TOO_LONG),
      weekday: z.number().int().min(1).max(7).nullable(),
      kickoffHour: optionalHour,
      kickoffMinute: optionalMinute,
      minAge: z
        .number()
        .int()
        .min(MIN_AGE_MIN, MIN_AGE_INVALID)
        .max(MIN_AGE_MAX, MIN_AGE_INVALID)
        .nullable(),
      isPaid: z.boolean(),
      price: optionalPrice(PRICE_INVALID),
      monthlyPrice: optionalPrice(MONTHLY_PRICE_INVALID),
      spotLimit: z
        .number()
        .int()
        .max(SPOT_LIMIT_MAX, SPOT_LIMIT_TOO_BIG)
        .nullable(),
      payerTarget: z.number().int().nullable(),
    })
    .superRefine((value, ctx) => {
      const hasHour = value.kickoffHour !== null;
      const hasMinute = value.kickoffMinute !== null;
      const timeComplete = hasHour && hasMinute;

      // hora pela metade viraria null na RPC e o que foi digitado sumiria
      if (hasHour !== hasMinute || (value.weekday !== null && !timeComplete)) {
        ctx.addIssue({
          code: "custom",
          message: KICKOFF_REQUIRED,
          path: ["slot"],
        });
      } else if (value.weekday === null && timeComplete) {
        ctx.addIssue({
          code: "custom",
          message: WEEKDAY_REQUIRED,
          path: ["slot"],
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
          message: spotLimitTooSmall(floor),
          path: ["spotLimit"],
        });
      }
    });
}

export type TLogisticsForm = z.infer<ReturnType<typeof buildLogisticsSchema>>;
