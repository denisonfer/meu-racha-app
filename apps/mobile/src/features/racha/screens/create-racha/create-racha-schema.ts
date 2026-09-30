import {
  MATCH_DURATION_MAX,
  MATCH_DURATION_MIN,
  MAX_WINS_MAX,
  MAX_WINS_MIN,
  MIN_AGE_MAX,
  MIN_AGE_MIN,
  OUTFIELD_PER_TEAM_MAX,
  OUTFIELD_PER_TEAM_MIN,
  RACHA_NAME_MAX,
  RACHA_NAME_MIN,
  RACHA_NAME_PATTERN,
} from "@meu-racha/domain";
import { z } from "zod";
import {
  MATCH_DURATION_INVALID,
  MIN_AGE_INVALID,
  NAME_INVALID,
  NAME_REQUIRED,
  NAME_TOO_SHORT,
} from "../../utils/racha-messages";

export const createRachaSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, NAME_REQUIRED)
    .min(RACHA_NAME_MIN, NAME_TOO_SHORT)
    .max(RACHA_NAME_MAX)
    .regex(RACHA_NAME_PATTERN, NAME_INVALID),
  minAge: z
    .number()
    .int()
    .min(MIN_AGE_MIN, MIN_AGE_INVALID)
    .max(MIN_AGE_MAX, MIN_AGE_INVALID)
    .nullable(),
  rules: z.object({
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
  }),
});

export type TCreateRachaForm = z.infer<typeof createRachaSchema>;
