import { describe, expect, test } from "bun:test";
// o teste monta o erro real do SDK; o código de produção não o importa
// eslint-disable-next-line no-restricted-imports
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import {
  DevHubError,
  normalizeDevHubKey,
  toStagingConfig,
} from "./staging-config";

const httpError = (status: number) =>
  new FunctionsHttpError(new Response(null, { status }));

const kindOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof DevHubError ? e.kind : "other";
  }
  return null;
};

describe("normalizeDevHubKey", () => {
  test("tira espaço e quebra de linha das pontas", () => {
    expect(normalizeDevHubKey(" abc\n")).toBe("abc");
  });
});

describe("toStagingConfig", () => {
  test("200 com url e anonKey devolve o config", () => {
    const data = { url: "https://x.supabase.co", anonKey: "k" };
    expect(toStagingConfig({ data, error: null }, false)).toEqual(data);
  });

  test("401 vira invalidKey", () => {
    expect(
      kindOf(() =>
        toStagingConfig({ data: null, error: httpError(401) }, false)
      )
    ).toBe("invalidKey");
  });

  test("500 vira network", () => {
    expect(
      kindOf(() =>
        toStagingConfig({ data: null, error: httpError(500) }, false)
      )
    ).toBe("network");
  });

  test("erro de rede vira network", () => {
    const error = new FunctionsFetchError(new TypeError("offline"));
    expect(kindOf(() => toStagingConfig({ data: null, error }, false))).toBe(
      "network"
    );
  });

  test("data sem url ou sem anonKey vira network", () => {
    expect(
      kindOf(() => toStagingConfig({ data: {}, error: null }, false))
    ).toBe("network");
    expect(
      kindOf(() =>
        toStagingConfig({ data: { url: "https://x" }, error: null }, false)
      )
    ).toBe("network");
    expect(
      kindOf(() => toStagingConfig({ data: null, error: null }, false))
    ).toBe("network");
  });

  test("url sem esquema, ou http em release, vira network", () => {
    const data = { url: "abc.supabase.co", anonKey: "k" };
    expect(kindOf(() => toStagingConfig({ data, error: null }, false))).toBe(
      "network"
    );
    const http = { url: "http://x", anonKey: "k" };
    expect(
      kindOf(() => toStagingConfig({ data: http, error: null }, false))
    ).toBe("network");
    expect(toStagingConfig({ data: http, error: null }, true)).toEqual(http);
  });
});
