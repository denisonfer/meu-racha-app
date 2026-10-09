export const NOTIFICATION_KINDS = [
  "join_request",
  "join_approved",
  "join_refused",
  "event_created",
  "event_changed",
  "event_cancelled",
  "sort_confirmed",
  "team_changed",
  "role_changed",
  "expelled",
  "ownership_transferred",
  "conduction_taken",
  "waitlist_promoted",
  "credit_created",
] as const;

export type TNotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_TARGETS = [
  "available",
  "racha_deleted",
  "not_member",
  "event_cancelled",
  "event_finished",
] as const;

export type TNotificationTarget = (typeof NOTIFICATION_TARGETS)[number];

export const NOTIFICATION_ROLES = ["ADMIN", "PLAYER"] as const;

export type TNotificationRole = (typeof NOTIFICATION_ROLES)[number];

export const NOTIFICATION_RESOLUTION_STATUSES = [
  "approved",
  "refused",
] as const;

export type TNotificationResolutionStatus =
  (typeof NOTIFICATION_RESOLUTION_STATUSES)[number];

export type TNotificationFamily = "racha" | "event" | "team" | "money";

export type TDayGroup = "today" | "yesterday" | "thisWeek" | "earlier";

export type TNotificationChange = {
  date?: string;
  time?: string;
  place?: string;
};

export type TNotificationPayload = {
  eventDate?: string;
  eventTime?: string;
  place?: string;
  team?: number;
  role?: TNotificationRole;
  amountCents?: number;
  validUntil?: string;
  change?: TNotificationChange;
};

export type TNotificationResolution = {
  status: TNotificationResolutionStatus;
  byName: string;
  byMe: boolean;
};

export type TNotification = {
  id: string;
  kind: TNotificationKind;
  rachaId: string;
  rachaName: string;
  eventId: string | null;
  actorName: string | null;
  payload: TNotificationPayload;
  createdAt: string;
  isNew: boolean;
  resolution: TNotificationResolution | null;
  target: TNotificationTarget;
};
