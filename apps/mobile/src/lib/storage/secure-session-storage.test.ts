import { describe, expect, test } from "bun:test";
import { createSecureSessionStorage } from "./secure-session-storage";

const KEY = "sb-ref-auth-token";

function setup(legacyValue?: string) {
  const secure = new Map<string, string>();
  const legacy = new Map<string, string>(
    legacyValue ? [[KEY, legacyValue]] : []
  );
  const store = createSecureSessionStorage(
    {
      get: async (k) => secure.get(k) ?? null,
      set: async (k, v) => void secure.set(k, v),
      remove: async (k) => void secure.delete(k),
    },
    {
      getItem: (k) => legacy.get(k) ?? null,
      setItem: (k, v) => void legacy.set(k, v),
      removeItem: (k) => void legacy.delete(k),
    }
  );
  return { secure, legacy, store };
}

describe("secure session storage", () => {
  test("fatia valores grandes e remonta igual, sem fatia acima de 2048", async () => {
    const { secure, store } = setup();
    const value = JSON.stringify({ t: "x".repeat(5000) });
    await store.setItem(KEY, value);
    expect(await store.getItem(KEY)).toBe(value);
    for (const v of secure.values()) expect(v.length).toBeLessThan(2048);
    expect(secure.size).toBeGreaterThan(2);
  });

  test("regravar menor remove fatias órfãs", async () => {
    const { secure, store } = setup();
    await store.setItem(KEY, "a".repeat(5000));
    await store.setItem(KEY, "b");
    expect(secure.size).toBe(2);
    expect(await store.getItem(KEY)).toBe("b");
  });

  test("migra a sessão do AsyncStorage e apaga a cópia em texto claro", async () => {
    const { legacy, store } = setup("sessao-antiga");
    expect(await store.getItem(KEY)).toBe("sessao-antiga");
    expect(legacy.has(KEY)).toBe(false);
    expect(await store.getItem(KEY)).toBe("sessao-antiga");
  });

  test("sem sessão em lugar nenhum devolve null; remove limpa tudo", async () => {
    const { secure, store } = setup();
    expect(await store.getItem(KEY)).toBeNull();
    await store.setItem(KEY, "v");
    await store.removeItem(KEY);
    expect(secure.size).toBe(0);
    expect(await store.getItem(KEY)).toBeNull();
  });

  test("fatia ausente invalida a sessão em vez de devolver parcial", async () => {
    const { secure, store } = setup();
    await store.setItem(KEY, "a".repeat(5000));
    secure.delete(`${KEY}.1`);
    expect(await store.getItem(KEY)).toBeNull();
  });
});
