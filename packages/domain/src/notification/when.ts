import { formatResenhaCivilDate } from "../resenha/resenha";
import type { TDayGroup } from "./types";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

// O dia civil do Aviso é o de Brasília, não o do processo — em CI o TZ é
// UTC e a meia-noite cairia no dia errado. Intl.DateTimeFormat timeZone
// está no lib esnext do TypeScript deste pacote. en-US só para o mês e o
// dia saírem em algarismo latino, não no nome do mês.
const SAO_PAULO_CIVIL = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function civilDate(instant: Date): string {
  if (Number.isNaN(instant.getTime())) {
    throw new Error("notification_timezone_unavailable");
  }
  const parts = SAO_PAULO_CIVIL.formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("notification_timezone_unavailable");
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// A string já é data civil. Date.UTC, como em formatResenhaCivilDate, para
// o calendário não seguir o fuso do aparelho.
function shiftCivilDate(isoDate: string, days: number): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mondayOf(isoDate: string): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  // getUTCDay 0 é domingo: seis dias depois da segunda desta semana.
  const sinceMonday = (weekday + 6) % 7;
  return shiftCivilDate(isoDate, -sinceMonday);
}

function civilPhrase(isoDate: string): string {
  const formatted = formatResenhaCivilDate(isoDate);
  return `${formatted.weekdayShort} ${formatted.dayMonth}`;
}

// Até 59 min vale o relógio, mesmo atravessando a meia-noite. A partir de
// uma hora o dia civil em Brasília escolhe "há N h", "ontem" ou a data.
export function relativeWhen(createdAt: string, now: Date): string {
  const elapsed = now.getTime() - new Date(createdAt).getTime();
  if (elapsed < MINUTE_MS) return "agora";
  if (elapsed < HOUR_MS) {
    const minutes = Math.max(1, Math.floor(elapsed / MINUTE_MS));
    return `há ${minutes} min`;
  }

  const created = civilDate(new Date(createdAt));
  const today = civilDate(now);
  if (created === today) {
    const hours = Math.max(1, Math.floor(elapsed / HOUR_MS));
    return `há ${hours} h`;
  }
  if (created === shiftCivilDate(today, -1)) return "ontem";
  return civilPhrase(created);
}

// Semana de segunda 00:00 a domingo, em Brasília. "Esta semana" é esse
// intervalo sem hoje e sem ontem.
export function dayGroup(createdAt: string, now: Date): TDayGroup {
  const created = civilDate(new Date(createdAt));
  const today = civilDate(now);
  if (created === today) return "today";
  if (created === shiftCivilDate(today, -1)) return "yesterday";

  const monday = mondayOf(today);
  const sunday = shiftCivilDate(monday, 6);
  if (created >= monday && created <= sunday) return "thisWeek";
  return "earlier";
}
