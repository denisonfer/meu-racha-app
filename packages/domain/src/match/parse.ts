import type { TPhotoResolver } from "../sorteio/parse";
import type {
  TEventMatch,
  TMatchArrival,
  TMatchCard,
  TMatchCardColor,
  TMatchCardEvent,
  TMatchCardRedReason,
  TMatchEntryKind,
  TMatchEvent,
  TMatchEventStatus,
  TMatchFinishPreview,
  TMatchGoal,
  TMatchGoalkeeperQueueEntry,
  TMatchItem,
  TMatchLineupEntry,
  TMatchNextSide,
  TMatchPendingReinforcement,
  TMatchPerson,
  TMatchPortraitState,
  TYellowCardMode,
  TMatchReinforcementDonor,
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
const YELLOW_CARD_MODES = [
  "timed",
  "mark",
] as const satisfies readonly TYellowCardMode[];
const MATCH_STATUS = [
  "open",
  "finished",
  "discarded",
] as const satisfies readonly TMatchStatus[];
const ROLES = [
  "OUTFIELD",
  "GOALKEEPER",
] as const satisfies readonly TMatchRole[];
const ENTRY_KINDS = [
  "start",
  "reinforcement",
  "inclusion",
  "return",
  "goalkeeper",
] as const satisfies readonly TMatchEntryKind[];
const EVENT_KINDS = [
  "goal",
  "leave",
  "reinforcement",
  "inclusion",
  "return",
  "card",
] as const;
const CARD_COLORS = [
  "yellow",
  "red",
] as const satisfies readonly TMatchCardColor[];
const RED_REASONS = ["direct", "second_yellow"] as const;
const ARRIVAL_KINDS = [
  "field",
  "field_draw",
  "queue",
  "new_team",
] as const satisfies readonly TMatchArrival["kind"][];
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
  return {
    ...nextSide(raw, photo),
    score: num(raw.score),
    outfieldCount: num(raw.outfield_count),
    capacity: num(raw.capacity),
    lineup: list(raw.lineup).map((item) => lineupEntry(item, photo)),
  };
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
    entryKind: oneOf(raw.entry_kind, ENTRY_KINDS),
    leftBySelf: bool(raw.left_by_self),
    leftByRed: bool(raw.left_by_red),
  };
}

function cardReason(
  color: TMatchCardColor,
  value: unknown
): TMatchCardRedReason | null {
  if (value == null) {
    if (color === "red") throw invalid();
    return null;
  }
  const raw = oneOf(value, RED_REASONS);
  if (color !== "red") throw invalid();
  return raw === "second_yellow" ? "secondYellow" : "direct";
}

function matchCard(value: unknown, photo: TPhotoResolver): TMatchCard {
  const raw = obj(value);
  const color = oneOf(raw.color, CARD_COLORS);
  return {
    id: str(raw.id),
    person: person(raw.person, photo),
    teamId: str(raw.team_id),
    isGoalkeeper: bool(raw.is_goalkeeper),
    color,
    redReason: cardReason(color, raw.red_reason),
    matchSecond: num(raw.match_second),
    createdAt: str(raw.created_at),
  };
}

function donor(value: unknown): TMatchReinforcementDonor {
  const raw = obj(value);
  return {
    teamId: str(raw.team_id),
    teamNumber: num(raw.team_number),
    queuePosition: num(raw.queue_position),
    outfieldCount: num(raw.outfield_count),
  };
}

function pending(
  value: unknown,
  photo: TPhotoResolver
): TMatchPendingReinforcement {
  const raw = obj(value);
  return {
    person: person(raw.person, photo),
    teamId: str(raw.team_id),
    teamNumber: num(raw.team_number),
    leftAt: str(raw.left_at),
  };
}

function arrival(json: unknown): TMatchArrival {
  const raw = obj(json);
  const kind = oneOf(raw.kind, ARRIVAL_KINDS);
  if (kind === "field_draw") {
    if (raw.team_id != null || raw.team_number != null) throw invalid();
    return { kind, teamId: null, teamNumber: null };
  }
  if (kind === "new_team") {
    if (raw.team_id != null) throw invalid();
    return { kind, teamId: null, teamNumber: num(raw.team_number) };
  }
  return {
    kind,
    teamId: str(raw.team_id),
    teamNumber: num(raw.team_number),
  };
}

function matchEvent(value: unknown, photo: TPhotoResolver): TMatchEvent {
  const raw = obj(value);
  const kind = oneOf(raw.kind, EVENT_KINDS);
  if (kind === "goal") {
    return { kind, ...goal(raw, photo) };
  }
  if (kind === "leave") {
    return {
      kind,
      id: str(raw.id),
      person: person(raw.person, photo),
      teamId: str(raw.team_id),
      teamNumber: num(raw.team_number),
      bySelf: bool(raw.by_self),
      reinforced: bool(raw.reinforced),
      outfieldCount: num(raw.outfield_count),
      capacity: num(raw.capacity),
      createdAt: str(raw.created_at),
    };
  }
  if (kind === "card") {
    const color = oneOf(raw.color, CARD_COLORS);
    const event: TMatchCardEvent = {
      kind,
      id: str(raw.id),
      person: person(raw.person, photo),
      teamId: str(raw.team_id),
      teamNumber: num(raw.team_number),
      isGoalkeeper: bool(raw.is_goalkeeper),
      color,
      redReason: cardReason(color, raw.red_reason),
      matchSecond: num(raw.match_second),
      createdAt: str(raw.created_at),
    };
    return event;
  }
  if (kind === "reinforcement") {
    return {
      kind,
      id: str(raw.id),
      entered: person(raw.entered, photo),
      left: person(raw.left, photo),
      fromTeamId: str(raw.from_team_id),
      fromTeamNumber: num(raw.from_team_number),
      toTeamId: str(raw.to_team_id),
      toTeamNumber: num(raw.to_team_number),
      teamDrawn: bool(raw.team_drawn),
      createdAt: str(raw.created_at),
    };
  }
  return {
    kind,
    id: str(raw.id),
    person: person(raw.person, photo),
    teamId: str(raw.team_id),
    teamNumber: num(raw.team_number),
    createdAt: str(raw.created_at),
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
    cards: list(raw.cards).map((item) => matchCard(item, photo)),
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
    yellowCardMode: oneOf(raw.yellow_card_mode, YELLOW_CARD_MODES),
    yellowOutMin: num(raw.yellow_out_min),
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
    reinforcementDonors: list(raw.reinforcement_donors).map(donor),
    pendingReinforcements: list(raw.pending_reinforcements).map((item) =>
      pending(item, photo)
    ),
    events: list(raw.events).map((item) => matchEvent(item, photo)),
    nextArrival: arrival(raw.next_arrival),
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
