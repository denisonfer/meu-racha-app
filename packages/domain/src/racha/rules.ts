export type TGameMode = "WINNER_STAYS" | "ROTATION" | "MAX_WINS";
export type TTieRule =
  "BOTH_OUT" | "BOTH_STAY" | "PENALTIES" | "CHALLENGER_WINS";
export type TTieReturnOrder = "RANDOM" | "TEAM_ORDER";

export type TRachaRules = {
  outfieldPerTeam: number;
  gameMode: TGameMode;
  maxConsecutiveWins: number; // só vale em MAX_WINS, mas fica guardado
  tieRule: TTieRule; // não vale em ROTATION, mas fica guardado
  tieReturnOrder: TTieReturnOrder; // só vale em BOTH_OUT
  considerPosition: boolean;
  matchDurationMin: number | null; // null = sem relógio
};

// faixas espelham os checks da tabela racha: o banco é quem garante
export const OUTFIELD_PER_TEAM_MIN = 3;
export const OUTFIELD_PER_TEAM_MAX = 10;
export const MAX_WINS_MIN = 2;
export const MAX_WINS_MAX = 10;
export const MATCH_DURATION_MIN = 1;
export const MATCH_DURATION_MAX = 90;
export const RACHA_NAME_MIN = 2;
export const RACHA_NAME_MAX = 40;
export const RACHA_NAME_PATTERN = /^\p{L}[\p{L}\d '.-]*$/u;

export const DEFAULT_RACHA_RULES: TRachaRules = {
  outfieldPerTeam: 5,
  gameMode: "WINNER_STAYS",
  maxConsecutiveWins: 2,
  tieRule: "BOTH_OUT",
  tieReturnOrder: "RANDOM",
  considerPosition: false,
  matchDurationMin: 10,
};

const TIE_RULE_LABEL: Record<TTieRule, string> = {
  BOTH_OUT: "Sai ambos",
  BOTH_STAY: "Fica ambos",
  PENALTIES: "Pênaltis",
  CHALLENGER_WINS: "Desafiante leva",
};

export function formatRulesSummary(rules: TRachaRules): string[] {
  const parts = [`${rules.outfieldPerTeam} na linha`];

  if (rules.gameMode === "WINNER_STAYS") parts.push("Rei da Quadra");
  if (rules.gameMode === "ROTATION") parts.push("Rotação");
  if (rules.gameMode === "MAX_WINS")
    parts.push(`Máx. ${rules.maxConsecutiveWins} vitórias`);

  if (rules.gameMode !== "ROTATION") parts.push(TIE_RULE_LABEL[rules.tieRule]);
  if (rules.considerPosition) parts.push("Posição no sorteio");
  parts.push(
    rules.matchDurationMin ? `${rules.matchDurationMin} min` : "sem relógio"
  );

  return parts;
}
