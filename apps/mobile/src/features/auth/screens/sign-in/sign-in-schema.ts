import { z } from "zod";

export const signInSchema = z.object({
  username: z.string().trim().min(1, "Informe seu username"),
  password: z.string().min(1, "Informe sua senha"),
});

export type TSignInForm = z.infer<typeof signInSchema>;
