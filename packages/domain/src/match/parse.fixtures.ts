// Forma do jsonb de private.event_match_json / preview_finish_event_match.

const MEMBER = {
  kind: "member",
  person_id: "11111111-1111-1111-1111-111111111111",
  profile_id: "11111111-1111-1111-1111-111111111111",
  guest_id: null,
  display_name: "Caio",
  avatar_path: "p/caio.png",
};

const GUEST = {
  kind: "guest",
  person_id: "22222222-2222-2222-2222-222222222222",
  profile_id: null,
  guest_id: "22222222-2222-2222-2222-222222222222",
  display_name: "Avulso Z",
  avatar_path: null,
};

const LUCAS = {
  kind: "member",
  person_id: "33333333-3333-3333-3333-333333333333",
  profile_id: "33333333-3333-3333-3333-333333333333",
  guest_id: null,
  display_name: "Lucas M.",
  avatar_path: null,
};

const PEDRO = {
  kind: "member",
  person_id: "44444444-4444-4444-4444-444444444444",
  profile_id: "44444444-4444-4444-4444-444444444444",
  guest_id: null,
  display_name: "Pedro H.",
  avatar_path: null,
};

const TEAM1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TEAM2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TEAM3 = "99999999-9999-9999-9999-999999999999";
const TEAM4 = "88888888-8888-8888-8888-888888888888";

const GOAL = {
  id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  request_key: "17600000000000.123",
  team_id: TEAM1,
  team_number: 1,
  is_own_goal: false,
  scorer: MEMBER,
  assist: null,
  conceded_goalkeeper: GUEST,
  created_at: "2026-10-04T15:02:00+00:00",
};

const HOME_SIDE = {
  team_id: TEAM1,
  team_number: 1,
  win_streak: 2,
  score: 1,
  goalkeeper: MEMBER,
  is_complete: true,
  outfield_count: 5,
  capacity: 5,
  lineup: [
    {
      team_id: TEAM1,
      role: "OUTFIELD",
      person: LUCAS,
      entered_at: "2026-10-04T15:00:00+00:00",
      left_at: null,
      entry_kind: "start",
      left_by_self: false,
      left_by_red: false,
    },
  ],
};

const AWAY_SIDE = {
  team_id: TEAM2,
  team_number: 2,
  win_streak: 0,
  score: 0,
  goalkeeper: GUEST,
  is_complete: false,
  outfield_count: 4,
  capacity: 5,
  lineup: [],
};

export const MATCH_ITEM_OPEN = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  number: 3,
  status: "open",
  home: HOME_SIDE,
  away: AWAY_SIDE,
  challenger_team_id: TEAM2,
  is_rematch: false,
  started_at: "2026-10-04T15:00:00+00:00",
  paused_at: null,
  paused_seconds: 12,
  ended_at: null,
  winner_team_id: null,
  decided_by_penalties: false,
  seq: 41,
  goals: [GOAL],
  lineup: [
    {
      team_id: TEAM1,
      role: "GOALKEEPER",
      person: MEMBER,
      entered_at: "2026-10-04T15:00:00+00:00",
      left_at: null,
      entry_kind: "goalkeeper",
      left_by_self: false,
      left_by_red: false,
    },
  ],
  cards: [],
};

const PORTRAIT_BASE = {
  event_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  event_status: "active",
  server_now: "2026-10-04T15:05:00+00:00",
  duration_min: 7,
  yellow_card_mode: "timed",
  yellow_out_min: 2,
  started_at: "2026-10-04T15:00:00+00:00",
  paused_at: null,
  paused_seconds: 12,
  seq: 41,
  conductor_name: "Lucas M.",
  next_match: null,
  teams: [
    {
      team_id: TEAM1,
      team_number: 1,
      queue_order: 1,
      win_streak: 2,
      is_complete: true,
    },
    {
      team_id: TEAM2,
      team_number: 2,
      queue_order: 2,
      win_streak: 0,
      is_complete: false,
    },
  ],
  goalkeeper_queue: [{ person: GUEST, queue_order: 1 }],
  finished_matches: [],
  viewer: { can_conduct: true, can_assume: false },
};

/** Fila vazia: só os dois Times em campo; donors []. */
export const MATCH_OPEN = {
  ...PORTRAIT_BASE,
  state: "open",
  match: MATCH_ITEM_OPEN,
  reinforcement_donors: [],
  pending_reinforcements: [],
  events: [{ kind: "goal", ...GOAL }],
  next_arrival: { kind: "field", team_id: TEAM2, team_number: 2 },
};

