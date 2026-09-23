/**
 * Placar de uma Partida — regra pura.
 *
 * Nomes seguem meu-racha-docs/docs/spec/nomenclatura.md:
 * Partida = Match, Gol = Goal, gol contra = ownGoal.
 *
 * Este arquivo não conhece React, Supabase, rede nem relógio.
 */

export type Goal = {
  /** Idempotency key da ação que criou o Gol. */
  id: string;
  /** Time que recebe o ponto. Em gol contra, é o adversário de quem chutou. */
  teamId: string;
  /** Autor do Gol. `null` em gol contra: o placar sobe, ninguém é creditado. */
  scorerId: string | null;
  assistById: string | null;
};

export type LiveMatch = {
  id: string;
  /** Número de sequência do servidor: só cresce, nunca volta. */
  seq: number;
  homeTeamId: string;
  awayTeamId: string;
  goals: Goal[];
};

export type Score = { home: number; away: number };

export function score(match: LiveMatch): Score {
  let home = 0;
  let away = 0;
  for (const goal of match.goals) {
    if (goal.teamId === match.homeTeamId) home += 1;
    else away += 1;
  }
  return { home, away };
}

/**
 * Aplica um Gol ao estado da Partida.
 *
 * Idempotente de propósito: o mesmo `goal.id` aplicado duas vezes não duplica.
 * É o que permite usar a mesma função no palpite otimista de quem registrou
 * e na chegada do broadcast, sem contar o Gol duas vezes.
 */
export function applyGoal(match: LiveMatch, goal: Goal, seq: number): LiveMatch {
  if (match.goals.some((g) => g.id === goal.id)) return match;
  return { ...match, seq, goals: [...match.goals, goal] };
}
