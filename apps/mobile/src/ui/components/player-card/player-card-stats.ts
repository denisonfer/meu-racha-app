export type TCardStat = { label: string; value: number };

export const lineStats = (s: {
  wins: number;
  goals: number;
  assists: number;
  games: number;
}): TCardStat[] => [
  { label: "VITÓRIAS", value: s.wins },
  { label: "GOLS", value: s.goals },
  { label: "ASSIST.", value: s.assists },
  { label: "PARTIDAS", value: s.games },
];

// Gols de goleiro ficam fora do Overall e só aparecem se houver (glossário, Card)
export const keeperStats = (s: {
  wins: number;
  cleanSheets: number;
  goals: number;
  games: number;
}): TCardStat[] => [
  { label: "VITÓRIAS", value: s.wins },
  { label: "SEM SOFRER", value: s.cleanSheets },
  ...(s.goals > 0 ? [{ label: "GOLS", value: s.goals }] : []),
  { label: "PARTIDAS", value: s.games },
];
