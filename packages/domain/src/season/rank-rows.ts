import type {
  TSeasonBestPlacing,
  TSeasonList,
  TSeasonPlacing,
  TSeasonRankItem,
  TSeasonRankRows,
} from "./types";

const LIST_TIEBREAK: Record<TSeasonList, number> = {
  goals: 0,
  assists: 1,
  wins: 2,
};

export function rankRows(
  items: TSeasonRankItem[],
  myId: string | null,
  limit = 10
): TSeasonRankRows {
  const sorted = items
    .filter((item) => item.value >= 1)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.name.localeCompare(b.name, "pt-BR");
    });

  // Empate divide a posição; o próximo pula para o ranking não inventar 4º
  // depois de dois 3ºs.
  let lastPosition = 0;
  let lastValue: number | null = null;
  const ranked = sorted.map((item, index) => {
    const position =
      lastValue !== null && item.value === lastValue ? lastPosition : index + 1;
    lastPosition = position;
    lastValue = item.value;
    return { ...item, position };
  });

  // O corte é o valor de quem ocupa o índice limit-1: empatados com o 10º
  // entram todos.
  const cutoffValue =
    ranked.length >= limit ? ranked[limit - 1]?.value : undefined;
  const included =
    cutoffValue === undefined
      ? ranked
      : ranked.filter((item) => item.value >= cutoffValue);

  const rows = included.map((item) => ({
    id: item.id,
    position: item.position,
    isMe: myId !== null && item.id === myId,
  }));

  const mine =
    myId === null ? undefined : ranked.find((item) => item.id === myId);
  const inRows = mine !== undefined && rows.some((row) => row.id === mine.id);
  const me =
    mine !== undefined && !inRows
      ? { position: mine.position, value: mine.value }
      : null;

  return { rows, me };
}

export function bestPlacing(
  placings: TSeasonPlacing[]
): TSeasonBestPlacing | null {
  let best: TSeasonBestPlacing | null = null;
  for (const placing of placings) {
    if (placing.position === null || placing.position > 10) continue;
    if (
      best === null ||
      placing.position < best.position ||
      (placing.position === best.position &&
        LIST_TIEBREAK[placing.list] < LIST_TIEBREAK[best.list])
    ) {
      best = { list: placing.list, position: placing.position };
    }
  }
  return best;
}
