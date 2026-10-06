import {
  isExpelled,
  matchElapsedSeconds,
  runningYellows,
  serverOffsetMs,
  splitOvertime,
  yellowOutSeconds,
  yellowRemaining,
  type TMatchPerson,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Vibration } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth";
import { useToast } from "@/ui/components";
import { useEventMatch } from "../../hooks/use-event-match";
import { useEventMatchActions } from "../../hooks/use-event-match-actions";
import { useEventMatchLive } from "../../hooks/use-event-match-live";
import { useEventSort } from "../../hooks/use-event-sort";
import { useOpenEvents } from "../../hooks/use-open-events";
import {
  BOLINHAS_REMINDER_ACTION,
  BOLINHAS_REMINDER_TEXT,
  bolinhasReminderTitle,
  bolinhasReminderTitleMany,
  conductorName,
  MATCH_CONDUCTOR_OFFLINE,
  MATCH_LEAVE_REINFORCE,
  MATCH_MY_TEAM_NEXT,
  MATCH_QUEUE_EMPTY,
  MATCH_OFFLINE,
  MATCH_TAP_GOAL,
  SORT_NOT_CONDUCTOR,
  matchCardBack,
  matchCardPillA11y,
  matchFailureMessage,
  matchMyTeamPosition,
  matchQueueStrip,
  matchSelfLeftTitle,
  matchSwapKeeperOf,
  matchTeamNowWith,
  sortTeamTitle,
} from "../../utils/racha-messages";
import {
  cardEventCopy,
  formatClock,
  formatOvertime,
  goalLine,
  goalParts,
  matchHistoryItems,
  matchQueueRows,
  rosterEventCopy,
  spokenClock,
  spokenMatchClock,
} from "./match-format";
import type { TMatchCardPill } from "./match-card-strip";
import type { TMatchEventRow } from "./match-event-list";
import { pendingKeepersKey, type TPendingKeepers } from "./pending-keepers";

const vibratedMatches = new Set<string>();
const seenRunningYellowIds = new Set<string>();
const announcedCardBackIds = new Set<string>();

const CARD_BACK_MS = 10_000;

type TCardBackPill = {
  id: string;
  name: string;
  team: string;
  label: string;
  hideAt: number;
};

// A pílula "pode voltar" vive fora do React: o efeito só avisa o relógio de
// parede e a vibração. useSyncExternalStore assina a lista; setState no
// efeito é o que o lint recusa.
let cardBackSnapshot: TCardBackPill[] = [];
const cardBackListeners = new Set<() => void>();

function subscribeCardBacks(listener: () => void) {
  cardBackListeners.add(listener);
  return () => {
    cardBackListeners.delete(listener);
  };
}

function getCardBackSnapshot() {
  return cardBackSnapshot;
}

function publishCardBack(pill: TCardBackPill) {
  if (cardBackSnapshot.some((item) => item.id === pill.id)) return;
  cardBackSnapshot = [pill, ...cardBackSnapshot];
  for (const listener of cardBackListeners) listener();
}

function isNetworkError(error: unknown): boolean {
  return error instanceof Error && error.message === "network_error";
}

function teamNumberOf(
  match: {
    home: { teamId: string; teamNumber: number };
    away: { teamId: string; teamNumber: number };
  },
  teamId: string
) {
  return teamId === match.home.teamId
    ? match.home.teamNumber
    : match.away.teamNumber;
}

function keeperName(
  person: TMatchPerson | null,
  pendingId: string | undefined,
  queue: { person: TMatchPerson }[]
): string | null {
  if (pendingId) {
    const found = queue.find((entry) => entry.person.personId === pendingId);
    if (found) return found.person.displayName;
  }
  return person?.displayName ?? null;
}

