import {
  applyGoal,
  score,
  type Goal,
  type TEventMatch,
  type TMatchCardColor,
} from "@meu-racha/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rachaApi } from "../racha-api";
import { eventSortKey } from "./use-event-sort";
import { myRachaEventsKey } from "./use-my-racha-events";
import { openEventsKey } from "./use-open-events";
import { eventMatchKey } from "./use-event-match";

type TAddGoalVars = {
  matchId: string;
  teamId: string;
  scorerId?: string | null;
  assistId?: string | null;
  ownGoal?: boolean;
};

type TGoalMutateResult = { previous: TEventMatch | undefined };

function scoringTeamId(
  portrait: TEventMatch,
  teamId: string,
  ownGoal: boolean
) {
  if (!ownGoal || !portrait.match) return teamId;
  return teamId === portrait.match.home.teamId
    ? portrait.match.away.teamId
    : portrait.match.home.teamId;
}

/** Placar otimista: applyGoal do domínio; o retrato só muda o que o Gol altera. */
function applyGoalToPortrait(portrait: TEventMatch, goal: Goal): TEventMatch {
  if (!portrait.match) return portrait;
  const live = {
    id: portrait.match.id,
    seq: portrait.seq,
    homeTeamId: portrait.match.home.teamId,
    awayTeamId: portrait.match.away.teamId,
    goals: portrait.match.goals.map((item) => ({
      id: item.id,
      teamId: item.teamId,
      scorerId: item.scorer?.personId ?? null,
      assistById: item.assist?.personId ?? null,
    })),
  };
  const next = applyGoal(live, goal, portrait.seq + 1);
  const nextScore = score(next);
  const added = next.goals[next.goals.length - 1];
  if (!added || next.goals.length === live.goals.length) return portrait;
  return {
    ...portrait,
    seq: next.seq,
    events: [
      {
        kind: "goal" as const,
        id: added.id,
        requestKey: added.id,
        teamId: added.teamId,
        teamNumber:
          added.teamId === portrait.match.home.teamId
            ? portrait.match.home.teamNumber
            : portrait.match.away.teamNumber,
        isOwnGoal: added.scorerId == null,
        scorer: null,
        assist: null,
        concededGoalkeeper: null,
        createdAt: new Date().toISOString(),
      },
      ...portrait.events,
    ],
    match: {
      ...portrait.match,
      seq: next.seq,
      home: { ...portrait.match.home, score: nextScore.home },
      away: { ...portrait.match.away, score: nextScore.away },
      goals: [
        ...portrait.match.goals,
        {
          id: added.id,
          requestKey: added.id,
          teamId: added.teamId,
          teamNumber:
            added.teamId === portrait.match.home.teamId
              ? portrait.match.home.teamNumber
              : portrait.match.away.teamNumber,
          isOwnGoal: added.scorerId == null,
          scorer: null,
          assist: null,
          concededGoalkeeper: null,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  };
}

/**
 * Mutações da Partida. Só o Gol é otimista (applyGoal); o resto espera o banco.
 * onMutate/onError: TanStack Query 5.103.2 passa o retorno de onMutate como
 * onMutateResult no onError — é o retrato anterior para o rollback.
 */
export function useEventMatchActions(rachaId: string, eventId: string) {
  const queryClient = useQueryClient();
  const matchKey = eventMatchKey(rachaId, eventId);

  const settle = (_data: unknown, error: Error | null) => {
    const refresh = Promise.all([
      queryClient.invalidateQueries({ queryKey: matchKey }),
      queryClient.invalidateQueries({
        queryKey: eventSortKey(rachaId, eventId),
      }),
      queryClient.invalidateQueries({ queryKey: openEventsKey(rachaId) }),
      queryClient.invalidateQueries({ queryKey: myRachaEventsKey }),
    ]);
    // no erro, sem rede a recarga demora e prenderia o botão
    if (error) {
      void refresh;
      return;
    }
    return refresh;
  };

  const start = useMutation({
    mutationFn: (
      vars: {
        homeGoalkeeperId?: string | null;
        awayGoalkeeperId?: string | null;
      } = {}
    ) =>
      rachaApi.startEventMatch(
        eventId,
        vars.homeGoalkeeperId,
        vars.awayGoalkeeperId
      ),
    onSettled: settle,
  });

  const pause = useMutation({
    mutationFn: (matchId: string) => rachaApi.pauseEventMatch(matchId),
    onSettled: settle,
  });

  const resume = useMutation({
    mutationFn: (matchId: string) => rachaApi.resumeEventMatch(matchId),
    onSettled: settle,
  });

  const addGoal = useMutation({
    mutationFn: (vars: TAddGoalVars) =>
      rachaApi.addEventMatchGoal(vars.matchId, vars.teamId, {
        scorerId: vars.scorerId,
        assistId: vars.assistId,
        ownGoal: vars.ownGoal,
      }),
    onMutate: async (vars): Promise<TGoalMutateResult> => {
      await queryClient.cancelQueries({ queryKey: matchKey });
      const previous = queryClient.getQueryData<TEventMatch>(matchKey);
      if (previous?.match) {
        const teamId = scoringTeamId(
          previous,
          vars.teamId,
          Boolean(vars.ownGoal)
        );
        queryClient.setQueryData(
          matchKey,
          applyGoalToPortrait(previous, {
            id: String(Date.now()) + Math.random(),
            teamId,
            scorerId: vars.ownGoal ? null : (vars.scorerId ?? null),
            assistById: vars.ownGoal ? null : (vars.assistId ?? null),
          })
        );
      }
      return { previous };
    },
    onError: (_error, _vars, onMutateResult) => {
      if (onMutateResult?.previous) {
        queryClient.setQueryData(matchKey, onMutateResult.previous);
      }
    },
    onSettled: settle,
  });

  const updateGoal = useMutation({
    mutationFn: (vars: {
      goalId: string;
      scorerId: string;
      assistId?: string | null;
    }) =>
      rachaApi.updateEventMatchGoal(vars.goalId, vars.scorerId, vars.assistId),
    onSettled: settle,
  });

  const addCard = useMutation({
    mutationFn: (vars: {
      matchId: string;
      profileId: string | null;
      guestId: string | null;
      color: TMatchCardColor;
    }) =>
      rachaApi.addEventMatchCard(
        vars.matchId,
        { profileId: vars.profileId, guestId: vars.guestId },
        vars.color
      ),
    onSettled: settle,
  });

  const deleteCard = useMutation({
    mutationFn: (cardId: string) => rachaApi.deleteEventMatchCard(cardId),
    onSettled: settle,
  });

  const deleteGoal = useMutation({
    mutationFn: (goalId: string) => rachaApi.deleteEventMatchGoal(goalId),
    onSettled: settle,
  });

  const swapGoalkeeper = useMutation({
    mutationFn: (vars: {
      matchId: string;
      teamId: string;
      goalkeeperId: string;
    }) =>
      rachaApi.swapEventMatchGoalkeeper(
        vars.matchId,
        vars.teamId,
        vars.goalkeeperId
      ),
    onSettled: settle,
  });

  const previewFinish = useMutation({
    mutationFn: (vars: { matchId: string; penaltyWinnerId?: string | null }) =>
      rachaApi.previewFinishEventMatch(vars.matchId, vars.penaltyWinnerId),
    onSettled: settle,
  });

  const finish = useMutation({
    mutationFn: (vars: { matchId: string; penaltyWinnerId?: string | null }) =>
      rachaApi.finishEventMatch(vars.matchId, vars.penaltyWinnerId),
    onSettled: settle,
  });

  const discard = useMutation({
    mutationFn: (matchId: string) => rachaApi.discardEventMatch(matchId),
    onSettled: settle,
  });

  const reinforce = useMutation({
    mutationFn: (vars: {
      matchId: string;
      profileId?: string | null;
      guestId?: string | null;
      donorTeamId?: string | null;
    }) => rachaApi.reinforceEventMatch(vars),
    onSettled: settle,
  });

  return {
    startEventMatch: start.mutateAsync,
    pauseEventMatch: pause.mutateAsync,
    resumeEventMatch: resume.mutateAsync,
    addEventMatchGoal: addGoal.mutateAsync,
    updateEventMatchGoal: updateGoal.mutateAsync,
    addEventMatchCard: addCard.mutateAsync,
    deleteEventMatchCard: deleteCard.mutateAsync,
    deleteEventMatchGoal: deleteGoal.mutateAsync,
    swapEventMatchGoalkeeper: swapGoalkeeper.mutateAsync,
    previewFinishEventMatch: previewFinish.mutateAsync,
    finishEventMatch: finish.mutateAsync,
    discardEventMatch: discard.mutateAsync,
    reinforceEventMatch: reinforce.mutateAsync,
  };
}
