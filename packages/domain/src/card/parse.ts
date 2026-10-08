import type { TPlaysAs, TPosition } from "../profile/types";
import type {
  TKeeperCardNumbers,
  TLineCardNumbers,
  TMemberCard,
  TMemberCardStats,
  TMyProfileCard,
  TShownRole,
} from "./types";

// As RPCs da carta devolvem jsonb. Formato inesperado vira erro de código,
// no mesmo espírito da Resenha: o app não monta carta pela metade.
export const CARD_PAYLOAD_INVALID = "card_payload_invalid";

type TObject = Record<string, unknown>;

const invalid = () => new Error(CARD_PAYLOAD_INVALID);

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

// O banco manda inteiro. 40.5 não é Overall nem contagem.
function int(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  throw invalid();
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  const text = str(value);
  const found = allowed.find((item) => item === text);
  if (found === undefined) throw invalid();
  return found;
}

const SHOWN_ROLES = [
  "LINE",
  "GOALKEEPER",
] as const satisfies readonly TShownRole[];

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

// null é goleiro sem posição larga. Chave ausente é payload ruim: o app
// não inventa a sigla a partir do Cadastro.
function positionOrNull(raw: TObject): TPosition | null {
  if (!("primary_position" in raw)) throw invalid();
  const value = raw.primary_position;
  if (value == null) return null;
  return oneOf(value, POSITIONS);
}

function lineNumbers(value: unknown): TLineCardNumbers {
  const raw = obj(value);
  return {
    matches: int(raw.matches),
    goals: int(raw.goals),
    assists: int(raw.assists),
    wins: int(raw.wins),
  };
}

function keeperNumbers(value: unknown): TKeeperCardNumbers {
  const raw = obj(value);
  return {
    matches: int(raw.matches),
    wins: int(raw.wins),
    cleanSheets: int(raw.clean_sheets),
    goals: int(raw.goals),
  };
}

function cardStats(raw: TObject): TMemberCardStats {
  return {
    shownRole: oneOf(raw.shown_role, SHOWN_ROLES),
    overall: int(raw.overall),
    line: lineNumbers(raw.line),
    keeper: keeperNumbers(raw.keeper),
    seasonYear: int(raw.season_year),
    playsAs: oneOf(raw.plays_as, PLAYS_AS),
    primaryPosition: positionOrNull(raw),
  };
}

/** Campos comuns de get_racha_cards e do scorer_card da Resenha. */
export function parseCardStats(value: unknown): TMemberCardStats {
  return cardStats(obj(value));
}

export function parseMemberCard(value: unknown): TMemberCard {
  const raw = obj(value);
  return {
    profileId: str(raw.profile_id),
    ...cardStats(raw),
  };
}

/** Retorno de get_racha_cards. */
export function parseRachaCards(json: unknown): TMemberCard[] {
  return list(json).map(parseMemberCard);
}

/** Retorno de get_my_profile_card. SQL null → null (sem Racha). */
export function parseMyProfileCard(json: unknown): TMyProfileCard | null {
  if (json == null) return null;
  const raw = obj(json);
  return {
    rachaName: str(raw.racha_name),
    card: parseMemberCard(raw.card),
  };
}
