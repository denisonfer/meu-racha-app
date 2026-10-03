import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_PATTERN,
  isValidPositionSet,
  type TPlaysAs,
  type TPosition,
} from "@meu-racha/domain";
import { z } from "zod";
import {
  ATTENDANCE_GUEST_NAME_REQUIRED,
  ATTENDANCE_GUEST_PRIMARY_REQUIRED,
  ATTENDANCE_GUEST_SECONDARY_REQUIRED,
  ATTENDANCE_GUEST_STARS_REQUIRED,
} from "../../utils/racha-messages";

const POSITIONS = ["ANY", "DEFENDER", "MIDFIELDER", "FORWARD"] as const;

export type TGuestFormValues = {
  displayName: string;
  playsAs: TPlaysAs;
  primaryPosition: TPosition | null;
  secondaryPosition: TPosition | null;
  stars: number | null;
  isSuperStar: boolean;
};

export const guestFormSchema = z
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
  });

export const emptyGuestForm = (): TGuestFormValues => ({
  displayName: "",
  playsAs: "OUTFIELD",
  primaryPosition: null,
  secondaryPosition: null,
  stars: null,
  isSuperStar: false,
});
