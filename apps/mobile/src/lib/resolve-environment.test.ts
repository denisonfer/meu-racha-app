import { describe, expect, test } from "bun:test";
import {
  isAllowedSupabaseUrl,
  resolveEnvironment,
} from "./resolve-environment";

const build = { url: "https://build.example", anonKey: "build-key" };
const saved = (value: unknown) => JSON.stringify(value);

describe("resolveEnvironment", () => {
  test("sem valor salvo usa o config do build", () => {
    expect(resolveEnvironment(null, build, false)).toEqual({
      name: "build",
      config: build,
      isStoredInvalid: false,
    });
  });

  test("config salvo com https:// vira staging", () => {
    const config = { url: "https://staging.example", anonKey: "k" };
    expect(resolveEnvironment(saved(config), build, false)).toEqual({
      name: "staging",
      config,
      isStoredInvalid: false,
    });
  });

  test.each([
    ["JSON quebrado", "{"],
    ["JSON que não é objeto", "null"],
    ["url vazia", saved({ url: "", anonKey: "k" })],
    ["sem anonKey", saved({ url: "https://x" })],
    ["anonKey vazia", saved({ url: "https://x", anonKey: "" })],
    ["campos que não são texto", saved({ url: 1, anonKey: 2 })],
    ["url sem esquema", saved({ url: "abc.supabase.co", anonKey: "k" })],
    ["url só com esquema", saved({ url: "https://", anonKey: "k" })],
    ["HTTP:// maiúsculo em release", saved({ url: "HTTP://x", anonKey: "k" })],
  ])("%s volta ao build e marca inválido", (_, stored) => {
    expect(resolveEnvironment(stored, build, false)).toEqual({
      name: "build",
      config: build,
      isStoredInvalid: true,
    });
  });

  test("HTTPS:// maiúsculo vira staging", () => {
    const config = { url: "HTTPS://x.supabase.co", anonKey: "k" };
    expect(resolveEnvironment(saved(config), build, false).name).toBe(
      "staging"
    );
  });

  test("http:// só vale em __DEV__", () => {
    const stored = saved({ url: "http://x", anonKey: "k" });
    expect(resolveEnvironment(stored, build, false)).toEqual({
      name: "build",
      config: build,
      isStoredInvalid: true,
    });
    expect(resolveEnvironment(stored, build, true).name).toBe("staging");
  });
});

describe("isAllowedSupabaseUrl", () => {
  test("https sem diferenciar maiúscula", () => {
    expect(isAllowedSupabaseUrl("HTTPS://x.supabase.co", false)).toBe(true);
    expect(isAllowedSupabaseUrl("abc.supabase.co", true)).toBe(false);
    expect(isAllowedSupabaseUrl("https://", true)).toBe(false);
  });

  test("http só em __DEV__, sem diferenciar maiúscula", () => {
    expect(isAllowedSupabaseUrl("HTTP://x", false)).toBe(false);
    expect(isAllowedSupabaseUrl("HTTP://x", true)).toBe(true);
  });
});
