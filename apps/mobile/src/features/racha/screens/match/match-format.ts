import type { TMatchGoal } from "@meu-racha/domain";
import { sortTeamTitle } from "../../utils/racha-messages";

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatOvertime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `+${minutes}:${String(rest).padStart(2, "0")}`;
}

function spokenMinutes(minutes: number): string {
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

function spokenSeconds(seconds: number): string {
  return seconds === 1 ? "1 segundo" : `${seconds} segundos`;
}

export function spokenClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return spokenSeconds(seconds);
  if (seconds === 0) return spokenMinutes(minutes);
  return `${spokenMinutes(minutes)} e ${spokenSeconds(seconds)}`;
}

export function spokenMatchClock(input: {
  main: number;
  overtime: number | null;
  isPaused: boolean;
  durationMin: number | null;
}): string {
  const parts = [spokenClock(input.main)];
  if (input.overtime != null) {
    parts.push(`acréscimo ${spokenClock(input.overtime)}`);
  } else if (input.durationMin != null) {
    parts.push(`duração ${spokenMinutes(input.durationMin)}`);
  }
  if (input.isPaused) parts.push("pausado");
  return parts.join(". ");
}

/** Texto lido pelo leitor de tela: o ícone da bola e da chuteira não carrega sentido sozinho. */
export function goalLine(goal: TMatchGoal): string {
  const team = sortTeamTitle(goal.teamNumber);
  if (goal.isOwnGoal) return `Gol contra · ${team}`;
  const scorer = goal.scorer?.displayName ?? "Gol";
  const assist = goal.assist ? ` (${goal.assist.displayName})` : "";
  return `${scorer}${assist} · ${team}`;
}

/** Linhas da lista: autor com o Time e, em baixo, a assistência (quando houver). */
export function goalParts(goal: TMatchGoal): {
  scorer: string;
  assist: string | null;
} {
  const team = sortTeamTitle(goal.teamNumber);
  return {
    scorer: goal.isOwnGoal
      ? `Gol contra · ${team}`
      : `${goal.scorer?.displayName ?? "Gol"} · ${team}`,
    assist: goal.assist?.displayName ?? null,
  };
}
