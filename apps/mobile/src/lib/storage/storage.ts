import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyValueStorage } from "./types";

export const storage: KeyValueStorage = AsyncStorage;
