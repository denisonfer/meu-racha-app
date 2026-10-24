import { describe, expect, test } from "bun:test";
import {
  checkPixKeyInput,
  initialEventPixKey,
  isValidPixKeyHolder,
} from "./pix-key-input";

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

const free = (pixKey: string | null, pixKeyHolder: string | null = null) => ({
  isPaid: false,
  pixKey,
  pixKeyHolder,
});
const paid = (pixKey: string | null, pixKeyHolder: string | null = null) => ({
  isPaid: true,
  pixKey,
  pixKeyHolder,
});
const racha = { pixKey: "ana@x.com", pixKeyHolder: "Ana Paula" };

describe("initialEventPixKey", () => {
  test("Evento sem chave parte da chave e do titular do Racha", () => {
    expect(initialEventPixKey(undefined, racha)).toEqual({
      key: "ana@x.com",
      holder: "Ana Paula",
    });
    expect(initialEventPixKey(free(""), racha).key).toBe("ana@x.com");
  });

  test("a chave do Evento vence a do Racha, com o titular dela; sem nenhuma, vazio", () => {
    expect(initialEventPixKey(paid("bia@x.com", "Bia"), racha)).toEqual({
      key: "bia@x.com",
      holder: "Bia",
    });
    expect(initialEventPixKey(undefined, undefined)).toEqual({
      key: "",
      holder: "",
    });
    expect(
      initialEventPixKey(undefined, { pixKey: null, pixKeyHolder: null })
    ).toEqual({ key: "", holder: "" });
  });

  test("Evento grátis sem chave parte da chave do Racha", () => {
    expect(initialEventPixKey(free(null), racha)).toEqual({
      key: "ana@x.com",
      holder: "Ana Paula",
    });
  });

  test("Evento grátis com chave própria fica com ela e o titular dela", () => {
    expect(initialEventPixKey(free("bia@x.com", "Bia"), racha)).toEqual({
      key: "bia@x.com",
      holder: "Bia",
    });
  });

  test("Evento pago sem chave não repovoa com a do Racha, nem o titular", () => {
    expect(initialEventPixKey(paid(null), racha)).toEqual({
      key: "",
      holder: "",
    });
  });

  test("limpar o campo conta como mudança e envia vazio", () => {
    const initial = initialEventPixKey(undefined, racha);
    const cleared = checkPixKeyInput("");
    expect(cleared.isInvalid).toBe(false);
    expect(cleared.key !== initial.key).toBe(true);
    expect(cleared.key).toBe("");
  });
});

describe("isValidPixKeyHolder", () => {
  test("2 a 60 caracteres depois de aparar as pontas", () => {
    expect(isValidPixKeyHolder("Li")).toBe(true);
    expect(isValidPixKeyHolder("a".repeat(60))).toBe(true);
    expect(isValidPixKeyHolder("  Liandra  ")).toBe(true);
  });

  test("vazio, 1 caractere ou mais de 60 é inválido", () => {
    expect(isValidPixKeyHolder("")).toBe(false);
    expect(isValidPixKeyHolder("   ")).toBe(false);
    expect(isValidPixKeyHolder(" A ")).toBe(false);
    expect(isValidPixKeyHolder("a".repeat(61))).toBe(false);
  });

  test("conta caracteres como o banco, não unidades UTF-16", () => {
    expect(isValidPixKeyHolder("😀")).toBe(false);
    expect(isValidPixKeyHolder("😀".repeat(60))).toBe(true);
  });
});
