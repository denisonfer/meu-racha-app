import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_PATTERN,
  isValidPositionSet,
  positionDetailFits,
  positionDetailOptions,
  type TPlaysAs,
  type TPosition,
  type TPositionDetail,
} from "@meu-racha/domain";
import { z } from "zod";
import {
  ATTENDANCE_GUEST_NAME_REQUIRED,
  ATTENDANCE_GUEST_PRIMARY_REQUIRED,
  ATTENDANCE_GUEST_SECONDARY_REQUIRED,
  ATTENDANCE_GUEST_STARS_REQUIRED,
  positionDetailChoose,
} from "../../utils/racha-messages";

const POSITIONS = ["ANY", "DEFENDER", "MIDFIELDER", "FORWARD"] as const;
const POSITION_DETAILS = [
  "CENTER_BACK",
  "FULL_BACK",
  "DEFENSIVE_MID",
  "ATTACKING_MID",
] as const;

export type TGuestFormValues = {
  displayName: string;
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  secondaryPosition: TPosition | null;
  primaryPositionDetail: TPositionDetail | null;
  secondaryPositionDetail: TPositionDetail | null;
  stars: number | null;
  isSuperStar: boolean;
};

/** `asksPositionDetail`: Evento 8+, onde DEF e MEI pedem a subdivisão. */
export const buildGuestFormSchema = (asksPositionDetail: boolean) =>
  z
    .object({
      displayName: z
        .string()
        .trim()
        .min(DISPLAY_NAME_MIN, ATTENDANCE_GUEST_NAME_REQUIRED)
        .max(DISPLAY_NAME_MAX, `No máximo ${DISPLAY_NAME_MAX} caracteres`)
        .regex(DISPLAY_NAME_PATTERN, "Use o nome, sem números nem símbolos"),
      playsAs: z.enum(["OUTFIELD", "GOALKEEPER"]),
      primaryPosition: z.enum(POSITIONS).nullable(),
      secondaryPosition: z.enum(POSITIONS).nullable(),
      primaryPositionDetail: z.enum(POSITION_DETAILS).nullable(),
      secondaryPositionDetail: z.enum(POSITION_DETAILS).nullable(),
      stars: z.number().int().min(1).max(5).nullable(),
      isSuperStar: z.boolean(),
    })
    .superRefine((value, ctx) => {
      if (value.playsAs === "OUTFIELD" && value.stars === null) {
        ctx.addIssue({
          code: "custom",
          path: ["stars"],
          message: ATTENDANCE_GUEST_STARS_REQUIRED,
        });
      }
      if (value.playsAs === "OUTFIELD" && value.primaryPosition === null) {
        ctx.addIssue({
          code: "custom",
          path: ["primaryPosition"],
          message: ATTENDANCE_GUEST_PRIMARY_REQUIRED,
        });
      }
      if (!isValidPositionSet(value)) {
        ctx.addIssue({
          code: "custom",
          path: ["secondaryPosition"],
          message: ATTENDANCE_GUEST_SECONDARY_REQUIRED,
        });
      }
      if (!asksPositionDetail || value.playsAs !== "OUTFIELD") return;
      const slots = [
        [
          "primaryPositionDetail",
          value.primaryPosition,
          value.primaryPositionDetail,
        ],
        [
          "secondaryPositionDetail",
          value.secondaryPosition,
          value.secondaryPositionDetail,
        ],
      ] as const;
      for (const [path, zone, detail] of slots) {
        const options = zone ? positionDetailOptions(zone) : [];
        if (
          options.length > 0 &&
          (detail === null || !positionDetailFits(zone, detail))
        ) {
          ctx.addIssue({
            code: "custom",
            path: [path],
            message: positionDetailChoose(options.map((o) => o.label)),
          });
        }
      }
    });

export const emptyGuestForm = (): TGuestFormValues => ({
  displayName: "",
  playsAs: "OUTFIELD",
  primaryPosition: null,
  secondaryPosition: null,
  primaryPositionDetail: null,
  secondaryPositionDetail: null,
  stars: null,
  isSuperStar: false,
});

/** A subdivisão só vai ao banco no Evento 8+ e quando cabe na zona enviada. */
export const guestPositionDetail = (
  asksPositionDetail: boolean,
  zone: TPosition | null,
  detail: TPositionDetail | null
) =>
  asksPositionDetail && zone !== null && positionDetailFits(zone, detail)
    ? detail
    : null;
