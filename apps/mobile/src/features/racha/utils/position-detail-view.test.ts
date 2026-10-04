import { describe, expect, test } from "bun:test";
import { hasDetailChoice, positionDetailSlots } from "./position-detail-view";
import { positionDetailJoinLabel, ZONE_NAME } from "./racha-labels";

describe("positionDetailSlots", () => {
  test("uma linha por zona, com seletor só em DEF e MEI", () => {
    const slots = positionDetailSlots({
      playsAs: "OUTFIELD",
      primaryPosition: "DEFENDER",
      secondaryPosition: "FORWARD",
    });
    expect(slots.map((s) => s.slot)).toEqual(["primary", "secondary"]);
    expect(slots[0]?.label).toBe("Na defesa (principal)");
    expect(slots[0]?.accessibilityLabel).toBe("Na defesa, principal");
    expect(slots[0]?.options.map((o) => o.label)).toEqual([
      "Zagueiro",
      "Lateral",
    ]);
    expect(slots[1]?.options).toEqual([]);
    expect(slots[1]?.noChoiceText).toBe("Atacante. Não precisa escolher.");
    expect(hasDetailChoice(slots)).toBe(true);
  });

  test("Solicitação: zona em leitura e rótulo do seletor (U1)", () => {
    expect(ZONE_NAME.MIDFIELDER).toBe("Meio-campo");
    expect(positionDetailJoinLabel("MIDFIELDER")).toBe(
      "No meio-campo, você joga de"
    );
  });

  test("Goleiro e ATA/TODAS não têm o que escolher", () => {
    expect(
      positionDetailSlots({
        playsAs: "GOALKEEPER",
        primaryPosition: null,
        secondaryPosition: null,
      })
    ).toEqual([]);
    expect(
      hasDetailChoice(
        positionDetailSlots({
          playsAs: "OUTFIELD",
          primaryPosition: "ANY",
          secondaryPosition: null,
        })
      )
    ).toBe(false);
  });
});
