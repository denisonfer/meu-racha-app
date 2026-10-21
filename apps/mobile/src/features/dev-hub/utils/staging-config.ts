import { isAllowedSupabaseUrl } from "@/lib/resolve-environment";
import type { TSupabaseConfig } from "@/lib/environment";

export class DevHubError extends Error {
  constructor(public kind: "invalidKey" | "network") {
    super(kind);
  }
}

// Chave copiada de um gerenciador de senhas costuma vir com espaço ou quebra de linha.
export const normalizeDevHubKey = (raw: string) => raw.trim();

export function toStagingConfig(
  result: {
    data: unknown;
    error: unknown;
  },
  isDev: boolean
): TSupabaseConfig {
  const { data, error } = result;

  if (error) {
    // O ESLint só deixa @supabase/* entrar em lib e *-api.ts, então sem instanceof: o FunctionsHttpError traz o Response em context.
    const { name, context } = error as { name?: string; context?: Response };
    const isUnauthorized =
      name === "FunctionsHttpError" && context?.status === 401;
    throw new DevHubError(isUnauthorized ? "invalidKey" : "network");
  }

  const { url, anonKey } = (data ?? {}) as Partial<TSupabaseConfig>;
  // Config que o app não aceitaria na abertura travaria o reinício: nem grava.
  if (!url || !anonKey || !isAllowedSupabaseUrl(url, isDev))
    throw new DevHubError("network");

  return { url, anonKey };
}
