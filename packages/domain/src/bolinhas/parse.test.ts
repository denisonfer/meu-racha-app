import { describe, expect, test } from "bun:test";
import { PUBLISHED } from "../sorteio/parse.fixtures";
import { SORT_PAYLOAD_INVALID } from "../sorteio/parse";
import { parseDrawnBolinhas } from "./parse";

const photo = (path: string | null) => (path ? `https://x/${path}` : null);

const person = (id: string, name: string, color: "blue" | "red") => ({
  kind: "member",
  person_id: id,
  profile_id: id,
  guest_id: null,
  display_name: name,
  avatar_path: null,
  color,
});

const DRAWN = {
  bolinhas_id: "b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0",
  all_move: false,
  order: [
    person("11111111-1111-1111-1111-111111111111", "Darlaniel", "blue"),
    person("22222222-2222-2222-2222-222222222222", "Samuel", "red"),
    {
      ...person("33333333-3333-3333-3333-333333333333", "Avulso", "red"),
      kind: "guest",
      profile_id: null,
      guest_id: "33333333-3333-3333-3333-333333333333",
    },
  ],
  published: PUBLISHED,
};

describe("parseDrawnBolinhas", () => {
  test("mantém a ordem da animação e a cor de cada um", () => {
    const drawn = parseDrawnBolinhas(DRAWN, photo);
    expect(drawn.allMove).toBe(false);
    expect(drawn.order.map((p) => [p.displayName, p.color])).toEqual([
      ["Darlaniel", "blue"],
      ["Samuel", "red"],
      ["Avulso", "red"],
    ]);
    expect(drawn.order[0]).toMatchObject({
      personId: "11111111-1111-1111-1111-111111111111",
      profileId: "11111111-1111-1111-1111-111111111111",
      kind: "member",
    });
    expect(drawn.order[2]).toMatchObject({ kind: "guest", profileId: null });
  });

  test("traz o retrato novo dos Times", () => {
    const drawn = parseDrawnBolinhas(DRAWN, photo);
    expect(drawn.published.teams.length).toBe(2);
    expect(drawn.published.bolinhasAvailability).toBe("ok");
  });

  test("rejeita cor desconhecida", () => {
    const bad = {
      ...DRAWN,
      order: [{ ...person("1", "X", "blue"), color: "green" }],
    };
    expect(() => parseDrawnBolinhas(bad, photo)).toThrow(SORT_PAYLOAD_INVALID);
  });

  test("rejeita retorno sem order", () => {
    const { order: _order, ...rest } = DRAWN;
    expect(() => parseDrawnBolinhas(rest, photo)).toThrow(SORT_PAYLOAD_INVALID);
  });

  test("rejeita published sem Sorteio confirmado", () => {
    const bad = { ...DRAWN, published: { state: "none" } };
    expect(() => parseDrawnBolinhas(bad, photo)).toThrow(SORT_PAYLOAD_INVALID);
  });
});
