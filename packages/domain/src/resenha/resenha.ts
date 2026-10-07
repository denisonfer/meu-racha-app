import type {
  TResenhaCardsSummary,
  TResenhaCivilDate,
  TResenhaLeaders,
  TResenhaTopTeams,
} from "./types";

const WEEKDAYS_SHORT = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sáb",
] as const;
const WEEKDAYS_LONG = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

function civilUtcDay(startsOn: string): Date {
  const year = Number(startsOn.slice(0, 4));
  const month = Number(startsOn.slice(5, 7));
  const day = Number(startsOn.slice(8, 10));
  // Date.UTC: o dia da semana não segue o fuso do aparelho
  return new Date(Date.UTC(year, month - 1, day));
}

export function leaders(
  stats: { name: string; value: number }[]
): TResenhaLeaders | null {
  const scored = stats.filter((item) => item.value > 0);
  if (scored.length === 0) return null;
  const count = Math.max(...scored.map((item) => item.value));
  const names = scored
    .filter((item) => item.value === count)
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { names, count };
}

export function namesLine(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} e ${names[2]}`;
  const extra = names.length - 3;
  return `${names[0]}, ${names[1]}, ${names[2]} +${extra}`;
}

export function topTeams(
  teams: { teamNumber: number; wins: number }[]
): TResenhaTopTeams | null {
  if (teams.length === 0) return null;
  const wins = Math.max(...teams.map((team) => team.wins));
  if (wins <= 0) return null;
  const teamNumbers = teams
    .filter((team) => team.wins === wins)
    .map((team) => team.teamNumber)
    .sort((a, b) => a - b);
  return { teamNumbers, wins };
}

export function cardsSummary(
  cards: { color: "yellow" | "red"; name: string }[]
): TResenhaCardsSummary {
  const redNames: string[] = [];
  let yellow = 0;
  let red = 0;
  for (const card of cards) {
    if (card.color === "yellow") {
      yellow += 1;
    } else {
      red += 1;
      redNames.push(card.name);
    }
  }
  return { yellow, red, redNames };
}

export function formatResenhaCivilDate(startsOn: string): TResenhaCivilDate {
  const date = civilUtcDay(startsOn);
  const weekdayIndex = date.getUTCDay();
  const weekdayShort = WEEKDAYS_SHORT[weekdayIndex] ?? "dom";
  const weekdayLong = WEEKDAYS_LONG[weekdayIndex] ?? "Domingo";
  const day = startsOn.slice(8, 10);
  const month = startsOn.slice(5, 7);
  return {
    weekdayShort,
    weekdayLong,
    weekdayShortUpper: weekdayShort.toUpperCase(),
    dayMonth: `${day}/${month}`,
  };
}
