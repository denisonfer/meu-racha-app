import { CARD_PAYLOAD_INVALID, parseCardStats } from "../card";
import type { TPlaysAs, TPosition } from "../profile";
import type { TPhotoResolver } from "../sorteio/parse";
import type { TMatchPerson } from "../match/types";
import type {
  TResenha,
  TResenhaCard,
  TResenhaCardColor,
  TResenhaPersonStats,
  TResenhaScorerCard,
  TResenhaSummary,
  TResenhaTeam,
} from "./types";

// As RPCs da Resenha devolvem jsonb: o tipo gerado só diz Json. Formato
// inesperado vira erro de código, não um retrato pela metade.
export const RESENHA_PAYLOAD_INVALID = "resenha_payload_invalid";

type TObject = Record<string, unknown>;

const invalid = () => new Error(RESENHA_PAYLOAD_INVALID);

function obj(value: unknown): TObject {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as TObject;
  }
  throw invalid();
}

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw invalid();
}

function str(value: unknown): string {
  if (typeof value === "string") return value;
  throw invalid();
}

function strOrNull(value: unknown): string | null {
  return value == null ? null : str(value);
}

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw invalid();
}

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw invalid();
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  const text = str(value);
  const found = allowed.find((item) => item === text);
  if (found === undefined) throw invalid();
  return found;
}

const KINDS = ["member", "guest"] as const;
const CARD_COLORS = [
  "yellow",
  "red",
] as const satisfies readonly TResenhaCardColor[];
const PLAYS_AS = [
  "OUTFIELD",
  "GOALKEEPER",
] as const satisfies readonly TPlaysAs[];
const POSITIONS = [
  "ANY",
  "DEFENDER",
  "MIDFIELDER",
  "FORWARD",
] as const satisfies readonly TPosition[];

function person(value: unknown, photo: TPhotoResolver): TMatchPerson {
  const raw = obj(value);
  return {
    kind: oneOf(raw.kind, KINDS),
    personId: str(raw.person_id),
    profileId: strOrNull(raw.profile_id),
    guestId: strOrNull(raw.guest_id),
    displayName: str(raw.display_name),
    photoUrl: photo(strOrNull(raw.avatar_path)),
  };
}

function peopleRow(value: unknown, photo: TPhotoResolver): TResenhaPersonStats {
  const raw = obj(value);
  return {
    person: person(raw.person, photo),
    goals: num(raw.goals),
    assists: num(raw.assists),
    wins: num(raw.wins),
  };
}

function teamRow(value: unknown): TResenhaTeam {
  const raw = obj(value);
  return {
    teamNumber: num(raw.team_number),
    wins: num(raw.wins),
  };
}

function cardRow(value: unknown, photo: TPhotoResolver): TResenhaCard {
  const raw = obj(value);
  return {
    person: person(raw.person, photo),
    color: oneOf(raw.color, CARD_COLORS),
    matchNumber: num(raw.match_number),
  };
}

function scorerCard(
  value: unknown,
  photo: TPhotoResolver
): TResenhaScorerCard | null {
  if (value == null) return null;
  const raw = obj(value);
  // A carta do artilheiro usa o mesmo JSON da carta do Racha, sem profile_id.
  // Erro de carta vira erro da Resenha: uma RPC, um código.
  let stats;
  try {
    stats = parseCardStats(raw);
  } catch (error) {
    if (error instanceof Error && error.message === CARD_PAYLOAD_INVALID) {
      throw invalid();
    }
    throw error;
  }
  return {
    displayName: str(raw.display_name),
    photoUrl: photo(strOrNull(raw.avatar_path)),
    isSuperStar: bool(raw.is_super_star),
    ...stats,
    // O cartaz já trazia Onde joga e posição. Ficam por cima da carta
    // para a sigla do artilheiro não depender só do corpo novo.
    playsAs: oneOf(raw.plays_as, PLAYS_AS),
    primaryPosition:
      raw.primary_position == null
        ? null
        : oneOf(raw.primary_position, POSITIONS),
  };
}

/** Retorno de get_event_resenha. */
export function parseEventResenha(
  json: unknown,
  photo: TPhotoResolver
): TResenha {
  const raw = obj(json);
  return {
    startsOn: str(raw.starts_on),
    place: str(raw.place),
    rachaName: str(raw.racha_name),
    matchCount: num(raw.match_count),
    people: list(raw.people).map((item) => peopleRow(item, photo)),
    teams: list(raw.teams).map(teamRow),
    cards: list(raw.cards).map((item) => cardRow(item, photo)),
    scorerCard: scorerCard(raw.scorer_card, photo),
  };
}

/** Retorno de get_racha_last_resenha. SQL null → null. */
export function parseRachaLastResenha(
  json: unknown,
  _photo?: TPhotoResolver
): TResenhaSummary | null {
  if (json == null) return null;
  const raw = obj(json);
  return {
    eventId: str(raw.event_id),
    startsOn: str(raw.starts_on),
    matchCount: num(raw.match_count),
    scorers: list(raw.scorers).map(str),
    topGoals: num(raw.top_goals),
  };
}
