import type {
  TMatchCard,
  TMatchCardColor,
  TMatchCardRedReason,
  TYellowCardMode,
} from "./types";

/**
 * Segundos de relógio da Partida que o amarelo tira de campo, do Evento.
 * Em Advertência (mark) é 0: o amarelo nunca corre. A pausa já sai em matchElapsedSeconds.
 */
export function yellowOutSeconds(
  mode: TYellowCardMode,
  outMin: number
): number {
  return mode === "timed" ? outMin * 60 : 0;
}

export type TCardOutcome = {
  color: TMatchCardColor;
  reason: TMatchCardRedReason | null;
};

/**
 * O app só prevê a consequência. Quem grava é o banco: amarelo escolhido com
 * outro amarelo desta pessoa nesta Partida (mesmo já cumprido) vira vermelho.
 */
export function cardOutcome(
  existing: readonly TMatchCard[],
  personId: string,
  chosen: TMatchCardColor
): TCardOutcome {
  if (chosen === "red") return { color: "red", reason: "direct" };
  const hasYellow = existing.some(
    (card) => card.person.personId === personId && card.color === "yellow"
  );
  if (hasYellow) return { color: "red", reason: "secondYellow" };
  return { color: "yellow", reason: null };
}

/** Resto do amarelo. matchSeconds é o elapsed já sem pausa — esta função não desconta de novo. */
export function yellowRemaining(
  card: { matchSecond: number },
  matchSeconds: number,
  outSeconds: number
): number {
  return Math.max(0, card.matchSecond + outSeconds - matchSeconds);
}

/** Amarelos ainda correndo, o que volta primeiro na frente. Empate de tempo desempata pelo id. */
export function runningYellows(
  cards: readonly TMatchCard[],
  matchSeconds: number,
  outSeconds: number
): TMatchCard[] {
  return cards
    .filter(
      (card) =>
        card.color === "yellow" &&
        yellowRemaining(card, matchSeconds, outSeconds) > 0
    )
    .slice()
    .sort((a, b) => {
      const byTime =
        yellowRemaining(a, matchSeconds, outSeconds) -
        yellowRemaining(b, matchSeconds, outSeconds);
      if (byTime !== 0) return byTime;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
}

export function isExpelled(
  cards: readonly TMatchCard[],
  personId: string
): boolean {
  return cards.some(
    (card) => card.person.personId === personId && card.color === "red"
  );
}
