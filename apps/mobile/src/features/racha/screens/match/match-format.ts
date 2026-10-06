import type {
  TEventMatch,
  TMatchCardEvent,
  TMatchEvent,
  TMatchGoal,
  TYellowCardMode,
} from "@meu-racha/domain";
import {
  MATCH_CARD_RED,
  MATCH_CARD_YELLOW,
  MATCH_CARD_MARK_DETAIL,
  MATCH_CARD_MARK_KEEPER_DETAIL,
  minutesOut,
  matchCardEventDirect,
  matchCardEventKeeper,
  matchCardEventSecond,
  MATCH_EVENT_INCLUSION,
  MATCH_EVENT_LEAVE,
  MATCH_EVENT_REINFORCEMENT,
  MATCH_EVENT_RETURN,
  MATCH_LEFT_BY_SELF,
  matchEventEnterText,
  matchEventLeaveText,
  matchEventReinforceDetail,
  matchEventReinforceText,
  matchTeamPlaysWith,
  sortTeamTitle,
} from "../../utils/racha-messages";
import type { TMatchHistoryItem } from "./match-history";
import type { TMatchKeeperQueueRow, TMatchTeamQueueRow } from "./match-queue";

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatOvertime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `+${minutes}:${String(rest).padStart(2, "0")}`;
}

function spokenMinutes(minutes: number): string {
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

function spokenSeconds(seconds: number): string {
  return seconds === 1 ? "1 segundo" : `${seconds} segundos`;
}

export function spokenClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return spokenSeconds(seconds);
  if (seconds === 0) return spokenMinutes(minutes);
  return `${spokenMinutes(minutes)} e ${spokenSeconds(seconds)}`;
}

export function spokenMatchClock(input: {
  main: number;
  overtime: number | null;
  isPaused: boolean;
  durationMin: number | null;
}): string {
  const parts = [spokenClock(input.main)];
  if (input.overtime != null) {
    parts.push(`acréscimo ${spokenClock(input.overtime)}`);
  } else if (input.durationMin != null) {
    parts.push(`duração ${spokenMinutes(input.durationMin)}`);
  }
  if (input.isPaused) parts.push("pausado");
  return parts.join(". ");
}

/** Texto lido pelo leitor de tela: o ícone da bola e da chuteira não carrega sentido sozinho. */
export function goalLine(goal: TMatchGoal): string {
  const team = sortTeamTitle(goal.teamNumber);
  if (goal.isOwnGoal) return `Gol contra · ${team}`;
  const scorer = goal.scorer?.displayName ?? "Gol";
  const assist = goal.assist ? ` (${goal.assist.displayName})` : "";
  return `${scorer}${assist} · ${team}`;
}

/** Linhas da lista: autor com o Time e, em baixo, a assistência (quando houver). */
export function goalParts(goal: TMatchGoal): {
  scorer: string;
  assist: string | null;
} {
  const team = sortTeamTitle(goal.teamNumber);
  return {
    scorer: goal.isOwnGoal
      ? `Gol contra · ${team}`
      : `${goal.scorer?.displayName ?? "Gol"} · ${team}`,
    assist: goal.assist?.displayName ?? null,
  };
}

export type TRosterEventCopy = {
  title: string;
  text: string;
  detail: string | null;
  label: string;
};

/** Textos de Últimos lances para o cartão. O apagar usa `label` sem o detalhe. */
export function cardEventCopy(
  event: TMatchCardEvent,
  yellow: { mode: TYellowCardMode; outMin: number }
) {
  const title = event.color === "yellow" ? MATCH_CARD_YELLOW : MATCH_CARD_RED;
  const text = `${event.person.displayName} · ${sortTeamTitle(event.teamNumber)}`;
  const detail =
    event.color === "yellow"
      ? yellow.mode === "mark"
        ? event.isGoalkeeper
          ? MATCH_CARD_MARK_KEEPER_DETAIL
          : MATCH_CARD_MARK_DETAIL
        : event.isGoalkeeper
          ? matchCardEventKeeper(yellow.outMin)
          : minutesOut(yellow.outMin)
      : event.redReason === "secondYellow"
        ? matchCardEventSecond
        : matchCardEventDirect;
  return {
    title,
    text,
    detail,
    label: `${title} · ${event.person.displayName} · ${sortTeamTitle(event.teamNumber)}`,
  };
}

/** Textos de Últimos lances para mudanças de elenco; Gol reusa goalLine. */
export function rosterEventCopy(
  event: Exclude<TMatchEvent, { kind: "goal" | "card" }>
): TRosterEventCopy {
  if (event.kind === "reinforcement") {
    const text = matchEventReinforceText(
      event.entered.displayName,
      event.toTeamNumber
    );
    const detail = matchEventReinforceDetail(
      event.fromTeamNumber,
      event.left.displayName
    );
    return {
      title: MATCH_EVENT_REINFORCEMENT,
      text,
      detail,
      label: `${MATCH_EVENT_REINFORCEMENT}: ${text}, ${detail}`,
    };
  }
  if (event.kind === "leave") {
    const text = matchEventLeaveText(
      event.person.displayName,
      event.teamNumber
    );
    const detail = event.reinforced
      ? null
      : event.bySelf
        ? MATCH_LEFT_BY_SELF
        : matchTeamPlaysWith(
            event.teamNumber,
            event.outfieldCount,
            event.capacity
          );
    return {
      title: MATCH_EVENT_LEAVE,
      text,
      detail,
      label: detail
        ? `${MATCH_EVENT_LEAVE}: ${text}, ${detail}`
        : `${MATCH_EVENT_LEAVE}: ${text}`,
    };
  }
  const title =
    event.kind === "inclusion" ? MATCH_EVENT_INCLUSION : MATCH_EVENT_RETURN;
  const text = matchEventEnterText(event.person.displayName, event.teamNumber);
  return {
    title,
    text,
    detail: null,
    label: `${title}: ${text}`,
  };
}

// 1 e 2 são o confronto (em campo ou o próximo); a fila de espera começa no 3
export function matchQueueRows(portrait: TEventMatch | undefined): {
  teams: TMatchTeamQueueRow[];
  keepers: TMatchKeeperQueueRow[];
} {
  return {
    teams: (portrait?.teams ?? [])
      .filter((team) => team.queueOrder > 2)
      .sort((a, b) => a.queueOrder - b.queueOrder)
      .map((team) => ({ ...team, position: team.queueOrder - 2 })),
    keepers: (portrait?.goalkeeperQueue ?? [])
      .slice()
      .sort((a, b) => a.queueOrder - b.queueOrder)
      .map((entry) => ({
        personId: entry.person.personId,
        name: entry.person.displayName,
        queueOrder: entry.queueOrder,
      })),
  };
}

// sem onCorrect, a lista só mostra (folha da fila); o hub passa a correção do Condutor
export function matchHistoryItems(
  portrait: TEventMatch | undefined,
  onCorrect: ((goalId: string) => void) | null
): TMatchHistoryItem[] {
  return (
    portrait?.finishedMatches.map((item) => ({
      id: item.id,
      number: item.number,
      homeNumber: item.home.teamNumber,
      awayNumber: item.away.teamNumber,
      homeScore: item.home.score,
      awayScore: item.away.score,
      goals: item.goals.map((goal) => ({
        id: goal.id,
        ...goalParts(goal),
        label: goalLine(goal),
        onCorrect: onCorrect ? () => onCorrect(goal.id) : null,
      })),
    })) ?? []
  );
}
