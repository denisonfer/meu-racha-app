import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useEventMatch } from "../../hooks/use-event-match";
import { useEventSortOperations } from "../../hooks/use-event-sort";
import type { TAttendanceTarget } from "../../racha-types";
import {
  MATCH_LEAVE_ONLY,
  MATCH_LEAVE_REINFORCE,
  SORT_LEAVE_BUSY,
  SORT_LEAVE_CONFIRM,
  matchLeaveOnField,
  matchLeaveOnlyText,
  matchNoDonor,
  matchReinforceOptionText,
  sortFailureMessage,
  sortLeaveOtherTitle,
  sortTeamTitle,
} from "../../utils/racha-messages";

const REINFORCE = "reinforce";
const LEAVE_ONLY = "leave_only";

export function useMatchLeaveScreen() {
  const { id, eventId, teamId, profileId, guestId, name } =
    useLocalSearchParams<{
      id: string;
      eventId: string;
      teamId?: string;
      profileId?: string;
      guestId?: string;
      name?: string;
    }>();
  const matchQuery = useEventMatch(id, eventId);
  const { leaveEventSort } = useEventSortOperations(id, eventId);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [choice, setChoice] = useState<string>(REINFORCE);
  const [isSaving, setIsSaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const portrait = matchQuery.data;
  const match = portrait?.match ?? null;
  const side =
    match && teamId
      ? match.home.teamId === teamId
        ? match.home
        : match.away.teamId === teamId
          ? match.away
          : null
      : null;
  const target: TAttendanceTarget | null = profileId
    ? { kind: "member", profileId }
    : guestId
      ? { kind: "guest", guestId }
      : null;
  const donors = portrait?.reinforcementDonors ?? [];
  const hasDonors = donors.length > 0;
  const afterCount = side ? Math.max(0, side.outfieldCount - 1) : 0;
  const capacity = side?.capacity ?? 0;
  const teamNumber = side?.teamNumber ?? 0;
  const displayName = name ?? "";

  const confirm = async () => {
    if (!target || !teamId || isSaving || !side) return;
    if (hasDonors && choice === REINFORCE) {
      const query = profileId ? `profileId=${profileId}` : `guestId=${guestId}`;
      router.push(
        `/racha/${id}/event/${eventId}/match-reinforcement?teamId=${teamId}&${query}&name=${encodeURIComponent(displayName)}`
      );
      return;
    }
    setFailureMessage(null);
    setIsSaving(true);
    try {
      await leaveEventSort(target);
      router.back();
    } catch (error) {
      if (!navigation.isFocused()) {
        showToast(sortFailureMessage(error), "danger");
        return;
      }
      setIsSaving(false);
      setFailureMessage(sortFailureMessage(error));
    }
  };

  return {
    isMissing:
      !match || !teamId || !target || side == null || name === undefined,
    title: sortLeaveOtherTitle(displayName),
    supporting: matchLeaveOnField(sortTeamTitle(teamNumber)),
    hasDonors,
    noDonorText: matchNoDonor(teamNumber, afterCount, capacity),
    options: [
      {
        value: REINFORCE,
        title: MATCH_LEAVE_REINFORCE,
        description: matchReinforceOptionText(teamNumber, capacity),
      },
      {
        value: LEAVE_ONLY,
        title: MATCH_LEAVE_ONLY,
        description: matchLeaveOnlyText(teamNumber, afterCount, capacity),
      },
    ],
    choice,
    onChoice: setChoice,
    primaryLabel:
      hasDonors && choice === REINFORCE
        ? MATCH_LEAVE_REINFORCE
        : SORT_LEAVE_CONFIRM,
    busyLabel: SORT_LEAVE_BUSY,
    isBusy: isSaving,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
