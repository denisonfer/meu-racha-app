import type { TMatchClockInput } from "./types";

/**
 * Segundos já jogados: agora menos o início, menos as pausas encerradas, e
 * sem contar a pausa corrente (pausedAt até agora).
 */
export function matchElapsedSeconds(
  clock: TMatchClockInput,
  nowMs: number
): number {
  if (clock.startedAt == null) return 0;
  const startMs = Date.parse(clock.startedAt);
  if (!Number.isFinite(startMs)) return 0;

  const pausedMs = clock.pausedAt == null ? null : Date.parse(clock.pausedAt);
  const endMs =
    pausedMs != null && Number.isFinite(pausedMs) ? pausedMs : nowMs;
  const pausedSeconds = clock.pausedSeconds ?? 0;
  const raw = (endMs - startMs) / 1000 - pausedSeconds;
  return Math.max(0, Math.floor(raw));
}

/**
 * No acréscimo o principal para no limite; sem Duração não há acréscimo.
 */
export function splitOvertime(
  elapsed: number,
  durationMin: number | null
): { main: number; overtime: number | null } {
  if (durationMin == null) return { main: elapsed, overtime: null };
  const limit = durationMin * 60;
  if (elapsed <= limit) return { main: elapsed, overtime: null };
  return { main: limit, overtime: elapsed - limit };
}

/** Distância do relógio do aparelho para o do servidor: positivo = aparelho atrasado. */
export function serverOffsetMs(
  serverNow: string,
  receivedAtMs: number
): number {
  const serverMs = Date.parse(serverNow);
  if (!Number.isFinite(serverMs)) return 0;
  return serverMs - receivedAtMs;
}
