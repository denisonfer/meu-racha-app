import {
  MATCH_DURATION_MAX,
  MATCH_DURATION_MIN,
  MAX_WINS_MAX,
  MAX_WINS_MIN,
  MIN_AGE_MAX,
  MIN_AGE_MIN,
  OUTFIELD_PER_TEAM_MAX,
  OUTFIELD_PER_TEAM_MIN,
  PLACE_MAX,
  RACHA_NAME_MAX,
  RACHA_NAME_MIN,
  RACHA_NAME_PATTERN,
  YELLOW_OUT_MAX,
  YELLOW_OUT_MIN,
} from "@meu-racha/domain";
import { z } from "zod";
import {
  MATCH_DURATION_INVALID,
  MIN_AGE_INVALID,
  NAME_INVALID,
  NAME_TOO_SHORT,
  PLACE_REQUIRED,
  PLACE_TOO_LONG,
  YELLOW_OUT_INVALID,
  yellowShorterThanMatch,
} from "./utils/racha-messages";

const rachaNameSchema = (nameRequiredMessage: string) =>
  z
    .string()
    .trim()
    .min(1, nameRequiredMessage)
    .min(RACHA_NAME_MIN, NAME_TOO_SHORT)
    .max(RACHA_NAME_MAX)
    .regex(RACHA_NAME_PATTERN, NAME_INVALID);

const rachaRulesSchema = z.object({
  outfieldPerTeam: z
    .number()
    .int()
    .min(OUTFIELD_PER_TEAM_MIN)
    .max(OUTFIELD_PER_TEAM_MAX),
  gameMode: z.enum(["WINNER_STAYS", "ROTATION", "MAX_WINS"]),
  maxConsecutiveWins: z.number().int().min(MAX_WINS_MIN).max(MAX_WINS_MAX),
  tieRule: z.enum(["BOTH_OUT", "BOTH_STAY", "PENALTIES", "CHALLENGER_WINS"]),
  tieReturnOrder: z.enum(["RANDOM", "TEAM_ORDER"]),
  considerPosition: z.boolean(),
  matchDurationMin: z
    .number()
    .int()
    .min(MATCH_DURATION_MIN, MATCH_DURATION_INVALID)
    .max(MATCH_DURATION_MAX, MATCH_DURATION_INVALID)
    .nullable(),
  yellowCardMode: z.enum(["timed", "mark"]),
  // em mark os minutos ficam guardados, mas continuam na faixa do banco
  yellowOutMin: z
    .number()
    .int()
    .min(YELLOW_OUT_MIN, YELLOW_OUT_INVALID)
    .max(YELLOW_OUT_MAX, YELLOW_OUT_INVALID),
});

// espelha o check do banco só para mostrar o motivo nos dois campos
const rachaRulesWithYellowCheck = rachaRulesSchema.superRefine((rules, ctx) => {
  const { matchDurationMin, yellowCardMode, yellowOutMin } = rules;
  if (
    yellowCardMode === "timed" &&
    matchDurationMin !== null &&
    yellowOutMin >= matchDurationMin
  ) {
    const message = yellowShorterThanMatch(matchDurationMin);
    ctx.addIssue({ code: "custom", message, path: ["yellowOutMin"] });
    ctx.addIssue({ code: "custom", message, path: ["matchDurationMin"] });
  }
});

export const buildRachaFormSchema = (nameRequiredMessage: string) =>
  z.object({
    name: rachaNameSchema(nameRequiredMessage),
    rules: rachaRulesWithYellowCheck,
  });

export const buildCreateRachaFormSchema = (nameRequiredMessage: string) =>
  z.object({
    name: rachaNameSchema(nameRequiredMessage),
    place: z
      .string()
      .trim()
      .min(1, PLACE_REQUIRED)
      .max(PLACE_MAX, PLACE_TOO_LONG),
    minAge: z
      .number()
      .int()
      .min(MIN_AGE_MIN, MIN_AGE_INVALID)
      .max(MIN_AGE_MAX, MIN_AGE_INVALID)
      .nullable(),
    rules: rachaRulesWithYellowCheck,
  });

export type TRachaForm = z.infer<ReturnType<typeof buildRachaFormSchema>>;
export type TCreateRachaForm = z.infer<
  ReturnType<typeof buildCreateRachaFormSchema>
>;
