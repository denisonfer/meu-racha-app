import type { TPhotoResolver } from "../sorteio/parse";
import type {
  TSeasonEvent,
  TSeasonRanking,
  TSeasonRankingMember,
} from "./types";

// As RPCs da Temporada devolvem jsonb: o tipo gerado só diz Json. Formato
// inesperado vira erro de código, não um ranking pela metade.
export const SEASON_PAYLOAD_INVALID = "season_payload_invalid";

type TObject = Record<string, unknown>;

const invalid = () => new Error(SEASON_PAYLOAD_INVALID);

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

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw invalid();
}

// O banco manda inteiro. 1.5 não é gol, Overall nem ano da Temporada.
function int(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  throw invalid();
}

function member(value: unknown, photo: TPhotoResolver): TSeasonRankingMember {
  const raw = obj(value);
  return {
    profileId: str(raw.profile_id),
    displayName: str(raw.display_name),
    photoUrl: photo(strOrNull(raw.avatar_path)),
    isActive: bool(raw.is_active),
    overall: int(raw.overall),
    goals: int(raw.goals),
    assists: int(raw.assists),
    wins: int(raw.wins),
    isBlocked: bool(raw.is_blocked),
  };
}

// scorers_blocked só vem quando quem chama bloqueou um dos artilheiros.
function scorersBlocked(raw: TObject, scorers: string[]): boolean[] {
  if (raw.scorers_blocked == null) return scorers.map(() => false);
  const flags = list(raw.scorers_blocked).map(bool);
  if (flags.length !== scorers.length) throw invalid();
  return flags;
}

function eventRow(value: unknown): TSeasonEvent {
  const raw = obj(value);
  const scorers = list(raw.scorers).map(str);
  return {
    eventId: str(raw.event_id),
    startsOn: str(raw.starts_on),
    place: str(raw.place),
    matchCount: int(raw.match_count),
    scorers,
    scorersBlocked: scorersBlocked(raw, scorers),
    topGoals: int(raw.top_goals),
  };
}

/** Retorno de get_season_ranking. */
export function parseSeasonRanking(
  json: unknown,
  photo: TPhotoResolver
): TSeasonRanking {
  const raw = obj(json);
  return {
    seasonYear: int(raw.season_year),
    members: list(raw.members).map((item) => member(item, photo)),
  };
}

/** Retorno de get_season_events. Array vazio é Temporada sem Evento finished. */
export function parseSeasonEvents(json: unknown): TSeasonEvent[] {
  return list(json).map(eventRow);
}
