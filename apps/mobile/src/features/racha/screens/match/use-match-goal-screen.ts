import type { TMatchItem, TMatchPerson } from "@meu-racha/domain";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useEventMatch } from "../../hooks/use-event-match";
import { useEventMatchActions } from "../../hooks/use-event-match-actions";
import {
  MATCH_ASSIST_TITLE,
  MATCH_NO_ASSIST,
  MATCH_OWN_GOAL,
  matchAssistHint,
  matchFailureMessage,
  matchGoalScorerTitle,
  sortTeamTitle,
} from "../../utils/racha-messages";

type TStep = "scorer" | "assist";

function rosterOf(
  match: TMatchItem,
  teamId: string,
  activeOnly: boolean
): TMatchPerson[] {
  const rows = match.lineup.filter(
    (entry) => entry.teamId === teamId && (!activeOnly || entry.leftAt == null)
  );
  const keepers = rows.filter((entry) => entry.role === "GOALKEEPER");
  const field = rows.filter((entry) => entry.role !== "GOALKEEPER");
  const seen = new Set<string>();
  return [...keepers, ...field]
    .map((entry) => entry.person)
    .filter((person) => {
      if (seen.has(person.personId)) return false;
      seen.add(person.personId);
      return true;
    });
}

function hostOf(
  goalId: string | undefined,
  open: TMatchItem | null,
  finished: TMatchItem[]
): TMatchItem | null {
  if (!goalId) return open;
  if (open?.goals.some((goal) => goal.id === goalId)) return open;
  return (
    finished.find((item) => item.goals.some((goal) => goal.id === goalId)) ??
    null
  );
}

export function useMatchGoalScreen() {
  const { id, eventId, teamId, goalId } = useLocalSearchParams<{
    id: string;
    eventId: string;
    teamId?: string;
    goalId?: string;
  }>();
  const matchQuery = useEventMatch(id, eventId);
  const actions = useEventMatchActions(id, eventId);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [step, setStep] = useState<TStep>("scorer");
  const [scorer, setScorer] = useState<TMatchPerson | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const portrait = matchQuery.data;
  const isEdit = Boolean(goalId);
  const host = hostOf(
    goalId,
    portrait?.match ?? null,
    portrait?.finishedMatches ?? []
  );
  const editing = host?.goals.find((goal) => goal.id === goalId);
  const scoringTeamId = editing?.teamId ?? teamId;
  const teamNumber = host
    ? host.home.teamId === scoringTeamId
      ? host.home.teamNumber
      : host.away.teamNumber
    : null;
  const people =
    host && scoringTeamId
      ? rosterOf(host, scoringTeamId, !isEdit).filter((person) =>
          step === "assist" && scorer
            ? person.personId !== scorer.personId
            : true
        )
      : [];

  const finish = async (next: {
    ownGoal?: boolean;
    scorerId?: string | null;
    assistId?: string | null;
  }) => {
    if (!host || isSaving) return;
    setFailureMessage(null);
    setIsSaving(true);
    try {
      if (isEdit && goalId && next.scorerId) {
        await actions.updateEventMatchGoal({
          goalId,
          scorerId: next.scorerId,
          assistId: next.assistId,
        });
      } else if (!isEdit && scoringTeamId) {
        await actions.addEventMatchGoal({
          matchId: host.id,
          teamId: scoringTeamId,
          scorerId: next.scorerId,
          assistId: next.assistId,
          ownGoal: next.ownGoal,
        });
      }
      router.back();
    } catch (error) {
      if (!navigation.isFocused()) {
        showToast(matchFailureMessage(error), "danger");
        return;
      }
      setIsSaving(false);
      setFailureMessage(matchFailureMessage(error));
    }
  };

  return {
    isMissing: !portrait || !host || !scoringTeamId || (isEdit && !editing),
    isBusy: isSaving,
    step,
    title:
      step === "assist"
        ? MATCH_ASSIST_TITLE
        : matchGoalScorerTitle(sortTeamTitle(teamNumber ?? 0)),
    hint:
      step === "assist" && scorer ? matchAssistHint(scorer.displayName) : null,
    ownGoalLabel: isEdit ? null : MATCH_OWN_GOAL,
    noAssistLabel: step === "assist" ? MATCH_NO_ASSIST : null,
    people,
    failureMessage,
    pickOwnGoal: () => void finish({ ownGoal: true }),
    pickScorer: (person: TMatchPerson) => {
      setScorer(person);
      setStep("assist");
    },
    pickAssist: (person: TMatchPerson | null) =>
      void finish({
        scorerId: scorer?.personId,
        assistId: person?.personId ?? null,
      }),
    backToScorer: () => {
      setStep("scorer");
      setFailureMessage(null);
    },
    cancel: close,
  };
}
