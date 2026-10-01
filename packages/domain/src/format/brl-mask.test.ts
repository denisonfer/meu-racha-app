import { describe, expect, test } from "bun:test";
import { applyBrlMask } from "./brl-mask";

describe("applyBrlMask", () => {
  test("mostra real com ponto de milhar, sem centavos", () => {
    expect(applyBrlMask("1")).toBe("R$ 1");
    expect(applyBrlMask("25")).toBe("R$ 25");
    expect(applyBrlMask("999")).toBe("R$ 999");
    expect(applyBrlMask("1000")).toBe("R$ 1.000");
    expect(applyBrlMask("9999")).toBe("R$ 9.999");
  });

  test("aceita o próprio texto mascarado e ignora o que não é dígito", () => {
    expect(applyBrlMask("R$ 1.000")).toBe("R$ 1.000");
    expect(applyBrlMask("abc25")).toBe("R$ 25");
  });

  test("zero fica visível e zeros à esquerda somem", () => {
    expect(applyBrlMask("0")).toBe("R$ 0");
    expect(applyBrlMask("00025")).toBe("R$ 25");
  });

  test("vazio continua vazio e o excesso corta em cinco dígitos", () => {
    expect(applyBrlMask("")).toBe("");
    expect(applyBrlMask("R$ ")).toBe("");
    expect(applyBrlMask("123456")).toBe("R$ 12.345");
  });
});
