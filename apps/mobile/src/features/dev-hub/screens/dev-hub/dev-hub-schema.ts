import { z } from "zod";

export const devHubSchema = z.object({
  key: z.string().trim().min(1, "Informe a chave"),
});

export type TDevHubForm = z.infer<typeof devHubSchema>;
