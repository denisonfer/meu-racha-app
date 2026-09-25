import { describe, expect, test } from "bun:test";
import { applyDateMask, dateMaskToISO } from "./date-mask";

describe("applyDateMask", () => {
  test("insere as barras conforme digita", () => {
    expect(applyDateMask("1")).toBe("1");
    expect(applyDateMask("15")).toBe("15");
    expect(applyDateMask("153")).toBe("15/3");
    expect(applyDateMask("1503")).toBe("15/03");
    expect(applyDateMask("15031991")).toBe("15/03/1991");
  });

  test("ignora o que não é dígito e corta o excesso", () => {
    expect(applyDateMask("15/03/1991")).toBe("15/03/1991");
    expect(applyDateMask("abc15")).toBe("15");
    expect(applyDateMask("150319911234")).toBe("15/03/1991");
  });

  test("apagar não trava na barra", () => {
    expect(applyDateMask("15/0")).toBe("15/0");
    expect(applyDateMask("15/")).toBe("15");
  });
});

describe("dateMaskToISO", () => {
  test("converte para o formato do banco", () => {
    expect(dateMaskToISO("15/03/1991")).toBe("1991-03-15");
  });

  test("incompleta devolve null", () => {
    expect(dateMaskToISO("15/03")).toBeNull();
    expect(dateMaskToISO("")).toBeNull();
  });
});
