import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_PATTERN,
  dateMaskToISO,
  hasLetter,
  isNotTooOld,
  isOldEnough,
  isRealDate,
  isValidPositionSet,
  MIN_AGE,
  USERNAME_PATTERN,
} from "@meu-racha/domain";
import { z } from "zod";

const POSITIONS = ["ANY", "DEFENDER", "MIDFIELDER", "FORWARD"] as const;

export const signUpSchema = z
  .object({
    // etapa 1
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(USERNAME_PATTERN, "Use de 3 a 20 letras minúsculas, números e _")
      .refine(hasLetter, "Use ao menos uma letra"),
    displayName: z
      .string()
      .trim()
      .min(DISPLAY_NAME_MIN, "Como querem te chamar?")
      .max(DISPLAY_NAME_MAX, `No máximo ${DISPLAY_NAME_MAX} caracteres`)
      .regex(DISPLAY_NAME_PATTERN, "Use seu nome, sem números nem símbolos"),
    email: z.email("E-mail inválido"),
    password: z.string().min(8, "Mínimo de 8 caracteres"),

    // etapa 2
    playsAs: z.enum(["OUTFIELD", "GOALKEEPER"]),
    primaryPosition: z.enum(POSITIONS).nullable(),
    secondaryPosition: z.enum(POSITIONS).nullable(),

    // etapa 3 — guardamos o texto mascarado que a pessoa vê
    birthDate: z
      .string()
      .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use o formato DD/MM/AAAA"),

    acceptedTerms: z.boolean().refine((v) => v === true, {
      message: "É preciso aceitar os Termos",
    }),
  })
  .refine((v) => isRealDate(dateMaskToISO(v.birthDate) ?? ""), {
    path: ["birthDate"],
    message: "Essa data não existe",
  })
  .refine((v) => isOldEnough(dateMaskToISO(v.birthDate) ?? "", new Date()), {
    path: ["birthDate"],
    message: `É preciso ter ${MIN_AGE} anos ou mais`,
  })
  .refine((v) => isNotTooOld(dateMaskToISO(v.birthDate) ?? "", new Date()), {
    path: ["birthDate"],
    message: "Confira o ano de nascimento",
  })
  .refine((v) => v.playsAs !== "OUTFIELD" || v.primaryPosition !== null, {
    path: ["primaryPosition"],
    message: "Escolha sua posição principal",
  })
  .refine(isValidPositionSet, {
    path: ["secondaryPosition"],
    message: "Escolha uma secundária diferente da principal",
  });

export type TSignUpFormInput = z.input<typeof signUpSchema>;
export type TSignUpForm = z.output<typeof signUpSchema>;

export const stepFields = [
  ["username", "displayName", "email", "password"],
  ["playsAs", "primaryPosition", "secondaryPosition"],
  ["birthDate", "acceptedTerms"],
] as const satisfies readonly (readonly (keyof TSignUpForm)[])[];