export function useMatchScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const matchQuery = useEventMatch(id, eventId);
  const eventsQuery = useOpenEvents(id);
  const actions = useEventMatchActions(id, eventId);
  const { isConductorOffline } = useEventMatchLive(id, eventId);
  const { session } = useSession();
  const sortQuery = useEventSort(id, eventId);
  const pendingQuery = useQuery({
    queryKey: pendingKeepersKey(id, eventId),
    queryFn: async (): Promise<TPendingKeepers> => ({}),
    staleTime: Infinity,
    gcTime: Infinity,
    initialData: {},
  });

  const portrait = matchQuery.data;
  const event = eventsQuery.data?.find((item) => item.id === eventId);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const cardBacks = useSyncExternalStore(
    subscribeCardBacks,
    getCardBackSnapshot,
    getCardBackSnapshot
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [actionOffline, setActionOffline] = useState(false);
  const [lostConduct, setLostConduct] = useState(false);
  const [wasConductor, setWasConductor] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const canConduct = Boolean(portrait?.viewer.canConduct);
  if (canConduct && !wasConductor) {
    setWasConductor(true);
  }

  const isOffline =
    actionOffline || (matchQuery.isError && isNetworkError(matchQuery.error));

  const offset = portrait
    ? serverOffsetMs(portrait.serverNow, matchQuery.dataUpdatedAt)
    : 0;
  const elapsed = portrait
    ? matchElapsedSeconds(
        {
          startedAt: portrait.startedAt,
          pausedAt: portrait.pausedAt,
          pausedSeconds: portrait.pausedSeconds,
        },
        nowMs + offset
      )
    : 0;
  const split = splitOvertime(elapsed, portrait?.durationMin ?? null);
  const isPaused = portrait?.pausedAt != null;
  const match = portrait?.match ?? null;
  // Advertência: 0 s, o amarelo nunca corre (sem faixa, vibração nem "pode voltar")
  const outSeconds = portrait
    ? yellowOutSeconds(portrait.yellowCardMode, portrait.yellowOutMin)
    : 0;
  const matchId = match?.id ?? null;

  useEffect(() => {
    if (!canConduct || !matchId || portrait?.durationMin == null) return;
    if (split.overtime == null) return;
    if (vibratedMatches.has(matchId)) return;
    vibratedMatches.add(matchId);
    Vibration.vibrate();
  }, [canConduct, matchId, portrait?.durationMin, split.overtime]);

  useEffect(() => {
    if (!match) return;
    for (const card of runningYellows(match.cards, elapsed, outSeconds)) {
      if (isExpelled(match.cards, card.person.personId)) continue;
      seenRunningYellowIds.add(card.id);
    }
    if (isPaused) return;
    for (const card of match.cards) {
      if (card.color !== "yellow") continue;
      if (isExpelled(match.cards, card.person.personId)) continue;
      if (yellowRemaining(card, elapsed, outSeconds) > 0) continue;
      if (!seenRunningYellowIds.has(card.id)) continue;
      const teamNumber = teamNumberOf(match, card.teamId);
      const backText = matchCardBack(
        card.person.displayName,
        card.isGoalkeeper
      );
      if (!announcedCardBackIds.has(card.id)) {
        announcedCardBackIds.add(card.id);
        if (canConduct) {
          Vibration.vibrate();
          showToast(backText, "success");
        }
      }
      publishCardBack({
        id: card.id,
        name: backText,
        team: sortTeamTitle(teamNumber),
        label: `${backText}, ${sortTeamTitle(teamNumber)}`,
        hideAt: nowMs + CARD_BACK_MS,
      });
    }
  }, [canConduct, elapsed, isPaused, match, nowMs, outSeconds, showToast]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    if (busy || isOffline || !canConduct) return;
    setBusy(key);
    try {
      await fn();
      setActionOffline(false);
    } catch (error) {
      if (isNetworkError(error)) setActionOffline(true);
      if (error instanceof Error && error.message === "not_conductor") {
        setLostConduct(true);
      }
      showToast(matchFailureMessage(error), "danger");
    } finally {
      setBusy(null);
    }
  };

  const pending = pendingQuery.data ?? {};
  const queue = portrait?.goalkeeperQueue ?? [];
  const queueRows = matchQueueRows(portrait);

  // o Time da sessão vem dos Times publicados; a fila da Partida só traz número e ordem
  const published =
    sortQuery.data?.state === "published" ? sortQuery.data : null;
  const myTeamNumber = published?.teams.find(
    (team) =>
      team.isActive &&
      team.players.some((player) => player.profileId === session?.userId)
  )?.teamNumber;
  const myRow = queueRows.teams.find(
    (team) => team.teamNumber === myTeamNumber
  );
  const [nextTeam, afterTeam] = queueRows.teams;
  const queueStripText = myRow
    ? myRow.position === 1
      ? MATCH_MY_TEAM_NEXT
      : matchMyTeamPosition(myRow.position)
    : nextTeam
      ? matchQueueStrip(nextTeam, afterTeam ?? null)
      : MATCH_QUEUE_EMPTY;

  const openGoal = (teamId: string) => {
    router.push(`/racha/${id}/event/${eventId}/match-goal?teamId=${teamId}`);
  };
  const openCorrect = (goalId: string) => {
    router.push(`/racha/${id}/event/${eventId}/match-goal?goalId=${goalId}`);
  };
  const openKeeper = (teamId: string) => {
    router.push(
      `/racha/${id}/event/${eventId}/match-goalkeeper?teamId=${teamId}`
    );
  };
  const openRoster = (teamId: string) => {
    router.push(`/racha/${id}/event/${eventId}/match-roster?teamId=${teamId}`);
  };
  const openReinforcement = (
    teamId: string,
    profileId: string | null,
    guestId: string | null,
    displayName: string
  ) => {
    const query = profileId ? `profileId=${profileId}` : `guestId=${guestId}`;
    router.push(
      `/racha/${id}/event/${eventId}/match-reinforcement?teamId=${teamId}&${query}&name=${encodeURIComponent(displayName)}`
    );
  };

  const assumedLine =
    lostConduct || (wasConductor && !canConduct)
      ? event?.conductorName
        ? conductorName(event.conductorName)
        : SORT_NOT_CONDUCTOR
      : null;

  const homeTeam = match
    ? sortTeamTitle(match.home.teamNumber)
    : portrait?.nextMatch
      ? sortTeamTitle(portrait.nextMatch.home.teamNumber)
      : "";
  const awayTeam = match
    ? sortTeamTitle(match.away.teamNumber)
    : portrait?.nextMatch
      ? sortTeamTitle(portrait.nextMatch.away.teamNumber)
      : "";

  const events: TMatchEventRow[] =
    (portrait?.events ?? []).map((event) => {
      if (event.kind === "goal") {
        return {
          kind: "goal" as const,
          id: event.id,
          ...goalParts(event),
          label: goalLine(event),
          onDelete:
            canConduct && !isOffline
              ? () =>
                  void run(`delete:${event.id}`, () =>
                    actions.deleteEventMatchGoal(event.id)
                  )
              : null,
        };
      }
      if (event.kind === "card") {
        const copy = cardEventCopy(event, {
          mode: portrait?.yellowCardMode ?? "timed",
          outMin: portrait?.yellowOutMin ?? 2,
        });
        return {
          kind: "card" as const,
          id: event.id,
          color: event.color,
          ...copy,
          onDelete:
            canConduct && !isOffline && match?.status === "open"
              ? () =>
                  void run(`delete-card:${event.id}`, () =>
                    actions.deleteEventMatchCard(event.id)
                  )
              : null,
        };
      }
      const copy = rosterEventCopy(event);
      return {
        kind: "roster" as const,
        id: event.id,
        ...copy,
        icon:
          event.kind === "leave"
            ? ("leave" as const)
            : event.kind === "return"
              ? ("users" as const)
              : ("user-plus" as const),
      };
    }) ?? [];

  const history = matchHistoryItems(
    portrait,
    canConduct && !isOffline ? openCorrect : null
  );

  // B2: o próximo confronto tem Time incompleto; só lembra, Iniciar segue livre
  const incompleteNext =
    canConduct && !match && published && portrait?.nextMatch
      ? [portrait.nextMatch.home, portrait.nextMatch.away].flatMap((side) => {
          const team = published.teams.find(
            (item) => item.teamNumber === side.teamNumber
          );
          return team && team.players.length < published.outfieldPerTeam
            ? [{ number: team.teamNumber, count: team.players.length }]
            : [];
        })
      : [];
  const bolinhasReminder =
    published && incompleteNext.length > 0
      ? {
          title:
            incompleteNext.length === 1
              ? bolinhasReminderTitle(
                  incompleteNext[0]!.number,
                  incompleteNext[0]!.count,
                  published.outfieldPerTeam
                )
              : bolinhasReminderTitleMany(incompleteNext.map((t) => t.number)),
          text: BOLINHAS_REMINDER_TEXT,
          actionLabel: BOLINHAS_REMINDER_ACTION,
          // leva à tela de Times, não direto às Bolinhas
          onAction: () => router.push(`/racha/${id}/event/${eventId}/sort`),
        }
      : null;

  return {
    bolinhasReminder,
    isLoading: matchQuery.isPending,
    loadErrorText:
      matchQuery.isError && !portrait
        ? matchFailureMessage(matchQuery.error)
        : null,
    isRetrying: matchQuery.isRefetching,
    retry: () => {
      setActionOffline(false);
      void matchQuery.refetch();
    },
    notices: {
      offline: canConduct && isOffline ? MATCH_OFFLINE : null,
      conductorOffline:
        !canConduct && isConductorOffline ? MATCH_CONDUCTOR_OFFLINE : null,
      assumed: !canConduct ? assumedLine : null,
      // sem Time na fila para ceder, o aviso levaria a uma lista vazia
      pending:
        canConduct && match && (portrait?.reinforcementDonors.length ?? 0) > 0
          ? (portrait?.pendingReinforcements ?? []).map((item) => {
              const side =
                item.teamId === match.home.teamId ? match.home : match.away;
              const queryPerson = item.person;
              return {
                key: `${item.teamId}:${queryPerson.personId}`,
                title: matchSelfLeftTitle(
                  queryPerson.displayName,
                  item.teamNumber
                ),
                text: matchTeamNowWith(
                  item.teamNumber,
                  side.outfieldCount,
                  side.capacity
                ),
                actionLabel: MATCH_LEAVE_REINFORCE,
                onAction: () =>
                  openReinforcement(
                    item.teamId,
                    queryPerson.profileId,
                    queryPerson.guestId,
                    queryPerson.displayName
                  ),
              };
            })
          : [],
    },
    open:
      portrait?.state === "open" && match
        ? {
            queueStrip: {
              text: queueStripText,
              isMine: Boolean(myRow),
              onPress: () =>
                router.push(`/racha/${id}/event/${eventId}/match-queue`),
            },
            clock: {
              mainLabel: formatClock(split.main),
              overtimeLabel:
                split.overtime == null ? null : formatOvertime(split.overtime),
              durationLabel:
                portrait.durationMin == null
                  ? null
                  : formatClock(portrait.durationMin * 60),
              accessibilityLabel: spokenMatchClock({
                main: split.main,
                overtime: split.overtime,
                isPaused,
                durationMin: portrait.durationMin,
              }),
              isPaused,
              isOvertime: split.overtime != null,
              showPause: canConduct,
              isPauseDisabled: isOffline,
              isPauseBusy: busy === "pause",
              onTogglePause: () =>
                void run("pause", () =>
                  isPaused
                    ? actions.resumeEventMatch(match.id)
                    : actions.pauseEventMatch(match.id)
                ),
            },
            cardPills: [
              ...cardBacks
                .filter((pill) => {
                  const card = match.cards.find((item) => item.id === pill.id);
                  return (
                    pill.hideAt > nowMs &&
                    card != null &&
                    !isExpelled(match.cards, card.person.personId)
                  );
                })
                .map((pill): TMatchCardPill => ({
                  key: `back:${pill.id}`,
                  name: pill.name,
                  team: pill.team,
                  kind: "back",
                  remaining: null,
                  isPaused: false,
                  label: pill.label,
                })),
              ...runningYellows(match.cards, elapsed, outSeconds)
                .filter(
                  (card) => !isExpelled(match.cards, card.person.personId)
                )
                .map((card): TMatchCardPill => {
                  const remaining = yellowRemaining(card, elapsed, outSeconds);
                  const teamNumber = teamNumberOf(match, card.teamId);
                  return {
                    key: card.id,
                    name: card.isGoalkeeper
                      ? `${card.person.displayName} (gol)`
                      : card.person.displayName,
                    team: sortTeamTitle(teamNumber),
                    kind: "yellow",
                    remaining: formatClock(remaining),
                    isPaused,
                    label: matchCardPillA11y(
                      card.person.displayName,
                      teamNumber,
                      spokenClock(remaining),
                      isPaused
                    ),
                  };
                }),
            ],
            scoreboard: {
              home: {
                teamLabel: homeTeam,
                score: match.home.score,
                accessibilityLabel: `${homeTeam} ${match.home.score}${canConduct ? `. ${MATCH_TAP_GOAL}` : ""}`,
                onPress:
                  canConduct && !isOffline
                    ? () => openGoal(match.home.teamId)
                    : null,
              },
              away: {
                teamLabel: awayTeam,
                score: match.away.score,
                accessibilityLabel: `${awayTeam} ${match.away.score}${canConduct ? `. ${MATCH_TAP_GOAL}` : ""}`,
                onPress:
                  canConduct && !isOffline
                    ? () => openGoal(match.away.teamId)
                    : null,
              },
            },
            swapHome:
              canConduct && !isOffline
                ? {
                    label: matchSwapKeeperOf(homeTeam),
                    onPress: () => openKeeper(match.home.teamId),
                  }
                : null,
            swapAway:
              canConduct && !isOffline
                ? {
                    label: matchSwapKeeperOf(awayTeam),
                    onPress: () => openKeeper(match.away.teamId),
                  }
                : null,
            rosters:
              canConduct && !isOffline
                ? {
                    home: {
                      teamNumber: match.home.teamNumber,
                      count: match.home.outfieldCount,
                      capacity: match.home.capacity,
                      onPress: () => openRoster(match.home.teamId),
                    },
                    away: {
                      teamNumber: match.away.teamNumber,
                      count: match.away.outfieldCount,
                      capacity: match.away.capacity,
                      onPress: () => openRoster(match.away.teamId),
                    },
                  }
                : null,
            events,
            footer: canConduct
              ? {
                  isDisabled: isOffline || busy !== null,
                  onFinish: () =>
                    router.push(`/racha/${id}/event/${eventId}/match-finish`),
                  onDiscard: () =>
                    router.push(`/racha/${id}/event/${eventId}/match-discard`),
                }
              : null,
          }
        : null,
    ready:
      portrait?.state === "ready" && portrait.nextMatch
        ? {
            home: {
              teamId: portrait.nextMatch.home.teamId,
              teamNumber: portrait.nextMatch.home.teamNumber,
              keeperName: keeperName(
                portrait.nextMatch.home.goalkeeper,
                pending[portrait.nextMatch.home.teamId],
                queue
              ),
              isComplete: portrait.nextMatch.home.isComplete,
              onSwapKeeper:
                canConduct && !isOffline
                  ? () => openKeeper(portrait.nextMatch!.home.teamId)
                  : null,
            },
            away: {
              teamId: portrait.nextMatch.away.teamId,
              teamNumber: portrait.nextMatch.away.teamNumber,
              keeperName: keeperName(
                portrait.nextMatch.away.goalkeeper,
                pending[portrait.nextMatch.away.teamId],
                queue
              ),
              isComplete: portrait.nextMatch.away.isComplete,
              onSwapKeeper:
                canConduct && !isOffline
                  ? () => openKeeper(portrait.nextMatch!.away.teamId)
                  : null,
            },
            isRematch: portrait.nextMatch.isRematch,
            canStart: canConduct,
            isStartDisabled: isOffline,
            isStartBusy: busy === "start",
            onStart: () =>
              void run("start", async () => {
                const next = pendingQuery.data ?? {};
                await actions.startEventMatch({
                  homeGoalkeeperId:
                    next[portrait.nextMatch!.home.teamId] ?? null,
                  awayGoalkeeperId:
                    next[portrait.nextMatch!.away.teamId] ?? null,
                });
                queryClient.setQueryData(pendingKeepersKey(id, eventId), {});
              }),
          }
        : null,
    noNext: Boolean(portrait?.state === "ready" && !portrait.nextMatch),
    queue: queueRows,
    history,
  };
}
