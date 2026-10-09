import { applyBrlMask } from "../format/brl-mask";
import { formatResenhaCivilDate } from "../resenha/resenha";
import { NOTIFICATION_PAYLOAD_INVALID } from "./parse";
import type {
  TNotification,
  TNotificationChange,
  TNotificationFamily,
  TNotificationKind,
  TNotificationPayload,
} from "./types";

const invalid = () => new Error(NOTIFICATION_PAYLOAD_INVALID);

function civilPhrase(isoDate: string | undefined): string {
  if (!isoDate) throw invalid();
  // Reusa a data da Resenha para não manter outra tabela de dias da semana.
  const formatted = formatResenhaCivilDate(isoDate);
  return `${formatted.weekdayShort} ${formatted.dayMonth}`;
}

// HH24:MI (ou com segundos). O zero da hora sai; o dos minutos fica, senão
// 9h05 viraria 9h5.
function formatClock(value: string | undefined): string {
  if (!value) throw invalid();
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  const hourText = match?.[1];
  const minute = match?.[2];
  if (hourText === undefined || minute === undefined) throw invalid();
  const hour = Number(hourText);
  if (hour > 23 || Number(minute) > 59) throw invalid();
  if (minute === "00") return `${hour}h`;
  return `${hour}h${minute}`;
}

// valid_until já é YYYY-MM-DD civil. Recortar o texto evita o fuso do processo.
function dayMonth(isoDate: string | undefined): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw invalid();
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

function actor(name: string | null): string {
  if (!name) throw invalid();
  return name;
}

function changedParts(change: TNotificationChange | undefined): string {
  if (!change) throw invalid();
  const parts: string[] = [];
  if (change.date) parts.push(civilPhrase(change.date));
  if (change.time) parts.push(formatClock(change.time));
  if (change.place) parts.push(`na ${change.place}`);
  return parts.join(", ");
}

// O prefixo é a data de antes da edição. change.date, quando vem, é a nova.
function eventChanged(payload: TNotificationPayload): string {
  const parts = changedParts(payload.change);
  return `O racha de ${civilPhrase(payload.eventDate)} mudou: agora ${parts}`;
}

function credit(payload: TNotificationPayload): string {
  if (payload.amountCents === undefined) throw invalid();
  // A chave JSON segue amount_cents, mas o crédito no banco é real inteiro
  // (diária 20 é R$ 20). Dividir por 100 zerava a frase.
  return `Você ganhou ${applyBrlMask(String(payload.amountCents))} de Crédito, válido até ${dayMonth(payload.validUntil)}`;
}

export function notificationText(n: TNotification): string {
  switch (n.kind) {
    case "join_request":
      return `${actor(n.actorName)} pediu para entrar`;
    case "join_approved":
      return `Você entrou no ${n.rachaName}`;
    case "join_refused":
      return "Seu pedido para entrar foi recusado";
    case "event_created":
      if (!n.payload.place) throw invalid();
      return `Novo racha: ${civilPhrase(n.payload.eventDate)}, ${formatClock(n.payload.eventTime)}, na ${n.payload.place}`;
    case "event_changed":
      return eventChanged(n.payload);
    case "event_cancelled":
      return `O racha de ${civilPhrase(n.payload.eventDate)} foi cancelado`;
    case "sort_confirmed":
      if (n.payload.team === undefined) throw invalid();
      return `Sorteio feito: você está no Time ${n.payload.team}`;
    case "team_changed":
      if (n.payload.team === undefined) throw invalid();
      return `Agora você está no Time ${n.payload.team}`;
    case "role_changed":
      if (n.payload.role === "ADMIN") return "Você agora é Admin";
      if (n.payload.role === "PLAYER") return "Você agora é Jogador";
      throw invalid();
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
      const unreachable: never = n.kind;
      return unreachable;
    }
  }
}

export function notificationFamily(
  kind: TNotificationKind
): TNotificationFamily {
  switch (kind) {
    case "join_request":
    case "join_approved":
    case "join_refused":
    case "role_changed":
    case "expelled":
    case "ownership_transferred":
      return "racha";
    case "event_created":
    case "event_changed":
    case "event_cancelled":
    case "waitlist_promoted":
      return "event";
    case "sort_confirmed":
    case "team_changed":
    case "conduction_taken":
      return "team";
    case "credit_created":
      return "money";
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}
