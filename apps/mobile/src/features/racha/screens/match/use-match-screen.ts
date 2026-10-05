import {
  matchElapsedSeconds,
  serverOffsetMs,
  splitOvertime,
  type TMatchPerson,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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
  conductorName,
  MATCH_CONDUCTOR_OFFLINE,
  MATCH_LEAVE_REINFORCE,
  MATCH_MY_TEAM_NEXT,
  MATCH_QUEUE_EMPTY,
  MATCH_OFFLINE,
  MATCH_TAP_GOAL,
  SORT_NOT_CONDUCTOR,
  matchFailureMessage,
  matchMyTeamPosition,
  matchQueueStrip,
  matchSelfLeftTitle,
  matchSwapKeeperOf,
  matchTeamNowWith,
  sortTeamTitle,
} from "../../utils/racha-messages";
import {
  formatClock,
  formatOvertime,
  goalLine,
  goalParts,
  matchHistoryItems,
  matchQueueRows,
  rosterEventCopy,
  spokenMatchClock,
} from "./match-format";
import type { TMatchEventRow } from "./match-event-list";
import { pendingKeepersKey, type TPendingKeepers } from "./pending-keepers";

const vibratedMatches = new Set<string>();

function isNetworkError(error: unknown): boolean {
  return error instanceof Error && error.message === "network_error";
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
  const matchId = match?.id ?? null;

  useEffect(() => {
    if (!canConduct || !matchId || portrait?.durationMin == null) return;
    if (split.overtime == null) return;
    if (vibratedMatches.has(matchId)) return;
    vibratedMatches.add(matchId);
    Vibration.vibrate();
  }, [canConduct, matchId, portrait?.durationMin, split.overtime]);

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

  return {
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
