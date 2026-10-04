import type { TPlaysAs, TPosition } from "../profile";
import { POSITION_LAYERS, type TPositionLayer } from "../racha/position-detail";
import type {
  TPublishedSort,
  TSortAttendanceStatus,
  TSortBalance,
  TSortBalanceLabel,
  TSortGoalkeeperQueueEntry,
  TSortLeftPlayer,
  TSortMode,
  TSortPerson,
  TSortPlayer,
  TSortProposal,
  TSortSuperWarning,
  TSortTeam,
  TSortViewer,
  TSortWaitingPlayer,
  TSortWaitingReason,
} from "./types";

/** Resolve o avatar_path do banco na URL pública; o domínio não conhece o storage. */
export type TPhotoResolver = (avatarPath: string | null) => string | null;

type TObject = Record<string, unknown>;

// As RPCs do Sorteio devolvem jsonb: o tipo gerado só diz Json. Estas funções
// são a única porta de entrada, e um formato inesperado vira erro de código.
export const SORT_PAYLOAD_INVALID = "sort_payload_invalid";

const invalid = () => new Error(SORT_PAYLOAD_INVALID);

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

function numOrNull(value: unknown): number | null {
  return value == null ? null : num(value);
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

const MODES = ["normal", "split"] as const satisfies readonly TSortMode[];
const LABELS = [
  "Muito equilibrado",
  "Equilibrado",
  "Razoável",
  "Desequilibrado",
] as const satisfies readonly TSortBalanceLabel[];
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
const ATTENDANCE = [
  "confirmed",
  "waitlisted",
  "cancelled",
  "left",
] as const satisfies readonly TSortAttendanceStatus[];
const EVENT_STATUS = ["upcoming", "active", "finished"] as const;
const WAITING_REASONS = [
  "waitlisted",
  "not_attended",
] as const satisfies readonly TSortWaitingReason[];
const KINDS = ["member", "guest"] as const;

function position(value: unknown): TPosition | null {
  return value == null ? null : oneOf(value, POSITIONS);
}

function layer(value: unknown): TPositionLayer | null {
  return value == null ? null : oneOf(value, POSITION_LAYERS);
}

function person(raw: TObject, photo: TPhotoResolver): TSortPerson {
  return {
    kind: oneOf(raw.kind, KINDS),
    profileId: strOrNull(raw.profile_id),
    guestId: strOrNull(raw.guest_id),
    displayName: str(raw.display_name),
    photoUrl: photo(strOrNull(raw.avatar_path)),
  };
}

function player(value: unknown, photo: TPhotoResolver): TSortPlayer {
  const raw = obj(value);
  return {
    ...person(raw, photo),
    stars: num(raw.stars),
    isSuperStar: bool(raw.is_super_star),
    primaryPosition: position(raw.primary_position),
    secondaryPosition: position(raw.secondary_position),
    primaryLayer: layer(raw.primary_layer),
    enteredAt: str(raw.entered_at),
  };
}

function team(value: unknown, photo: TPhotoResolver): TSortTeam {
  const raw = obj(value);
  return {
    teamNumber: num(raw.team_number),
    queueOrder: numOrNull(raw.queue_order),
    isActive: bool(raw.is_active),
    playerCount: num(raw.player_count),
    isComplete: bool(raw.is_complete),
    starSum: num(raw.star_sum),
    superCount: num(raw.super_count),
    players: list(raw.players).map((item) => player(item, photo)),
    goalkeeper:
      raw.goalkeeper == null ? null : person(obj(raw.goalkeeper), photo),
  };
}

function goalkeeperQueue(
  value: unknown,
  photo: TPhotoResolver
): TSortGoalkeeperQueueEntry[] {
  return list(value).map((item) => {
    const raw = obj(item);
    return { ...person(raw, photo), queueOrder: num(raw.queue_order) };
  });
}

function balance(value: unknown): TSortBalance {
  const raw = obj(value);
  return {
    score: num(raw.score),
    label: oneOf(raw.label, LABELS),
    diff: num(raw.diff),
    superDiff: num(raw.super_diff),
    cappedBySuper: bool(raw.capped_by_super),
  };
}

// team_index do banco começa em 0; o número do Time, em 1
function superWarning(value: unknown): TSortSuperWarning[] {
  return list(value).map((item) => {
    const raw = obj(item);
    return {
      teamNumber: num(raw.team_index) + 1,
      playerIds: list(raw.player_ids).map(str),
    };
  });
}

function viewer(value: unknown): TSortViewer {
  const raw = obj(value);
  return {
    myStatus: raw.my_status == null ? null : oneOf(raw.my_status, ATTENDANCE),
    canInclude: bool(raw.can_include),
    canReturn: bool(raw.can_return),
    canLeaveAny: bool(raw.can_leave_any),
    canLeaveSelf: bool(raw.can_leave_self),
  };
}

function waiting(value: unknown, photo: TPhotoResolver): TSortWaitingPlayer {
  const raw = obj(value);
  return {
    profileId: str(raw.profile_id),
    displayName: str(raw.display_name),
    photoUrl: photo(strOrNull(raw.avatar_path)),
    playsAs: oneOf(raw.plays_as, PLAYS_AS),
    queuePosition: numOrNull(raw.queue_position),
    reason: oneOf(raw.reason, WAITING_REASONS),
  };
}

function leftPlayer(value: unknown, photo: TPhotoResolver): TSortLeftPlayer {
  const raw = obj(value);
  return {
    ...person(raw, photo),
    playsAs: oneOf(raw.plays_as, PLAYS_AS),
    didAttend: bool(raw.did_attend),
  };
}

/** Retorno de prepare/swap/get_event_sort_proposal. */
export function parseSortProposal(
  json: unknown,
  photo: TPhotoResolver
): TSortProposal {
  const raw = obj(json);
  const counts = {
    eventId: str(raw.event_id),
    lineCount: num(raw.line_count),
    goalkeeperCount: num(raw.goalkeeper_count),
    minLinePlayers: num(raw.min_line_players),
    canSort: bool(raw.can_sort),
    considerPosition: bool(raw.consider_position),
    confirmedCount: num(raw.confirmed_count),
    notAttendedCount: num(raw.not_attended_count),
  };
  const state = oneOf(raw.state, ["none", "stale", "ready"] as const);
  if (state !== "ready") return { ...counts, state };

  return {
    ...counts,
    state,
    version: num(raw.version),
    mode: oneOf(raw.mode, MODES),
    balance: balance(raw.balance),
    superWarning: superWarning(raw.super_warning),
    teams: list(raw.teams).map((item) => team(item, photo)),
    goalkeepersPerTeam: bool(raw.goalkeepers_per_team),
    goalkeeperQueue: goalkeeperQueue(raw.goalkeeper_queue, photo),
  };
}

/** Retorno de get_event_sort, confirm, leave, include e return. */
export function parsePublishedSort(
  json: unknown,
  photo: TPhotoResolver
): TPublishedSort {
  const raw = obj(json);
  if (oneOf(raw.state, ["none", "published"] as const) === "none") {
    return { state: "none" };
  }

  return {
    state: "published",
    eventId: str(raw.event_id),
    eventStatus: oneOf(raw.event_status, EVENT_STATUS),
    conductorId: strOrNull(raw.conductor_id),
    isConductor: bool(raw.is_conductor),
    confirmedAt: str(raw.confirmed_at),
    outfieldPerTeam: num(raw.outfield_per_team),
    mode: oneOf(raw.mode, MODES),
    balance: balance(raw.balance),
    superWarning: superWarning(raw.super_warning),
    teams: list(raw.teams).map((item) => team(item, photo)),
    goalkeepersPerTeam: bool(raw.goalkeepers_per_team),
    goalkeeperQueue: goalkeeperQueue(raw.goalkeeper_queue, photo),
    viewer: viewer(raw.viewer),
    waitingForInclusion: list(raw.waiting_for_inclusion).map((item) =>
      waiting(item, photo)
    ),
    left: list(raw.left).map((item) => leftPlayer(item, photo)),
  };
}
