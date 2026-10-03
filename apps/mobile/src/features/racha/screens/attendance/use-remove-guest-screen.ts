import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import {
  useAttendanceAdmin,
  useEventAttendance,
} from "../../hooks/use-event-attendance";
import { useHasRachaAccess } from "../../hooks/use-has-racha-access";
import { useRacha } from "../../hooks/use-racha";
import {
  ACTION_FAILED,
  ATTENDANCE_GUEST_GONE,
} from "../../utils/racha-messages";

export function useRemoveGuestScreen() {
  const {
    id,
    eventId,
    guestId,
    name: nameParam,
  } = useLocalSearchParams<{
    id: string;
    eventId: string;
    guestId: string;
    name?: string;
  }>();
  const { data: racha } = useRacha(id);
  const attendanceQuery = useEventAttendance(id, eventId);
  const { removeGuest } = useAttendanceAdmin(id, eventId);
  const hasRachaAccess = useHasRachaAccess(id);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();

  const guest = attendanceQuery.data?.find(
    (person) => person.kind === "guest" && person.guestId === guestId
  );
  // título vem do param (lista) ou do cache; guarda para não sumir após o delete
  const [name] = useState(() => nameParam ?? guest?.name);
  const [isRemoving, setIsRemoving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const isAdmin =
    racha != null && (racha.role === "OWNER" || racha.role === "ADMIN");
  const attendanceIdle = attendanceQuery.fetchStatus === "idle";
  const isForbidden = racha != null && !isAdmin;
  const isGone =
    !guestId ||
    (attendanceIdle &&
      attendanceQuery.isSuccess &&
      guest === undefined &&
      name === undefined);
  const isMissing = isForbidden || isGone;

  useEffect(() => {
    if (!isMissing) return;
    if (navigation.isFocused()) {
      router.back();
      if (isGone && guestId) showToast(ATTENDANCE_GUEST_GONE);
    }
  }, [isMissing, isGone, navigation, guestId, showToast]);

  const confirm = async () => {
    if (!guestId || name === undefined) return;
    setFailureMessage(null);
    setIsRemoving(true);
    try {
      await removeGuest(guestId);
      // isRemoving fica true: evita segundo toque enquanto a folha fecha
      router.back();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      // RPC usa not_allowed tanto pra sumiu quanto pra sem permissão
      if (code === "not_allowed") {
        router.back();
        if (await hasRachaAccess()) {
          showToast(
            guest === undefined ? ATTENDANCE_GUEST_GONE : ACTION_FAILED
          );
        }
        return;
      }
      if (!navigation.isFocused()) {
        showToast(ACTION_FAILED);
        return;
      }
      setIsRemoving(false);
      setFailureMessage(ACTION_FAILED);
    }
  };

  return {
    name,
    isRemoving,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
