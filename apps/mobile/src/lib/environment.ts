import { reloadAppAsync } from "expo";
import * as SecureStore from "expo-secure-store";
import {
  resolveEnvironment,
  type TEnvironmentName,
  type TSupabaseConfig,
} from "./resolve-environment";

export type { TEnvironmentName, TSupabaseConfig };

const KEY = "devhub.staging";

// Mesmas opções do storage.ts (sessão), para o config seguir a mesma regra do keychain.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

// Keychain ilegível não pode derrubar a abertura: cai no build, sem apagar a chave.
function readStored(): string | null {
  try {
    return SecureStore.getItem(KEY, options);
  } catch {
    return null;
  }
}

const resolved = resolveEnvironment(
  readStored(),
  {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
  __DEV__
);

if (resolved.isStoredInvalid) {
  SecureStore.deleteItemAsync(KEY, options).catch(() => {});
}

// Calculado uma vez no import: o cliente Supabase nasce com ele e só um
// reinício troca de ambiente.
export const environment: { name: TEnvironmentName; config: TSupabaseConfig } =
  { name: resolved.name, config: resolved.config };

export const buildEnvironmentLabel: "Produção" | "Local" = __DEV__
  ? "Local"
  : "Produção";

export async function enterStaging(config: TSupabaseConfig): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(config), options);
  try {
    await reloadAppAsync("devhub");
  } catch (error) {
    // Sem reinício, o config salvo mandaria a próxima abertura ao Homolog sem a pessoa esperar.
    await SecureStore.deleteItemAsync(KEY, options).catch(() => {});
    throw error;
  }
}

export async function leaveStaging(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, options);
  await reloadAppAsync("devhub");
}
