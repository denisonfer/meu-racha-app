import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useState } from "react";
import { useSession } from "@/features/auth";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useEventSortOperations } from "../../hooks/use-event-sort";
import type { TAttendanceTarget } from "../../racha-types";
import {
  SORT_LEAVE_OTHER_TEXT,
  SORT_LEAVE_SELF_TEXT,
  SORT_LEAVE_SELF_TITLE,
  sortFailureMessage,
  sortLeaveOtherTitle,
} from "../../utils/racha-messages";

export function useLeaveSortScreen() {
  const { id, eventId, profileId, guestId, name } = useLocalSearchParams<{
    id: string;
    eventId: string;
    profileId?: string;
    guestId?: string;
    name?: string;
  }>();
  const { session } = useSession();
  const { leaveEventSort } = useEventSortOperations(id, eventId);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [isLeaving, setIsLeaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const target: TAttendanceTarget | null = profileId
    ? { kind: "member", profileId }
    : guestId
      ? { kind: "guest", guestId }
      : null;
  const isSelf = profileId !== undefined && profileId === session?.userId;

  const confirm = async () => {
    if (!target || isLeaving) return;
    setFailureMessage(null);
    setIsLeaving(true);
    try {
      await leaveEventSort(target);
      router.back();
    } catch (error) {
      if (!navigation.isFocused()) {
        showToast(sortFailureMessage(error), "danger");
        return;
      }
      setIsLeaving(false);
      setFailureMessage(sortFailureMessage(error));
    }
  };

  return {
    isMissing: !target || name === undefined,
    title: isSelf ? SORT_LEAVE_SELF_TITLE : sortLeaveOtherTitle(name ?? ""),
    message: isSelf ? SORT_LEAVE_SELF_TEXT : SORT_LEAVE_OTHER_TEXT,
    isLeaving,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
