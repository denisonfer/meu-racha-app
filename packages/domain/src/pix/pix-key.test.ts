import { describe, expect, test } from "bun:test";
import { maskPixKey, normalizePixKey, pixKeyTypeLabel } from "./pix-key";

describe("normalizePixKey", () => {
  test("CPF com ou sem máscara vira só dígitos; dígito verificador errado é inválido", () => {
    expect(normalizePixKey("529.982.247-25")).toEqual({
      key: "52998224725",
      type: "cpf",
    });
    expect(normalizePixKey("52998224725")).toEqual({
      key: "52998224725",
      type: "cpf",
    });
    expect(normalizePixKey("529.982.247-24")).toBeNull();
  });

  test("CNPJ vira só dígitos", () => {
    expect(normalizePixKey("11.222.333/0001-81")).toEqual({
      key: "11222333000181",
      type: "cnpj",
    });
    expect(normalizePixKey("11.222.333/0001-82")).toBeNull();
  });

  test("e-mail: espaços e maiúsculas somem; passa de 77 caracteres é inválido", () => {
    expect(normalizePixKey(" ANA@X.COM ")).toEqual({
      key: "ana@x.com",
      type: "email",
    });
    const long = `${"a".repeat(78 - "@x.com".length)}@x.com`;
    expect(long).toHaveLength(78);
    expect(normalizePixKey(long)).toBeNull();
    expect(
      normalizePixKey(`${"a".repeat(77 - "@x.com".length)}@x.com`)
    ).not.toBeNull();
    expect(normalizePixKey("joão@x.com")).toBeNull();
    expect(normalizePixKey("sem-arroba.com")).toBeNull();
    expect(normalizePixKey("a@b")).toBeNull();
  });

  test("celular com máscara, só DDD+número ou com +55 vira +55DDDNÚMERO", () => {
    const expected = { key: "+5511999999999", type: "phone" as const };
    expect(normalizePixKey("(11) 99999-9999")).toEqual(expected);
    expect(normalizePixKey("  (11) 99999-9999 ")).toEqual(expected);
    expect(normalizePixKey("11999999999")).toEqual(expected);
    expect(normalizePixKey("+5511999999999")).toEqual(expected);
    expect(normalizePixKey("+55 (11) 99999-9999")).toEqual(expected);
  });

  test("fixo e telefone incompleto são inválidos", () => {
    expect(normalizePixKey("1199999999")).toBeNull();
    expect(normalizePixKey("(11) 3333-4444")).toBeNull();
    expect(normalizePixKey("+551133334444")).toBeNull();
    expect(normalizePixKey("+5511999")).toBeNull();
  });

  test("11 dígitos que são CPF válido, sem +55 nem máscara de telefone, são CPF", () => {
    // 11900000083 é CPF válido e também tem forma de celular (DDD 11, nono dígito 9).
    // Sem +55 nem máscara de telefone a leitura mais provável é CPF; o app mostra o tipo detectado.
    expect(normalizePixKey("11900000083")).toEqual({
      key: "11900000083",
      type: "cpf",
    });
    // Com máscara de telefone ou +55 é celular.
    expect(normalizePixKey("(11) 90000-0083")).toEqual({
      key: "+5511900000083",
      type: "phone",
    });
    expect(normalizePixKey("+5511900000083")).toEqual({
      key: "+5511900000083",
      type: "phone",
    });
  });

  test("chave aleatória (UUID) vira minúsculas", () => {
    expect(normalizePixKey("123E4567-E89B-42D3-A456-426614174000")).toEqual({
      key: "123e4567-e89b-42d3-a456-426614174000",
      type: "random",
    });
    expect(normalizePixKey("123e4567-e89b-12d3-a456-426614174000")).toBeNull();
  });

  test("vazio e lixo são inválidos", () => {
    expect(normalizePixKey("")).toBeNull();
    expect(normalizePixKey("   ")).toBeNull();
    expect(normalizePixKey("abc")).toBeNull();
  });
});

describe("maskPixKey", () => {
  test("e-mail mostra 2 caracteres e o domínio", () => {
    expect(maskPixKey("ana.paula@email.com", "email")).toBe("an•••@email.com");
  });
  test("celular", () => {
    expect(maskPixKey("+5511999991234", "phone")).toBe("(••) •••••-1234");
  });
  test("CPF e CNPJ", () => {
    expect(maskPixKey("52998224725", "cpf")).toBe("•••.982.247-••");
    expect(maskPixKey("11222333000181", "cnpj")).toBe("••.222.333/0001-••");
  });
  test("aleatória mostra 4 primeiros e 4 últimos", () => {
    expect(maskPixKey("123e4567-e89b-42d3-a456-426614174000", "random")).toBe(
      "123e•••4000"
    );
  });
});

describe("pixKeyTypeLabel", () => {
  test("rótulos", () => {
    expect(pixKeyTypeLabel("cpf")).toBe("CPF");
    expect(pixKeyTypeLabel("cnpj")).toBe("CNPJ");
    expect(pixKeyTypeLabel("email")).toBe("e-mail");
    expect(pixKeyTypeLabel("phone")).toBe("celular");
    expect(pixKeyTypeLabel("random")).toBe("aleatória");
  });
});