export const MATCH_READY = {
  event_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  event_status: "active",
  state: "ready",
  server_now: "2026-10-04T15:20:00+00:00",
  duration_min: null,
  yellow_card_mode: "mark",
  yellow_out_min: 7,
  started_at: null,
  paused_at: null,
  paused_seconds: null,
  seq: 40,
  match: null,
  next_match: {
    home: {
      team_id: TEAM1,
      team_number: 1,
      win_streak: 1,
      goalkeeper: MEMBER,
      is_complete: true,
    },
    away: {
      team_id: TEAM2,
      team_number: 2,
      win_streak: 0,
      goalkeeper: null,
      is_complete: true,
    },
    challenger_team_id: null,
    is_rematch: true,
  },
  teams: [
    {
      team_id: TEAM1,
      team_number: 1,
      queue_order: 1,
      win_streak: 1,
      is_complete: true,
    },
    {
      team_id: TEAM2,
      team_number: 2,
      queue_order: 2,
      win_streak: 0,
      is_complete: true,
    },
  ],
  goalkeeper_queue: [],
  finished_matches: [
    {
      ...MATCH_ITEM_OPEN,
      status: "finished",
      ended_at: "2026-10-04T15:10:00+00:00",
      winner_team_id: TEAM1,
      paused_at: null,
    },
  ],
  viewer: { can_conduct: false },
  reinforcement_donors: [],
  pending_reinforcements: [],
  events: [],
  next_arrival: { kind: "new_team", team_id: null, team_number: 3 },
};

/** Doador na fila com um jogador de linha. */
export const MATCH_OPEN_DONOR = {
  ...MATCH_OPEN,
  reinforcement_donors: [
    {
      team_id: TEAM4,
      team_number: 4,
      queue_position: 1,
      outfield_count: 1,
    },
  ],
  next_arrival: { kind: "queue", team_id: TEAM4, team_number: 4 },
};

/** Saída própria pendente (aviso R4). */
export const MATCH_OPEN_PENDING_SELF = {
  ...MATCH_OPEN,
  pending_reinforcements: [
    {
      person: LUCAS,
      team_id: TEAM2,
      team_number: 2,
      left_at: "2026-10-04T15:03:00+00:00",
    },
  ],
};

/** Empate entre os Times em campo abaixo da linha. */
export const MATCH_OPEN_FIELD_DRAW = {
  ...MATCH_OPEN,
  next_arrival: { kind: "field_draw", team_id: null, team_number: null },
};

const LEAVE_EVENT = {
  kind: "leave",
  id: "55555555-5555-5555-5555-555555555555",
  person: LUCAS,
  team_id: TEAM2,
  team_number: 2,
  by_self: true,
  reinforced: true,
  outfield_count: 4,
  capacity: 5,
  created_at: "2026-10-04T15:03:00+00:00",
};

const REINFORCEMENT_EVENT = {
  kind: "reinforcement",
  id: "66666666-6666-6666-6666-666666666666",
  entered: PEDRO,
  left: LUCAS,
  from_team_id: TEAM3,
  from_team_number: 3,
  to_team_id: TEAM2,
  to_team_number: 2,
  team_drawn: false,
  created_at: "2026-10-04T15:03:00+00:00",
};

const INCLUSION_EVENT = {
  kind: "inclusion",
  id: "77777777-7777-7777-7777-777777777777",
  person: MEMBER,
  team_id: TEAM1,
  team_number: 1,
  created_at: "2026-10-04T15:01:00+00:00",
};

const YELLOW_CARD = {
  id: "12121212-1212-1212-1212-121212121212",
  person: LUCAS,
  team_id: TEAM1,
  is_goalkeeper: false,
  color: "yellow",
  red_reason: null,
  match_second: 340,
  created_at: "2026-10-04T15:05:40+00:00",
};

const CARD_EVENT = {
  kind: "card",
  id: "13131313-1313-1313-1313-131313131313",
  person: MEMBER,
  team_id: TEAM1,
  team_number: 1,
  is_goalkeeper: true,
  color: "red",
  red_reason: "second_yellow",
  match_second: 400,
  created_at: "2026-10-04T15:06:40+00:00",
};

const RETURN_EVENT = {
  kind: "return",
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  person: GUEST,
  team_id: TEAM2,
  team_number: 2,
  created_at: "2026-10-04T15:00:30+00:00",
};

/** Últimos lances com os cinco kinds, mais recente primeiro. */
export const MATCH_OPEN_EVENTS = {
  ...MATCH_OPEN,
  events: [
    REINFORCEMENT_EVENT,
    LEAVE_EVENT,
    { kind: "goal", ...GOAL },
    INCLUSION_EVENT,
    RETURN_EVENT,
  ],
};

/** Cartão no retrato e lance de segundo amarelo; elenco completo marca saída por vermelho. */
export const MATCH_OPEN_CARD = {
  ...MATCH_OPEN,
  match: {
    ...MATCH_ITEM_OPEN,
    cards: [YELLOW_CARD],
    lineup: [
      {
        ...MATCH_ITEM_OPEN.lineup[0],
        left_by_red: true,
        left_at: "2026-10-04T15:06:40+00:00",
      },
    ],
  },
  events: [CARD_EVENT],
};

export const MATCH_PREVIEW = {
  match_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  score: { home: 1, away: 0 },
  winner_team_id: TEAM1,
  decided_by_penalties: false,
  consequence: "winner_stays",
  fallback: null,
  next_is_rematch: false,
  next_challenger_team_id: TEAM2,
};
