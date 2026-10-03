import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import {
  useAttendanceAdmin,
  useEventAttendance,
} from "../../hooks/use-event-attendance";
import { useHasRachaAccess } from "../../hooks/use-has-racha-access";
import { useOpenEvents } from "../../hooks/use-open-events";
import { useRacha } from "../../hooks/use-racha";
import {
  ACTION_FAILED,
  ATTENDANCE_MONTHLY_PRICE_REQUIRED,
  yearMonthLong,
} from "../../utils/racha-messages";

export function useMonthlyPassScreen() {
  const { id, eventId, profileId } = useLocalSearchParams<{
    id: string;
    eventId: string;
    profileId: string;
  }>();
  const { data: racha } = useRacha(id);
  const eventsQuery = useOpenEvents(id);
  const attendanceQuery = useEventAttendance(id, eventId);
  const { setMonthlyPass } = useAttendanceAdmin(id, eventId);
  const hasRachaAccess = useHasRachaAccess(id);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();

  const event = eventsQuery.data?.find((item) => item.id === eventId);
  const person = attendanceQuery.data?.find(
    (item) => item.kind === "member" && item.profileId === profileId
  );

  const isAdmin =
    racha != null && (racha.role === "OWNER" || racha.role === "ADMIN");
  const hasMonthlyPrice = racha?.monthlyPrice != null;
  const eventsIdle = eventsQuery.fetchStatus === "idle";
  const attendanceIdle = attendanceQuery.fetchStatus === "idle";

  const isForbidden = racha != null && (!isAdmin || !hasMonthlyPrice);
  const isGone =
    !profileId ||
    (eventsIdle && eventsQuery.isSuccess && event === undefined) ||
    (attendanceIdle && attendanceQuery.isSuccess && person === undefined);

  const isMissing = isForbidden || isGone;

  useEffect(() => {
    if (!isMissing) return;
    if (navigation.isFocused()) router.back();
  }, [isMissing, navigation]);

  const yearMonth = event ? event.startsOn.slice(0, 7) : "";
  const serverEnabled = person?.isMonthlyPass ?? false;

  const [enabled, setEnabled] = useState(serverEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  useEffect(() => {
    if (person) setEnabled(person.isMonthlyPass);
  }, [person?.profileId, person?.isMonthlyPass]);

  const firstName = person?.name.split(" ")[0] ?? "membro";
  const isDirty = person != null && enabled !== person.isMonthlyPass;
  const isReady =
    !isMissing && person != null && event != null && racha != null;

  const save = async () => {
    if (!person?.profileId || !yearMonth || !isDirty) {
      close();
      return;
    }
    setFailureMessage(null);
    setIsSaving(true);
    try {
      await setMonthlyPass({
        profileId: person.profileId,
        yearMonth,
        enabled,
      });
      close();
    } catch (error) {
      const code = (error as Error).message;
      if (code === "not_allowed") {
        close();
        if (await hasRachaAccess()) showToast(ACTION_FAILED);
        return;
      }
      if (!navigation.isFocused()) {
        showToast(
          code === "monthly_price_required"
            ? ATTENDANCE_MONTHLY_PRICE_REQUIRED
            : ACTION_FAILED
        );
        return;
      }
      setIsSaving(false);
      setFailureMessage(
        code === "monthly_price_required"
          ? ATTENDANCE_MONTHLY_PRICE_REQUIRED
          : ACTION_FAILED
      );
    }
  };

  return {
    // null enquanto carrega ou se sumiu — a tela não monta o conteúdo
    isMissing: isMissing || !isReady,
    switchLabel: `Marcar ${firstName}`,
    yearMonthLabel: yearMonth ? yearMonthLong(yearMonth) : "",
    enabled,
    setEnabled: (value: boolean) => {
      setFailureMessage(null);
      setEnabled(value);
    },
    isDirty,
    isSaving,
    failureMessage,
    save: () => void save(),
  };
}
