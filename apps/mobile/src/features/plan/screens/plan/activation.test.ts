import { describe, expect, test } from "bun:test";
import { ACTIVATION_TIMEOUT_MS, nextActivation } from "./activation";

const activating = { kind: "activating", elapsed: 0 } as const;

describe("nextActivation", () => {
  test("compra concluída: Ativando", () => {
    expect(nextActivation({ kind: "offer" }, { type: "purchased" })).toEqual(
      activating
    );
  });

  test("compra cancelada: volta à oferta, sem mensagem", () => {
    expect(nextActivation({ kind: "offer" }, { type: "cancelled" })).toEqual({
      kind: "offer",
    });
  });

  test("19999 ms sem confirmação: continua Ativando", () => {
    expect(
      nextActivation(activating, { type: "tick", elapsed: 19999 })
    ).toEqual({ kind: "activating", elapsed: 19999 });
  });

  test("20000 ms sem confirmação: Demorou", () => {
    expect(
      nextActivation(activating, {
        type: "tick",
        elapsed: ACTIVATION_TIMEOUT_MS,
      })
    ).toEqual({ kind: "slow" });
  });

  // a rede caiu depois da compra: a releitura nunca confirma, o tempo segue
  test("ticks de 2000 ms sem confirmação chegam a Demorou", () => {
    let state = nextActivation({ kind: "offer" }, { type: "purchased" });
    for (let i = 0; i < 10; i++)
      state = nextActivation(state, { type: "tick", elapsed: 2000 });
    expect(state).toEqual({ kind: "slow" });
  });

  test("Pro confirmado em Ativando ou em Demorou: estado", () => {
    expect(nextActivation(activating, { type: "plan_is_pro" })).toEqual({
      kind: "status",
    });
    expect(nextActivation({ kind: "slow" }, { type: "plan_is_pro" })).toEqual({
      kind: "status",
    });
  });

  test("Tentar de novo em Demorou: Ativando com o tempo zerado", () => {
    expect(nextActivation({ kind: "slow" }, { type: "retry" })).toEqual(
      activating
    );
  });

  test("tick fora de Ativando não muda nada", () => {
    expect(
      nextActivation({ kind: "slow" }, { type: "tick", elapsed: 2000 })
    ).toEqual({ kind: "slow" });
  });
});
