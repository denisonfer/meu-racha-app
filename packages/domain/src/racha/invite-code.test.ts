import { describe, expect, test } from "bun:test";
import { INVITE_CODE_LENGTH, normalizeInviteCode } from "./invite-code";

describe("normalizeInviteCode", () => {
  test("passa pra maiúscula", () => {
    expect(normalizeInviteCode("k7q2mz")).toBe("K7Q2MZ");
  });
  test("tira o que não é do alfabeto, inclusive o que vem colado", () => {
    expect(normalizeInviteCode("k7q-2mz")).toBe("K7Q2MZ");
    expect(normalizeInviteCode(" K7Q 2MZ ")).toBe("K7Q2MZ");
  });
  test("recusa I, O, 0 e 1, que o código nunca tem", () => {
    expect(normalizeInviteCode("IO01AB")).toBe("AB");
  });
  test("corta no tamanho do código", () => {
    expect(normalizeInviteCode("ABCDEFGH")).toHaveLength(INVITE_CODE_LENGTH);
  });
  test("vazio continua vazio", () => {
    expect(normalizeInviteCode("")).toBe("");
  });
});
