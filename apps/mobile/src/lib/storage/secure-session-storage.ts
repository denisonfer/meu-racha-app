import type { KeyValueStorage } from "./types";

type SecureItems = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

// O iOS já recusou valores acima de ~2048 bytes no Keychain e o Expo não valida
// (doc do expo-secure-store v57); a sessão JSON passa disso, então fatiamos.
const CHUNK_SIZE = 1800;

const headerOf = (count: number) => `chunks:${count}`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

// A chave principal guarda só o número de fatias; as fatias vivem em `<key>.<i>`
// (SecureStore aceita apenas alfanumérico, ".", "-" e "_" nas chaves).
export function createSecureSessionStorage(
  secure: SecureItems,
  legacy: KeyValueStorage
): KeyValueStorage {
  const removeChunks = async (key: string, count: number) => {
    for (let i = 0; i < count; i++) await secure.remove(chunkKey(key, i));
  };

  const readCount = async (key: string) => {
    const header = await secure.get(key);
    const match = header?.match(/^chunks:(\d+)$/);
    return match ? Number(match[1]) : null;
  };

  const setItem = async (key: string, value: string) => {
    const previous = (await readCount(key)) ?? 0;
    const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    // Fatias antes do cabeçalho: uma falha no meio nunca deixa um cabeçalho
    // apontando para uma sessão incompleta.
    for (let i = 0; i < count; i++) {
      await secure.set(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }
    await secure.set(key, headerOf(count));
    for (let i = count; i < previous; i++)
      await secure.remove(chunkKey(key, i));
  };

  return {
    async getItem(key) {
      const count = await readCount(key);
      if (count === null) {
        // Migração: sessão gravada em texto claro por versões anteriores.
        const old = await legacy.getItem(key);
        if (old === null) return null;
        await setItem(key, old);
        await legacy.removeItem(key);
        return old;
      }
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await secure.get(chunkKey(key, i));
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join("");
    },
    setItem,
    async removeItem(key) {
      await removeChunks(key, (await readCount(key)) ?? 0);
      await secure.remove(key);
      await legacy.removeItem(key);
    },
  };
}
