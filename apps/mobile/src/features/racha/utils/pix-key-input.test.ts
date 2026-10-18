import { describe, expect, test } from "bun:test";
import { checkPixKeyInput, initialEventPixKey } from "./pix-key-input";

describe("checkPixKeyInput", () => {
  test("campo vazio ou só espaços limpa a chave sem erro", () => {
    expect(checkPixKeyInput("")).toEqual({
      key: "",
      type: null,
      isInvalid: false,
    });
    expect(checkPixKeyInput("   ").isInvalid).toBe(false);
  });

  test("normaliza máscara e maiúsculas", () => {
    expect(checkPixKeyInput("  (11) 99999-9999 ")).toEqual({
      key: "+5511999999999",
      type: "phone",
      isInvalid: false,
    });
    expect(checkPixKeyInput("ANA@X.COM").key).toBe("ana@x.com");
  });

  test("texto que não é chave é inválido", () => {
    expect(checkPixKeyInput("abc")).toEqual({
      key: "",
      type: null,
      isInvalid: true,
    });
  });
});

const free = (pixKey: string | null) => ({ isPaid: false, pixKey });
const paid = (pixKey: string | null) => ({ isPaid: true, pixKey });

describe("initialEventPixKey", () => {
  test("Evento sem chave parte da chave do Racha", () => {
    expect(initialEventPixKey(undefined, "ana@x.com")).toBe("ana@x.com");
    expect(initialEventPixKey(free(""), "ana@x.com")).toBe("ana@x.com");
  });

  test("a chave do Evento vence a do Racha; sem nenhuma, vazio", () => {
    expect(initialEventPixKey(paid("bia@x.com"), "ana@x.com")).toBe(
      "bia@x.com"
    );
    expect(initialEventPixKey(undefined, null)).toBe("");
  });

  test("Evento grátis sem chave parte da chave do Racha", () => {
    expect(initialEventPixKey(free(null), "ana@x.com")).toBe("ana@x.com");
  });

  test("Evento pago sem chave não repovoa com a do Racha", () => {
    expect(initialEventPixKey(paid(null), "ana@x.com")).toBe("");
  });

  test("limpar o campo conta como mudança e envia vazio", () => {
    const initial = initialEventPixKey(undefined, "ana@x.com");
    const cleared = checkPixKeyInput("");
    expect(cleared.isInvalid).toBe(false);
    expect(cleared.key !== initial).toBe(true);
    expect(cleared.key).toBe("");
  });
});
