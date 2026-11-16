import { describe, expect, test } from "bun:test";
import {
  isPurchaseAvailable,
  playSubscriptionsUrl,
  trialDays,
} from "./purchase-availability";

describe("isPurchaseAvailable", () => {
  const base = {
    os: "android",
    envName: "staging" as const,
    revenuecatKey: "goog_x",
    isSaleOpen: false,
  };

  test("Android, Homolog, com chave e venda fechada: disponível", () => {
    expect(isPurchaseAvailable(base)).toBe(true);
  });

  test("Android, build, com chave e venda fechada: indisponível", () => {
    expect(isPurchaseAvailable({ ...base, envName: "build" })).toBe(false);
  });

  test("Android, Homolog, sem chave: indisponível", () => {
    expect(isPurchaseAvailable({ ...base, revenuecatKey: undefined })).toBe(
      false
    );
  });

  test("iOS, Homolog, com chave: indisponível", () => {
    expect(isPurchaseAvailable({ ...base, os: "ios" })).toBe(false);
  });

  test("Android, build, com chave e venda aberta: disponível", () => {
    expect(
      isPurchaseAvailable({ ...base, envName: "build", isSaleOpen: true })
    ).toBe(true);
  });
});

describe("playSubscriptionsUrl", () => {
  test("sem produto, termina no pacote", () => {
    expect(playSubscriptionsUrl(null).endsWith("package=app.meuracha")).toBe(
      true
    );
  });

  test("com produto, acrescenta o sku sem o plano-base", () => {
    expect(playSubscriptionsUrl("pro:mensal").endsWith("&sku=pro")).toBe(true);
  });
});

describe("trialDays", () => {
  test("converte dias e semanas", () => {
    expect(trialDays({ unit: "DAY", value: 3 })).toBe(3);
    expect(trialDays({ unit: "WEEK", value: 1 })).toBe(7);
  });

  test("unidade desconhecida: sem número", () => {
    expect(trialDays({ unit: "UNKNOWN", value: 1 })).toBeNull();
  });
});
