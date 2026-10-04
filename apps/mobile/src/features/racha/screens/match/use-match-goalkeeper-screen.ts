import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useEventMatch } from "../../hooks/use-event-match";
import { useEventMatchActions } from "../../hooks/use-event-match-actions";
import {
  MATCH_KEEPER_FIRST,
  MATCH_SWAP_KEEPER,
  matchFailureMessage,
  sortGoalkeeperQueuePosition,
  sortTeamTitle,
} from "../../utils/racha-messages";
import { pendingKeepersKey, type TPendingKeepers } from "./pending-keepers";

export function useMatchGoalkeeperScreen() {
  const { id, eventId, teamId } = useLocalSearchParams<{
    id: string;
    eventId: string;
    teamId?: string;
  }>();
  const matchQuery = useEventMatch(id, eventId);
  const actions = useEventMatchActions(id, eventId);
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [isSaving, setIsSaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const portrait = matchQuery.data;
  const match = portrait?.match ?? null;
  const next = portrait?.nextMatch;
  const teamNumber = !teamId
    ? null
    : match?.home.teamId === teamId
      ? match.home.teamNumber
      : match?.away.teamId === teamId
        ? match.away.teamNumber
        : next?.home.teamId === teamId
          ? next.home.teamNumber
          : next?.away.teamId === teamId
            ? next.away.teamNumber
            : null;
  const keepers = [...(portrait?.goalkeeperQueue ?? [])].sort(
    (a, b) => a.queueOrder - b.queueOrder
  );

  const pick = async (personId: string) => {
    if (!teamId || isSaving) return;
    setFailureMessage(null);
    setIsSaving(true);
    try {
      if (match) {
        await actions.swapEventMatchGoalkeeper({
          matchId: match.id,
          teamId,
          goalkeeperId: personId,
        });
      } else {
        const current =
          queryClient.getQueryData<TPendingKeepers>(
            pendingKeepersKey(id, eventId)
          ) ?? {};
        queryClient.setQueryData<TPendingKeepers>(
          pendingKeepersKey(id, eventId),
          { ...current, [teamId]: personId }
        );
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
    isMissing: !portrait || !teamId || teamNumber == null,
    title: MATCH_SWAP_KEEPER,
    teamLabel: teamNumber != null ? sortTeamTitle(teamNumber) : "",
    isBusy: isSaving,
    failureMessage,
    people: keepers.map((entry, index) => ({
      personId: entry.person.personId,
      name: entry.person.displayName,
      detail:
        index === 0
          ? MATCH_KEEPER_FIRST
          : sortGoalkeeperQueuePosition(entry.queueOrder),
      isFirst: index === 0,
      onPress: () => void pick(entry.person.personId),
    })),
    cancel: close,
  };
}
