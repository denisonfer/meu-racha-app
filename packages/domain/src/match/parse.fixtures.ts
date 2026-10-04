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

const HOME_SIDE = {
  team_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  team_number: 1,
  win_streak: 2,
  score: 1,
  goalkeeper: MEMBER,
  is_complete: true,
};

const AWAY_SIDE = {
  team_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  team_number: 2,
  win_streak: 0,
  score: 0,
  goalkeeper: GUEST,
  is_complete: false,
};

export const MATCH_ITEM_OPEN = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  number: 3,
  status: "open",
  home: HOME_SIDE,
  away: AWAY_SIDE,
  challenger_team_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  is_rematch: false,
  started_at: "2026-10-04T15:00:00+00:00",
  paused_at: null,
  paused_seconds: 12,
  ended_at: null,
  winner_team_id: null,
  decided_by_penalties: false,
  seq: 41,
  goals: [
    {
      id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      request_key: "17600000000000.123",
      team_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      team_number: 1,
      is_own_goal: false,
      scorer: MEMBER,
      assist: null,
      conceded_goalkeeper: GUEST,
      created_at: "2026-10-04T15:02:00+00:00",
    },
  ],
  lineup: [
    {
      team_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      role: "GOALKEEPER",
      person: MEMBER,
      entered_at: "2026-10-04T15:00:00+00:00",
      left_at: null,
    },
  ],
};

export const MATCH_OPEN = {
  event_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  event_status: "active",
  state: "open",
  server_now: "2026-10-04T15:05:00+00:00",
  duration_min: 7,
  started_at: "2026-10-04T15:00:00+00:00",
  paused_at: null,
  paused_seconds: 12,
  seq: 41,
  match: MATCH_ITEM_OPEN,
  next_match: null,
  teams: [
    {
      team_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      team_number: 1,
      queue_order: 1,
      win_streak: 2,
      is_complete: true,
    },
    {
      team_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      team_number: 2,
      queue_order: 2,
      win_streak: 0,
      is_complete: false,
    },
  ],
  goalkeeper_queue: [{ person: GUEST, queue_order: 1 }],
  finished_matches: [],
  viewer: { can_conduct: true },
};

export const MATCH_READY = {
  event_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  event_status: "active",
  state: "ready",
  server_now: "2026-10-04T15:20:00+00:00",
  duration_min: null,
  started_at: null,
  paused_at: null,
  paused_seconds: null,
  seq: 40,
  match: null,
  next_match: {
    home: {
      team_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      team_number: 1,
      win_streak: 1,
      goalkeeper: MEMBER,
      is_complete: true,
    },
    away: {
      team_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
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
      team_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      team_number: 1,
      queue_order: 1,
      win_streak: 1,
      is_complete: true,
    },
    {
      team_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
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
      winner_team_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      paused_at: null,
    },
  ],
  viewer: { can_conduct: false },
};

export const MATCH_PREVIEW = {
  match_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  score: { home: 1, away: 0 },
  winner_team_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  decided_by_penalties: false,
  consequence: "winner_stays",
  fallback: null,
  next_is_rematch: false,
  next_challenger_team_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
};
