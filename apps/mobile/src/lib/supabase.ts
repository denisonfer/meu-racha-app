import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import type { Database } from "./database.types";
import { storage } from "./storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Faltam EXPO_PUBLIC_SUPABASE_URL e/ou EXPO_PUBLIC_SUPABASE_ANON_KEY. Crie apps/mobile/.env.local (veja bunx supabase status)."
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
