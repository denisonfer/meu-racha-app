// packages/domain/src/notification/types.ts
var NOTIFICATION_KINDS = [
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
  "credit_created"
];
var NOTIFICATION_TARGETS = [
  "available",
  "racha_deleted",
  "not_member",
  "event_cancelled",
  "event_finished"
];
var NOTIFICATION_ROLES = ["ADMIN", "PLAYER"];
var NOTIFICATION_RESOLUTION_STATUSES = [
  "approved",
  "refused"
];

// packages/domain/src/notification/parse.ts
var NOTIFICATION_PAYLOAD_INVALID = "notification_payload_invalid";
var invalid = () => new Error(NOTIFICATION_PAYLOAD_INVALID);
function obj(value) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value;
  }
  throw invalid();
}
function list(value) {
  if (Array.isArray(value))
    return value;
  throw invalid();
}
function str(value) {
  if (typeof value === "string")
    return value;
  throw invalid();
}
function bool(value) {
  if (typeof value === "boolean")
    return value;
  throw invalid();
}
function int(value) {
  if (typeof value === "number" && Number.isInteger(value))
    return value;
  throw invalid();
}
function oneOf(value, allowed) {
  const text = str(value);
  const found = allowed.find((item) => item === text);
  if (found === undefined)
    throw invalid();
  return found;
}
function strOrNull(raw, key) {
  if (!(key in raw))
    throw invalid();
  const value = raw[key];
  if (value == null)
    return null;
  return str(value);
}
function change(value) {
  const raw = obj(value);
  const parsed = {};
  if ("date" in raw)
    parsed.date = str(raw.date);
  if ("time" in raw)
    parsed.time = str(raw.time);
  if ("place" in raw)
    parsed.place = str(raw.place);
  return parsed;
}
function payload(value) {
  const raw = obj(value);
  const parsed = {};
  if ("event_date" in raw)
    parsed.eventDate = str(raw.event_date);
  if ("event_time" in raw)
    parsed.eventTime = str(raw.event_time);
  if ("place" in raw)
    parsed.place = str(raw.place);
  if ("team" in raw)
    parsed.team = int(raw.team);
  if ("role" in raw)
    parsed.role = oneOf(raw.role, NOTIFICATION_ROLES);
  if ("amount_cents" in raw)
    parsed.amountCents = int(raw.amount_cents);
  if ("valid_until" in raw)
    parsed.validUntil = str(raw.valid_until);
  if ("change" in raw)
    parsed.change = change(raw.change);
  return parsed;
}
function resolution(raw) {
  if (!("resolution" in raw))
    throw invalid();
  const value = raw.resolution;
  if (value == null)
    return null;
  const body = obj(value);
  return {
    status: oneOf(body.status, NOTIFICATION_RESOLUTION_STATUSES),
    byName: str(body.by_name),
    byMe: bool(body.by_me)
  };
}
function notification(value) {
  const raw = obj(value);
  return {
    id: str(raw.id),
    kind: oneOf(raw.kind, NOTIFICATION_KINDS),
    rachaId: str(raw.racha_id),
    rachaName: str(raw.racha_name),
    eventId: strOrNull(raw, "event_id"),
    actorName: strOrNull(raw, "actor_name"),
    payload: payload(raw.payload),
    createdAt: str(raw.created_at),
    isNew: bool(raw.is_new),
    resolution: resolution(raw),
    target: oneOf(raw.target, NOTIFICATION_TARGETS)
  };
}
function parseNotifications(json) {
  return list(json).map(notification);
}

