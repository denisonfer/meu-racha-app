import { describe, expect, test } from "bun:test";
import { requestResolved, tabBadgeA11y } from "./notification-messages";

describe("tabBadgeA11y", () => {
  test("1 aviso, vários avisos e mais de 9", () => {
    expect(tabBadgeA11y("Avisos", 1)).toBe("Avisos, 1 aviso novo");
    expect(tabBadgeA11y("Avisos", 3)).toBe("Avisos, 3 avisos novos");
    expect(tabBadgeA11y("Avisos", 10)).toBe("Avisos, mais de 9 avisos novos");
  });
});

describe("requestResolved", () => {
  test("aprovado ou recusado por você ou por outra pessoa", () => {
    expect(requestResolved(true, "Ana", true)).toBe("Aprovado por você");
    expect(requestResolved(false, "Bruno C.", false)).toBe(
      "Recusado por Bruno C."
    );
    expect(requestResolved(true, "Ana", false)).toBe("Aprovado por Ana");
  });
});
