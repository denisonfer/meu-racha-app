import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import type { Database } from "./database.types";
import { environment } from "./environment";
import { authStorage } from "./storage";

const { url, anonKey } = environment.config;

if (!url || !anonKey) {
  throw new Error(
    "Faltam EXPO_PUBLIC_SUPABASE_URL e/ou EXPO_PUBLIC_SUPABASE_ANON_KEY. Crie apps/mobile/.env.local (veja bunx supabase status)."
  );
}

// Em produção a sessão e o token não podem trafegar em texto claro.
if (!__DEV__ && url.startsWith("http://")) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL deve usar https:// em produção.");
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
