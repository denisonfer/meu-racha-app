export type TEnvironmentName = "build" | "staging";
export type TSupabaseConfig = {
  url: string;
  anonKey: string;
  // Só o Homolog com chave configurada; produção usa a do build.
  revenuecatKey?: string;
};

// Valor salvo por versão anterior não tem o campo; qualquer coisa que não seja
// texto não vazio some em vez de invalidar o resto do config.
export function optionalRevenuecatKey(
  value: unknown
): { revenuecatKey: string } | Record<string, never> {
  return typeof value === "string" && value ? { revenuecatKey: value } : {};
}

// O createClient do supabase-js lança no import se a URL não passa no new URL;
// fora do __DEV__ só https (mesma trava do supabase.ts).
export function isAllowedSupabaseUrl(url: string, isDev: boolean): boolean {
  const scheme = /^(https?):\/\//i.exec(url)?.[1]?.toLowerCase();
  if (scheme !== "https" && !(isDev && scheme === "http")) return false;
  try {
    return new URL(url).host !== "";
  } catch {
    return false;
  }
}

function parseStored(stored: string, isDev: boolean): TSupabaseConfig | null {
  try {
    const { url, anonKey, revenuecatKey } = JSON.parse(stored) ?? {};
    if (typeof url !== "string" || typeof anonKey !== "string") return null;
    if (!url || !anonKey) return null;
    if (!isAllowedSupabaseUrl(url, isDev)) return null;
    return { url, anonKey, ...optionalRevenuecatKey(revenuecatKey) };
  } catch {
    return null;
  }
}

// Valor salvo ilegível nunca pode travar a abertura: volta ao build e avisa
// quem chama para apagar a chave.
export function resolveEnvironment(
  stored: string | null,
  build: TSupabaseConfig,
  isDev: boolean
): {
  name: TEnvironmentName;
  config: TSupabaseConfig;
  isStoredInvalid: boolean;
} {
  if (stored === null) {
    return { name: "build", config: build, isStoredInvalid: false };
  }
  const config = parseStored(stored, isDev);
  return config
    ? { name: "staging", config, isStoredInvalid: false }
    : { name: "build", config: build, isStoredInvalid: true };
}
