import { describe, expect, test } from "bun:test";
import { signUpSchema, stepFields } from "./sign-up-schema";

const PHOTO = {
  uri: "file:///avatar.jpg",
  mimeType: "image/jpeg" as const,
  width: 512,
  height: 512,
};

const valid = {
  displayName: "Denison",
  email: "denison@example.com",
  password: "senha-forte",
  playsAs: "GOALKEEPER" as const,
  primaryPosition: null,
  secondaryPosition: null,
  photo: PHOTO,
  birthDate: "01/01/1991",
  acceptedTerms: true,
};

describe("foto no Cadastro", () => {
  test("a foto é validada no passo Sobre você", () => {
    expect(stepFields[1]).toContain("photo");
  });

  test("sem foto, recusa com a mensagem na foto", () => {
    const result = signUpSchema.safeParse({ ...valid, photo: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["photo"],
        message: "Adicione uma foto para o pessoal do racha te reconhecer",
      }),
    ]);
  });

  test("com foto, aceita", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });
});
