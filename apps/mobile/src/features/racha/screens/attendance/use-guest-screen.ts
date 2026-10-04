import { asksPositionDetail } from "@meu-racha/domain";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useAttendanceAdmin } from "../../hooks/use-event-attendance";
import { useHasRachaAccess } from "../../hooks/use-has-racha-access";
import { useOpenEvents } from "../../hooks/use-open-events";
import { useRacha } from "../../hooks/use-racha";
import {
  ACTION_FAILED,
  ATTENDANCE_SPOT_LIMIT,
  POSITION_DETAIL_MISMATCH,
  POSITION_DETAIL_REQUIRED,
} from "../../utils/racha-messages";
import {
  buildGuestFormSchema,
  emptyGuestForm,
  guestPositionDetail,
  TGuestFormValues,
} from "./guest-schema";

export function useGuestScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const { data: racha } = useRacha(id);
  const eventsQuery = useOpenEvents(id);
  const { addGuest } = useAttendanceAdmin(id, eventId);
  const hasRachaAccess = useHasRachaAccess(id);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();

  const [values, setValues] = useState<TGuestFormValues>(emptyGuestForm);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const isAdmin =
    racha != null && (racha.role === "OWNER" || racha.role === "ADMIN");
  const event = eventsQuery.data?.find((item) => item.id === eventId);
  const eventsIdle = eventsQuery.fetchStatus === "idle";
  const isMissing =
    (eventsIdle && eventsQuery.isSuccess && event === undefined) ||
    (racha != null && !isAdmin);

  useEffect(() => {
    if (!isMissing) return;
    if (navigation.isFocused()) router.back();
  }, [isMissing, navigation]);

  const asksDetail =
    event !== undefined && asksPositionDetail(event.outfieldPerTeam);
  const guestFormSchema = buildGuestFormSchema(asksDetail);
  const parsed = guestFormSchema.safeParse(values);
  const issues = parsed.success ? [] : parsed.error.issues;
  const errors = triedSubmit
    ? {
        displayName: issues.find((i) => i.path[0] === "displayName")?.message,
        primaryPosition: issues.find((i) => i.path[0] === "primaryPosition")
          ?.message,
        secondaryPosition: issues.find((i) => i.path[0] === "secondaryPosition")
          ?.message,
        primaryPositionDetail: issues.find(
          (i) => i.path[0] === "primaryPositionDetail"
        )?.message,
        secondaryPositionDetail: issues.find(
          (i) => i.path[0] === "secondaryPositionDetail"
        )?.message,
        stars: issues.find((i) => i.path[0] === "stars")?.message,
      }
    : {};

  const onChange = (patch: Partial<TGuestFormValues>) => {
    setFailureMessage(null);
    setValues((current) => ({ ...current, ...patch }));
  };

  const submit = async () => {
    setTriedSubmit(true);
    const result = guestFormSchema.safeParse(values);
    if (!result.success) return;

    setFailureMessage(null);
    setIsSaving(true);
    try {
      const data = result.data;
      const isGoalkeeper = data.playsAs === "GOALKEEPER";
      await addGuest({
        displayName: data.displayName,
        playsAs: data.playsAs,
        primaryPosition: isGoalkeeper ? null : data.primaryPosition,
        secondaryPosition: isGoalkeeper ? null : data.secondaryPosition,
        primaryPositionDetail: isGoalkeeper
          ? null
          : guestPositionDetail(
              asksDetail,
              data.primaryPosition,
              data.primaryPositionDetail
            ),
        secondaryPositionDetail: isGoalkeeper
          ? null
          : guestPositionDetail(
              asksDetail,
              data.secondaryPosition,
              data.secondaryPositionDetail
            ),
        stars: data.playsAs === "GOALKEEPER" ? null : data.stars,
        isSuperStar: data.playsAs === "GOALKEEPER" ? false : data.isSuperStar,
      });
      close();
    } catch (error) {
      const code = (error as Error).message;
      if (code === "not_allowed") {
        close();
        if (await hasRachaAccess()) showToast(ACTION_FAILED);
        return;
      }
      const message =
        code === "spot_limit"
          ? ATTENDANCE_SPOT_LIMIT
          : code === "position_detail_required"
            ? POSITION_DETAIL_REQUIRED
            : code === "position_detail_mismatch"
              ? POSITION_DETAIL_MISMATCH
              : ACTION_FAILED;
      if (!navigation.isFocused()) {
        showToast(message);
        return;
      }
      setIsSaving(false);
      setFailureMessage(message);
    }
  };

  return {
    isMissing,
    values,
    errors,
    asksPositionDetail: asksDetail,
    failureMessage,
    isSaving,
    canSubmit: !isSaving,
    onChange,
    onSubmit: () => void submit(),
  };
}
