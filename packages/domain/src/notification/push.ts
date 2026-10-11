import { NOTIFICATION_PAYLOAD_INVALID, parseNotifications } from "./parse";
import { notificationText } from "./text";

export type TExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: { notificationId: string };
  badge: number;
  sound: "default";
  channelId: "default";
  priority: "high";
};

type TObject = Record<string, unknown>;

function isObject(value: unknown): value is TObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function message(item: unknown): TExpoPushMessage {
  if (!isObject(item)) throw new Error(NOTIFICATION_PAYLOAD_INVALID);
  const { token, badge } = item;
  if (typeof token !== "string" || !Number.isInteger(badge)) {
    throw new Error(NOTIFICATION_PAYLOAD_INVALID);
  }
  const [notification] = parseNotifications([item.notification]);
  if (notification === undefined) throw new Error(NOTIFICATION_PAYLOAD_INVALID);
  return {
    to: token,
    title: notification.rachaName,
    body: notificationText(notification),
    data: { notificationId: notification.id },
    badge: badge as number,
    sound: "default",
    channelId: "default",
    priority: "high",
  };
}

// O id do Aviso, quando dá para ler, identifica o item no log.
function itemId(item: unknown): string {
  if (isObject(item) && isObject(item.notification)) {
    const { id } = item.notification;
    if (typeof id === "string") return id;
  }
  return "unknown";
}

// items vem do gatilho: [{ token, badge, notification }]. Item que não monta
// fica em skippedIds e não derruba os outros.
export function buildPushMessages(json: unknown): {
  messages: TExpoPushMessage[];
  skippedIds: string[];
} {
  const messages: TExpoPushMessage[] = [];
  const skippedIds: string[] = [];
  for (const item of Array.isArray(json) ? json : []) {
    try {
      messages.push(message(item));
    } catch {
      skippedIds.push(itemId(item));
    }
  }
  return { messages, skippedIds };
}

// tickets na mesma ordem das mensagens enviadas (API do Expo).
export function deadPushTokens(
  messages: TExpoPushMessage[],
  tickets: unknown
): string[] {
  if (!Array.isArray(tickets)) return [];
  return messages
    .filter((_, index) => {
      const ticket: unknown = tickets[index];
      return (
        isObject(ticket) &&
        ticket.status === "error" &&
        isObject(ticket.details) &&
        ticket.details.error === "DeviceNotRegistered"
      );
    })
    .map((m) => m.to);
}
