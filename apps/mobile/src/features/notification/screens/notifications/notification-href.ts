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

  // Só navega o Aviso que pede ação lá; o resto só informa.
  switch (notice.kind) {
    case "join_request":
      return `/racha/${notice.rachaId}/requests`;
    case "event_created":
    case "waitlist_promoted":
      return `/racha/${notice.rachaId}`;
    case "sort_confirmed":
    case "team_changed": {
      if (!notice.eventId) return null;
      const leaf = notice.target === "event_finished" ? "resenha" : "sort";
      return `/racha/${notice.rachaId}/event/${notice.eventId}/${leaf}`;
    }
    default:
      return null;
  }
}
