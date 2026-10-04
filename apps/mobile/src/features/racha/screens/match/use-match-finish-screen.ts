import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useEventMatch } from "../../hooks/use-event-match";
import { useEventMatchActions } from "../../hooks/use-event-match-actions";
import {
  MATCH_FINISH_BUSY,
  MATCH_FINISH_CONFIRM,
  MATCH_FINISH_TITLE,
  MATCH_PENALTY_WINNER_REQUIRED,
  matchFailureMessage,
  matchFinishConsequence,
  matchScoreLine,
  matchVsLine,
  sortTeamTitle,
} from "../../utils/racha-messages";

type TPreviewResult = { kind: "ready"; text: string } | { kind: "need-winner" };

export function useMatchFinishScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const matchQuery = useEventMatch(id, eventId);
  const actions = useEventMatchActions(id, eventId);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [isFinishing, setIsFinishing] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const match = matchQuery.data?.match ?? null;

  const previewQuery = useQuery({
    queryKey: [
      "racha",
      id,
      "event",
      eventId,
      "match-finish-preview",
      match?.id,
      winnerId,
    ],
    enabled: Boolean(match?.id),
    retry: false,
    queryFn: async (): Promise<TPreviewResult> => {
      if (!match) throw new Error("no_open_match");
      try {
        const preview = await actions.previewFinishEventMatch({
          matchId: match.id,
          penaltyWinnerId: winnerId,
        });
        return {
          kind: "ready",
          text: matchFinishConsequence(
            preview.consequence,
            preview.fallback,
            preview.nextIsRematch
          ),
        };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "penalty_winner_required"
        ) {
          return { kind: "need-winner" };
        }
        throw error;
      }
    },
  });

  const confirm = async () => {
    if (!match || isFinishing) return;
    if (previewQuery.data?.kind === "need-winner" && !winnerId) {
      setFailureMessage(MATCH_PENALTY_WINNER_REQUIRED);
      return;
    }
    setFailureMessage(null);
    setIsFinishing(true);
    try {
      await actions.finishEventMatch({
        matchId: match.id,
        penaltyWinnerId: winnerId,
      });
      router.back();
    } catch (error) {
      if (!navigation.isFocused()) {
        showToast(matchFailureMessage(error), "danger");
        return;
      }
      setIsFinishing(false);
      setFailureMessage(matchFailureMessage(error));
    }
  };

  return {
    isMissing: !match,
    title: MATCH_FINISH_TITLE,
    vsLine: match
      ? matchVsLine(match.home.teamNumber, match.away.teamNumber)
      : "",
    scoreLine: match ? matchScoreLine(match.home.score, match.away.score) : "",
    consequence:
      previewQuery.data?.kind === "ready" ? previewQuery.data.text : null,
    isLoadingPreview: previewQuery.isPending,
    needsWinner: previewQuery.data?.kind === "need-winner",
    winnerId,
    winnerOptions: match
      ? [
          {
            value: match.home.teamId,
            title: sortTeamTitle(match.home.teamNumber),
          },
          {
            value: match.away.teamId,
            title: sortTeamTitle(match.away.teamNumber),
          },
        ]
      : [],
    pickWinner: (teamId: string) => {
      setFailureMessage(null);
      setWinnerId(teamId);
    },
    confirmLabel: MATCH_FINISH_CONFIRM,
    busyLabel: MATCH_FINISH_BUSY,
    isBusy: isFinishing,
    failureMessage:
      failureMessage ??
      (previewQuery.isError ? matchFailureMessage(previewQuery.error) : null),
    confirm: () => void confirm(),
    cancel: close,
  };
}
