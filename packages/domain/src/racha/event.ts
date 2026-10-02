import { PLACE_MAX } from "./rules";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

// o Racha aceita "A definir"; o evento não — espelha event_place_text
const UNDEFINED_PLACE = "A definir";

export function isEventPlaceAllowed(place: string): boolean {
  const trimmed = place.trim();
  return (
    trimmed.length >= 1 &&
    trimmed.length <= PLACE_MAX &&
    trimmed !== UNDEFINED_PLACE
  );
}

export function isCivilDateBefore(date: string, today: string): boolean {
  return date < today;
}

// Strings civis normalizadas com o mesmo fuso preservam a ordem cronológica.
export function isEventStartNotFuture(
  startsOn: string,
  hour: number,
  minute: number,
  nowCivil: string
): boolean {
  const startsAt = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  return `${startsOn}T${startsAt}` <= nowCivil;
}

export function formatEventWhen(startsOn: string, startsAt: string): string {
  const year = Number(startsOn.slice(0, 4));
  const month = Number(startsOn.slice(5, 7));
  const day = Number(startsOn.slice(8, 10));
  // Date.UTC: o dia da semana não segue o fuso do aparelho
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const weekday = WEEKDAYS[weekdayIndex] ?? "Dom";
  const monthLabel = MONTHS[month - 1] ?? "jan";
  const hour = (startsAt.split(":")[0] ?? "").padStart(2, "0");
  const minute = (startsAt.split(":")[1] ?? "").padStart(2, "0");
  return `${weekday}, ${day} ${monthLabel} · ${hour}:${minute}`;
}