// packages/domain/src/format/brl-mask.ts
var MAX_DIGITS = 5;
function applyBrlMask(value) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS);
  if (!digits)
    return "";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${grouped}`;
}

// packages/domain/src/resenha/resenha.ts
var WEEKDAYS_SHORT = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sáb"
];
var WEEKDAYS_LONG = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado"
];
function civilUtcDay(startsOn) {
  const year = Number(startsOn.slice(0, 4));
  const month = Number(startsOn.slice(5, 7));
  const day = Number(startsOn.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day));
}
function formatResenhaCivilDate(startsOn) {
  const date = civilUtcDay(startsOn);
  const weekdayIndex = date.getUTCDay();
  const weekdayShort = WEEKDAYS_SHORT[weekdayIndex] ?? "dom";
  const weekdayLong = WEEKDAYS_LONG[weekdayIndex] ?? "Domingo";
  const day = startsOn.slice(8, 10);
  const month = startsOn.slice(5, 7);
  return {
    weekdayShort,
    weekdayLong,
    weekdayShortUpper: weekdayShort.toUpperCase(),
    dayMonth: `${day}/${month}`
  };
}

// packages/domain/src/notification/text.ts
var invalid2 = () => new Error(NOTIFICATION_PAYLOAD_INVALID);
function civilPhrase(isoDate) {
  if (!isoDate)
    throw invalid2();
  const formatted = formatResenhaCivilDate(isoDate);
  return `${formatted.weekdayShort} ${formatted.dayMonth}`;
}
function formatClock(value) {
  if (!value)
    throw invalid2();
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  const hourText = match?.[1];
  const minute = match?.[2];
  if (hourText === undefined || minute === undefined)
    throw invalid2();
  const hour = Number(hourText);
  if (hour > 23 || Number(minute) > 59)
    throw invalid2();
  if (minute === "00")
    return `${hour}h`;
  return `${hour}h${minute}`;
}
function dayMonth(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate))
    throw invalid2();
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}
function actor(name) {
  if (!name)
    throw invalid2();
  return name;
}
function changedParts(change) {
  if (!change)
    throw invalid2();
  const parts = [];
  if (change.date)
    parts.push(civilPhrase(change.date));
  if (change.time)
    parts.push(formatClock(change.time));
  if (change.place)
    parts.push(`na ${change.place}`);
  return parts.join(", ");
}
function eventChanged(payload) {
  const parts = changedParts(payload.change);
  return `O racha de ${civilPhrase(payload.eventDate)} mudou: agora ${parts}`;
}
function credit(payload) {
  if (payload.amountCents === undefined)
    throw invalid2();
  return `Você ganhou ${applyBrlMask(String(payload.amountCents))} de Crédito, válido até ${dayMonth(payload.validUntil)}`;
}
function notificationText(n) {
  switch (n.kind) {
    case "join_request":
      return `${actor(n.actorName)} pediu para entrar`;
    case "join_approved":
      return `Você entrou no ${n.rachaName}`;
    case "join_refused":
      return "Seu pedido para entrar foi recusado";
    case "event_created":
      if (!n.payload.place)
        throw invalid2();
      return `Novo racha: ${civilPhrase(n.payload.eventDate)}, ${formatClock(n.payload.eventTime)}, na ${n.payload.place}`;
    case "event_changed":
      return eventChanged(n.payload);
    case "event_cancelled":
      return `O racha de ${civilPhrase(n.payload.eventDate)} foi cancelado`;
    case "sort_confirmed":
      if (n.payload.team === undefined)
        throw invalid2();
      return `Sorteio feito: você está no Time ${n.payload.team}`;
    case "team_changed":
      if (n.payload.team === undefined)
        throw invalid2();
      return `Agora você está no Time ${n.payload.team}`;
    case "role_changed":
      if (n.payload.role === "ADMIN")
        return "Você agora é Admin";
      if (n.payload.role === "PLAYER")
        return "Você agora é Jogador";
      throw invalid2();
    case "expelled":
      return "Você foi removido do Racha";
    case "ownership_transferred":
      return "Você agora é o Dono do Racha";
    case "conduction_taken":
      return `${actor(n.actorName)} assumiu a condução`;
    case "waitlist_promoted":
      return `Abriu vaga: sua Presença no ${civilPhrase(n.payload.eventDate)} está confirmada`;
    case "credit_created":
      return credit(n.payload);
    default: {
      const unreachable = n.kind;
      return unreachable;
    }
  }
}

// packages/domain/src/notification/push.ts
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function message(item) {
  if (!isObject(item))
    throw new Error(NOTIFICATION_PAYLOAD_INVALID);
  const { token, badge } = item;
  if (typeof token !== "string" || !Number.isInteger(badge)) {
    throw new Error(NOTIFICATION_PAYLOAD_INVALID);
  }
  const [notification] = parseNotifications([item.notification]);
  if (notification === undefined)
    throw new Error(NOTIFICATION_PAYLOAD_INVALID);
  return {
    to: token,
    title: notification.rachaName,
    body: notificationText(notification),
    data: { notificationId: notification.id },
    badge,
    sound: "default",
    channelId: "default",
    priority: "high"
  };
}
function itemId(item) {
  if (isObject(item) && isObject(item.notification)) {
    const { id } = item.notification;
    if (typeof id === "string")
      return id;
  }
  return "unknown";
}
function buildPushMessages(json) {
  const messages = [];
  const skippedIds = [];
  for (const item of Array.isArray(json) ? json : []) {
    try {
      messages.push(message(item));
    } catch {
      skippedIds.push(itemId(item));
    }
  }
  return { messages, skippedIds };
}
function deadPushTokens(messages, tickets) {
  if (!Array.isArray(tickets))
    return [];
  return messages.filter((_, index) => {
    const ticket = tickets[index];
    return isObject(ticket) && ticket.status === "error" && isObject(ticket.details) && ticket.details.error === "DeviceNotRegistered";
  }).map((m) => m.to);
}
export {
  buildPushMessages,
  deadPushTokens
};
