import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createSecureSessionStorage } from "./secure-session-storage";
import type { KeyValueStorage } from "./types";

export const storage: KeyValueStorage = AsyncStorage;

// AFTER_FIRST_UNLOCK: o iOS pode abrir o app em segundo plano (push) com o
// aparelho bloqueado e o refresh token precisa estar legível; THIS_DEVICE_ONLY
// impede que o item vá para backup ou outro aparelho.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const authStorage: KeyValueStorage = createSecureSessionStorage(
  {
    get: (key) => SecureStore.getItemAsync(key, options),
    set: (key, value) => SecureStore.setItemAsync(key, value, options),
    remove: (key) => SecureStore.deleteItemAsync(key, options),
  },
  AsyncStorage
);
