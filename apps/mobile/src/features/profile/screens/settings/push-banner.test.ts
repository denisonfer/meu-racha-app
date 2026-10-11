import { describe, expect, test } from "bun:test";
import { pushBanner } from "./push-banner";

describe("pushBanner", () => {
  test("ligada e concedida: sem aviso", () => {
    expect(pushBanner(true, { granted: true, canAskAgain: true })).toBeNull();
  });

  test("ligada e ainda pode perguntar: Permitir notificações", () => {
    expect(pushBanner(true, { granted: false, canAskAgain: true })).toBe(
      "unasked"
    );
  });

  test("ligada e negada sem poder perguntar: Abrir Ajustes", () => {
    expect(pushBanner(true, { granted: false, canAskAgain: false })).toBe(
      "denied"
    );
  });

  test("desligada ou sem leitura: nenhum aviso", () => {
    expect(
      pushBanner(false, { granted: false, canAskAgain: false })
    ).toBeNull();
    expect(
      pushBanner(undefined, { granted: false, canAskAgain: false })
    ).toBeNull();
    expect(pushBanner(true, null)).toBeNull();
  });
});
