export const ACTIVATION_POLL_MS = 2000;
export const ACTIVATION_TIMEOUT_MS = 20000;

export type TActivation =
  | { kind: "offer" }
  | { kind: "activating"; elapsed: number }
  | { kind: "slow" }
  | { kind: "status" };

export type TActivationEvent =
  | { type: "purchased" }
  | { type: "cancelled" }
  | { type: "tick"; elapsed: number }
  | { type: "plan_is_pro" }
  | { type: "retry" };

// O tempo anda pelos ticks, não pela resposta da rede: sem internet depois da
// compra, a tela ainda chega a "Demorou" e oferece Tentar de novo.
export function nextActivation(
  state: TActivation,
  event: TActivationEvent
): TActivation {
  switch (event.type) {
    case "purchased":
      return { kind: "activating", elapsed: 0 };
    case "cancelled":
      return state.kind === "offer" ? state : { kind: "offer" };
    case "tick": {
      if (state.kind !== "activating") return state;
      const elapsed = state.elapsed + event.elapsed;
      return elapsed >= ACTIVATION_TIMEOUT_MS
        ? { kind: "slow" }
        : { kind: "activating", elapsed };
    }
    case "plan_is_pro":
      return state.kind === "activating" || state.kind === "slow"
        ? { kind: "status" }
        : state;
    case "retry":
      return state.kind === "slow" ? { kind: "activating", elapsed: 0 } : state;
  }
}
