import { PASSWORD_MIN } from "@meu-racha/domain";
import { z } from "zod";

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, `Mínimo de ${PASSWORD_MIN} caracteres`),
    confirmation: z.string(),
  })
  .refine((v) => v.password === v.confirmation, {
    path: ["confirmation"],
    message: "As senhas não conferem",
  });

export type TResetPasswordForm = z.infer<typeof resetPasswordSchema>;
