import { supabase } from "@/lib/supabase";
import { normalizeDevHubKey, toStagingConfig } from "./utils/staging-config";

// Quem chama está sempre no ambiente do build, então o cliente é o de produção (ou o local).
async function fetchStagingConfig(key: string) {
  const result = await supabase.functions.invoke("devhub-staging-config", {
    body: { key: normalizeDevHubKey(key) },
  });
  return toStagingConfig(result, __DEV__);
}

export const devHubApi = { fetchStagingConfig };
