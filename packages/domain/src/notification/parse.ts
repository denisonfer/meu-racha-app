import type {
  TNotification,
  TNotificationChange,
  TNotificationPayload,
  TNotificationResolution,
} from "./types";
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_RESOLUTION_STATUSES,
  NOTIFICATION_ROLES,
  NOTIFICATION_TARGETS,
} from "./types";

// get_notifications devolve jsonb. Formato inesperado vira erro de código:
// a aba não monta Aviso pela metade.
export const NOTIFICATION_PAYLOAD_INVALID = "notification_payload_invalid";

type TObject = Record<string, unknown>;

const invalid = () => new Error(NOTIFICATION_PAYLOAD_INVALID);

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

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw invalid();
}

// O banco manda inteiro. 1.5 não é número de Time nem centavos de Crédito.
function int(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  throw invalid();
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  const text = str(value);
  const found = allowed.find((item) => item === text);
  if (found === undefined) throw invalid();
  return found;
}

// null é Evento ou autor ausente. Chave faltando é payload ruim: não
// inventamos um id vazio.
function strOrNull(raw: TObject, key: string): string | null {
  if (!(key in raw)) throw invalid();
  const value = raw[key];
  if (value == null) return null;
  return str(value);
}

function change(value: unknown): TNotificationChange {
  const raw = obj(value);
  const parsed: TNotificationChange = {};
  if ("date" in raw) parsed.date = str(raw.date);
  if ("time" in raw) parsed.time = str(raw.time);
  if ("place" in raw) parsed.place = str(raw.place);
  return parsed;
}

// resolution dentro do payload é snapshot da recusa. A RPC já copia isso
// para o campo do item e recalcula by_me de quem está lendo — usar o do
// payload faria a frase discordar da linha de status.
function payload(value: unknown): TNotificationPayload {
  const raw = obj(value);
  const parsed: TNotificationPayload = {};
  if ("event_date" in raw) parsed.eventDate = str(raw.event_date);
  if ("event_time" in raw) parsed.eventTime = str(raw.event_time);
  if ("place" in raw) parsed.place = str(raw.place);
  if ("team" in raw) parsed.team = int(raw.team);
  if ("role" in raw) parsed.role = oneOf(raw.role, NOTIFICATION_ROLES);
  if ("amount_cents" in raw) parsed.amountCents = int(raw.amount_cents);
  if ("valid_until" in raw) parsed.validUntil = str(raw.valid_until);
  if ("change" in raw) parsed.change = change(raw.change);
  return parsed;
}

function resolution(raw: TObject): TNotificationResolution | null {
  if (!("resolution" in raw)) throw invalid();
  const value = raw.resolution;
  if (value == null) return null;
  const body = obj(value);
  return {
    status: oneOf(body.status, NOTIFICATION_RESOLUTION_STATUSES),
    byName: str(body.by_name),
    byMe: bool(body.by_me),
  };
}

function notification(value: unknown): TNotification {
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
    target: oneOf(raw.target, NOTIFICATION_TARGETS),
  };
}

/** Retorno de get_notifications. Array vazio é quem não tem Aviso. */
export function parseNotifications(json: unknown): TNotification[] {
  return list(json).map(notification);
}
