import type { TPhotoResolver } from "../sorteio/parse";
import type {
  TEventMatch,
  TMatchEventStatus,
  TMatchFinishPreview,
  TMatchGoal,
  TMatchGoalkeeperQueueEntry,
  TMatchItem,
  TMatchLineupEntry,
  TMatchNextSide,
  TMatchPerson,
  TMatchPortraitState,
  TMatchRole,
  TMatchSide,
  TMatchStatus,
  TMatchTeamQueueEntry,
  TNextMatch,
} from "./types";

export type { TPhotoResolver };

// As RPCs da Partida devolvem jsonb: o tipo gerado só diz Json. Estas funções
// são a única porta de entrada, e um formato inesperado vira erro de código.
export const MATCH_PAYLOAD_INVALID = "match_payload_invalid";

type TObject = Record<string, unknown>;

const invalid = () => new Error(MATCH_PAYLOAD_INVALID);

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

const EVENT_STATUS = [
  "upcoming",
  "active",
  "finished",
] as const satisfies readonly TMatchEventStatus[];
const PORTRAIT_STATES = [
  "open",
  "ready",
] as const satisfies readonly TMatchPortraitState[];
const MATCH_STATUS = [
  "open",
  "finished",
  "discarded",
] as const satisfies readonly TMatchStatus[];
const ROLES = [
  "OUTFIELD",
  "GOALKEEPER",
] as const satisfies readonly TMatchRole[];
const KINDS = ["member", "guest"] as const;

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

function personOrNull(
  value: unknown,
  photo: TPhotoResolver
): TMatchPerson | null {
  return value == null ? null : person(value, photo);
}

function nextSide(value: unknown, photo: TPhotoResolver): TMatchNextSide {
  const raw = obj(value);
  return {
    teamId: str(raw.team_id),
    teamNumber: num(raw.team_number),
    winStreak: num(raw.win_streak),
    goalkeeper: personOrNull(raw.goalkeeper, photo),
    isComplete: bool(raw.is_complete),
  };
}

function side(value: unknown, photo: TPhotoResolver): TMatchSide {
  const raw = obj(value);
  return { ...nextSide(raw, photo), score: num(raw.score) };
}

function goal(value: unknown, photo: TPhotoResolver): TMatchGoal {
  const raw = obj(value);
  return {
    id: str(raw.id),
    requestKey: str(raw.request_key),
    teamId: str(raw.team_id),
    teamNumber: num(raw.team_number),
    isOwnGoal: bool(raw.is_own_goal),
    scorer: personOrNull(raw.scorer, photo),
    assist: personOrNull(raw.assist, photo),
    concededGoalkeeper: personOrNull(raw.conceded_goalkeeper, photo),
    createdAt: str(raw.created_at),
  };
}

function lineupEntry(value: unknown, photo: TPhotoResolver): TMatchLineupEntry {
  const raw = obj(value);
  return {
    teamId: str(raw.team_id),
    role: oneOf(raw.role, ROLES),
    person: person(raw.person, photo),
    enteredAt: str(raw.entered_at),
    leftAt: strOrNull(raw.left_at),
  };
}

function matchItem(value: unknown, photo: TPhotoResolver): TMatchItem {
  const raw = obj(value);
  return {
    id: str(raw.id),
    number: num(raw.number),
    status: oneOf(raw.status, MATCH_STATUS),
    home: side(raw.home, photo),
    away: side(raw.away, photo),
    challengerTeamId: strOrNull(raw.challenger_team_id),
    isRematch: bool(raw.is_rematch),
    startedAt: str(raw.started_at),
    pausedAt: strOrNull(raw.paused_at),
    pausedSeconds: num(raw.paused_seconds),
    endedAt: strOrNull(raw.ended_at),
    winnerTeamId: strOrNull(raw.winner_team_id),
    decidedByPenalties: bool(raw.decided_by_penalties),
    seq: num(raw.seq),
    goals: list(raw.goals).map((item) => goal(item, photo)),
    lineup: list(raw.lineup).map((item) => lineupEntry(item, photo)),
  };
}

function nextMatch(value: unknown, photo: TPhotoResolver): TNextMatch {
  const raw = obj(value);
  return {
    home: nextSide(raw.home, photo),
    away: nextSide(raw.away, photo),
    challengerTeamId: strOrNull(raw.challenger_team_id),
    isRematch: bool(raw.is_rematch),
  };
}

function teamQueue(value: unknown): TMatchTeamQueueEntry {
  const raw = obj(value);
  return {
    teamId: str(raw.team_id),
    teamNumber: num(raw.team_number),
    queueOrder: num(raw.queue_order),
    winStreak: num(raw.win_streak),
    isComplete: bool(raw.is_complete),
  };
}

function goalkeeperQueue(
  value: unknown,
  photo: TPhotoResolver
): TMatchGoalkeeperQueueEntry {
  const raw = obj(value);
  return {
    person: person(raw.person, photo),
    queueOrder: num(raw.queue_order),
  };
}

/** Retorno de get/start/pause/resume/add/update/delete/swap/finish/discard. */
export function parseEventMatch(
  json: unknown,
  photo: TPhotoResolver
): TEventMatch {
  const raw = obj(json);
  return {
    eventId: str(raw.event_id),
    eventStatus: oneOf(raw.event_status, EVENT_STATUS),
    state: oneOf(raw.state, PORTRAIT_STATES),
    serverNow: str(raw.server_now),
    durationMin: numOrNull(raw.duration_min),
    startedAt: strOrNull(raw.started_at),
    pausedAt: strOrNull(raw.paused_at),
    pausedSeconds: numOrNull(raw.paused_seconds),
    seq: num(raw.seq),
    match: raw.match == null ? null : matchItem(raw.match, photo),
    nextMatch: raw.next_match == null ? null : nextMatch(raw.next_match, photo),
    teams: list(raw.teams).map(teamQueue),
    goalkeeperQueue: list(raw.goalkeeper_queue).map((item) =>
      goalkeeperQueue(item, photo)
    ),
    finishedMatches: list(raw.finished_matches).map((item) =>
      matchItem(item, photo)
    ),
    viewer: { canConduct: bool(obj(raw.viewer).can_conduct) },
  };
}

/** Retorno de preview_finish_event_match. */
export function parseMatchFinishPreview(json: unknown): TMatchFinishPreview {
  const raw = obj(json);
  const scoreRaw = obj(raw.score);
  return {
    matchId: str(raw.match_id),
    score: { home: num(scoreRaw.home), away: num(scoreRaw.away) },
    winnerTeamId: strOrNull(raw.winner_team_id),
    decidedByPenalties: bool(raw.decided_by_penalties),
    consequence: str(raw.consequence),
    fallback: strOrNull(raw.fallback),
    nextIsRematch: bool(raw.next_is_rematch),
    nextChallengerTeamId: strOrNull(raw.next_challenger_team_id),
  };
}
