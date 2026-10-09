import type { TNotificationKind, TNotificationTarget } from "@meu-racha/domain";

export type TNotificationHrefInput = {
  kind: TNotificationKind;
  target: TNotificationTarget;
  rachaId: string;
  eventId: string | null;
};

const GONE_TARGETS: readonly TNotificationTarget[] = [
  "racha_deleted",
  "not_member",
  "event_cancelled",
];

// O assunto sumiu: a linha fica, mas não leva a lugar nenhum.
export function notificationIsUnavailable(
  target: TNotificationTarget
): boolean {
  return GONE_TARGETS.includes(target);
}

export function notificationHref(
  notice: TNotificationHrefInput
): string | null {
  if (notificationIsUnavailable(notice.target)) return null;
  if (notice.kind === "join_refused" || notice.kind === "expelled") {
    return null;
  }
  if (notice.kind === "join_request") {
    return `/racha/${notice.rachaId}/requests`;
  }

  const finished = notice.target === "event_finished";
  if (notice.kind === "sort_confirmed" || notice.kind === "team_changed") {
    if (!notice.eventId) return null;
    const leaf = finished ? "resenha" : "sort";
    return `/racha/${notice.rachaId}/event/${notice.eventId}/${leaf}`;
  }
  if (notice.kind === "conduction_taken") {
    if (!notice.eventId) return null;
    const leaf = finished ? "resenha" : "match";
    return `/racha/${notice.rachaId}/event/${notice.eventId}/${leaf}`;
  }

  return `/racha/${notice.rachaId}`;
}
