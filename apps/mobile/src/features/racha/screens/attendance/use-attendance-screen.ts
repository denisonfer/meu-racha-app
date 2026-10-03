import {
  formatEventWhen,
  formatPlaysAs,
  groupMembersByPosition,
  memberPermissions,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/ui/components";
import { useSession } from "@/features/auth";
import type { TAttendanceRowAction } from "../../components/attendance-row";
import { useConfirmAttendance } from "../../hooks/use-confirm-attendance";
import {
  useAttendanceAdmin,
  useEventAttendance,
} from "../../hooks/use-event-attendance";
import { useLeaveOnNoAccess } from "../../hooks/use-leave-on-no-access";
import { openEventsKey, useOpenEvents } from "../../hooks/use-open-events";
import { useRacha } from "../../hooks/use-racha";
import {
  TAttendancePerson,
  TAttendanceTarget,
  TOpenEvent,
} from "../../racha-types";
import { attendanceCta } from "../../utils/attendance-cta";
import {
  ACTION_FAILED,
  ATTENDANCE_CANCEL,
  ATTENDANCE_CONFIRM,
  ATTENDANCE_LEAVE_QUEUE,
  ATTENDANCE_MENSALISTA_PAID,
  ATTENDANCE_MONTHLY_ACTION,
  ATTENDANCE_MONTHLY_PRICE_REQUIRED,
  ATTENDANCE_NOT_CONFIRMED,
  ATTENDANCE_REMOVE_GUEST,
  ATTENDANCE_SPOT_LIMIT,
  ATTENDANCE_WAITLISTED,
  ATTENDANCE_WAITLISTED_UNPAID,
} from "../../utils/racha-messages";

function attendanceErrorMessage(code: string): string {
  switch (code) {
    case "spot_limit":
      return ATTENDANCE_SPOT_LIMIT;
    case "mensalista_paid":
      return ATTENDANCE_MENSALISTA_PAID;
    case "not_confirmed":
      return ATTENDANCE_NOT_CONFIRMED;
    case "waitlisted_unpaid":
      return ATTENDANCE_WAITLISTED_UNPAID;
    case "monthly_price_required":
      return ATTENDANCE_MONTHLY_PRICE_REQUIRED;
    default:
      return ACTION_FAILED;
  }
}

function formatPosition(person: TAttendancePerson): string {
  return formatPlaysAs(
    person.playsAs,
    person.primaryPosition,
    person.secondaryPosition
  ).replace(/^Linha · /, "");
}

function targetOf(person: TAttendancePerson): TAttendanceTarget | null {
  if (person.kind === "guest" && person.guestId) {
    return { kind: "guest", guestId: person.guestId };
  }
  if (person.kind === "member" && person.profileId) {
    return { kind: "member", profileId: person.profileId };
  }
  return null;
}

function busyKeyOf(
  kind: "attended" | "paid" | "status",
  person: TAttendancePerson
): string {
  const id =
    person.kind === "guest" ? (person.guestId ?? "") : (person.profileId ?? "");
  return `${kind}:${person.kind}:${id}`;
}

type TAttendanceSection = "confirmed" | "waitlisted" | "cancelled";

export function useAttendanceScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const {
    data: racha,
    isPending: isRachaPending,
    error: rachaError,
    fetchStatus: rachaFetchStatus,
    refetch: refetchRacha,
    isRefetching: isRachaRefetching,
  } = useRacha(id);
  const eventsQuery = useOpenEvents(id);
  const attendanceQuery = useEventAttendance(id, eventId);
  const admin = useAttendanceAdmin(id, eventId);
  const { confirmAttendance, cancelAttendance, isAttendanceBusy } =
    useConfirmAttendance();
  const { session } = useSession();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const isNoAccess = useLeaveOnNoAccess(rachaError, rachaFetchStatus, id);

  const [isCancelledOpen, setIsCancelledOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const userId = session?.userId ?? null;

  const eventsIdle = eventsQuery.fetchStatus === "idle";
  const event = eventsQuery.data?.find((item) => item.id === eventId);
  const isMissingEvent =
    eventsIdle && eventsQuery.isSuccess && event === undefined;

  const isAdmin =
    racha != null && (racha.role === "OWNER" || racha.role === "ADMIN");
  const canMonthlyPass = isAdmin && racha?.monthlyPrice != null;

  const people = attendanceQuery.data ?? [];
  const confirmed = people.filter(
    (person) => person.kind === "guest" || person.status === "confirmed"
  );
  const waitlisted = people
    .filter((person) => person.status === "waitlisted")
    .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));
  const cancelled = isAdmin
    ? people.filter((person) => person.status === "cancelled")
    : [];

  const remainingSpots =
    event?.spotLimit == null
      ? null
      : Math.max(0, event.spotLimit - event.confirmedCount);

  const capacityText = (() => {
    if (!event) return "";
    const count =
      event.confirmedCount === 1
        ? "1 confirmado"
        : `${event.confirmedCount} confirmados`;
    if (remainingSpots === null) return count;
    if (remainingSpots === 0) return `${count} · lotado`;
    return remainingSpots === 1
      ? `${count} · 1 vaga`
      : `${count} · ${remainingSpots} vagas`;
  })();

  const runCheck = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await action();
    } catch (error) {
      showToast(attendanceErrorMessage((error as Error).message), "danger");
    } finally {
      setBusyKey(null);
    }
  };

  const buildActions = (
    person: TAttendancePerson,
    section: TAttendanceSection
  ): TAttendanceRowAction[] => {
    const actions: TAttendanceRowAction[] = [];

    if (isAdmin && person.kind === "guest" && person.guestId) {
      actions.push({
        label: ATTENDANCE_REMOVE_GUEST,
        accessibilityLabel: `Remover ${person.name}`,
        onPress: () =>
          router.push(
            `/racha/${id}/event/${eventId}/remove-guest?guestId=${person.guestId}&name=${encodeURIComponent(person.name)}`
          ),
      });
    }

    if (
      isAdmin &&
      person.kind === "member" &&
      person.profileId &&
      person.profileId !== userId
    ) {
      const profileId = person.profileId;
      const setStatus = (status: "confirmed" | "cancelled", label: string) => ({
        label,
        onPress: () =>
          void runCheck(busyKeyOf("status", person), () =>
            admin.setAttendanceForMember({ profileId, status })
          ),
      });
      if (section === "cancelled") {
        actions.push(setStatus("confirmed", ATTENDANCE_CONFIRM));
      } else if (section === "waitlisted") {
        actions.push(
          setStatus("confirmed", ATTENDANCE_CONFIRM),
          setStatus("cancelled", ATTENDANCE_LEAVE_QUEUE)
        );
      } else {
        actions.push(setStatus("cancelled", ATTENDANCE_CANCEL));
      }
    }

    if (
      canMonthlyPass &&
      person.kind === "member" &&
      person.profileId != null
    ) {
      actions.push({
        label: ATTENDANCE_MONTHLY_ACTION,
        onPress: () =>
          router.push(
            `/racha/${id}/event/${eventId}/monthly-pass?profileId=${person.profileId}`
          ),
      });
    }

    return actions;
  };

  const memberOpenPress = (person: TAttendancePerson) => {
    if (
      person.kind !== "member" ||
      !person.profileId ||
      !person.role ||
      !racha
    ) {
      return undefined;
    }
    const isMe = person.profileId === userId;
    const canOpen = memberPermissions(
      racha.role,
      person.role,
      isMe,
      person.playsAs === "GOALKEEPER"
    ).canOpen;
    if (!canOpen) return undefined;
    return () => router.push(`/racha/${id}/member/${person.profileId}`);
  };

  const toRow = (person: TAttendancePerson, section: TAttendanceSection) => {
    const showChecks = isAdmin && section === "confirmed";
    const showPaid = showChecks && !!event?.isPaid;
    const isPaidLocked = person.isMonthlyPass && person.isPaidEffective;
    const target = targetOf(person);
    const actions = buildActions(person, section);

    return {
      key:
        person.kind === "guest"
          ? `guest:${person.guestId}`
          : `member:${person.profileId}`,
      name: person.name,
      initials: person.initials,
      photoUrl: person.photoUrl,
      overall: person.overall,
      chip:
        person.kind === "guest"
          ? ("guest" as const)
          : person.isMonthlyPass
            ? ("monthly" as const)
            : null,
      positionText: formatPosition(person),
      paymentNote: person.paymentNote,
      queuePosition: section === "waitlisted" ? person.queuePosition : null,
      stars: person.stars,
      isSuperStar: person.isSuperStar,
      isGoalkeeper: person.playsAs === "GOALKEEPER",
      showChecks,
      didAttend: person.didAttend,
      isPaid: person.isPaidEffective,
      showPaid,
      isPaidLocked,
      isAttendedDisabled: false,
      isPaidDisabled: false,
      isChecksBusy: busyKey !== null,
      accessibilityLabel: person.name,
      actions: actions.length > 0 ? actions : undefined,
      onPress: memberOpenPress(person),
      onDidAttendChange:
        showChecks && target
          ? (didAttend: boolean) =>
              void runCheck(busyKeyOf("attended", person), () =>
                admin.setAttendanceAttended({ target, didAttend })
              )
          : undefined,
      onPaidChange:
        showPaid && target && !isPaidLocked
          ? (paid: boolean) =>
              void runCheck(busyKeyOf("paid", person), () =>
                admin.setAttendancePaid({ target, paid })
              )
          : undefined,
    };
  };

  const groupPeople = (
    list: TAttendancePerson[],
    section: TAttendanceSection
  ) => {
    const forGroup = list.map((person) => ({
      ...person,
      displayName: person.name,
    }));
    return groupMembersByPosition(forGroup).map((group) => ({
      key: group.key,
      label: group.label,
      rows: group.members.map((person) => toRow(person, section)),
    }));
  };

  const myCta = attendanceCta(event?.myStatus ?? null);

  const onMyAttendancePress = async () => {
    try {
      if (myCta.kind === "confirm") {
        await confirmAttendance(id, eventId);
        const fresh = queryClient
          .getQueryData<TOpenEvent[]>(openEventsKey(id))
          ?.find((item) => item.id === eventId);
        if (fresh?.myStatus === "waitlisted" && fresh.myQueuePosition != null) {
          showToast(ATTENDANCE_WAITLISTED(fresh.myQueuePosition), "success");
        }
      } else {
        await cancelAttendance(id, eventId);
      }
    } catch (error) {
      showToast(attendanceErrorMessage((error as Error).message), "danger");
    }
  };

  const isLoading =
    isNoAccess ||
    isRachaPending ||
    eventsQuery.isPending ||
    (!isMissingEvent && attendanceQuery.isPending);

  const isError =
    !isLoading &&
    !isMissingEvent &&
    (eventsQuery.isError ||
      attendanceQuery.isError ||
      (!!rachaError && !isNoAccess));

  return {
    isLoading,
    isError,
    isMissingEvent,
    summary:
      event && racha
        ? {
            top: `${racha.name} · ${
              event.status === "active" ? "Evento em curso" : "Evento agendado"
            }`,
            when: formatEventWhen(event.startsOn, event.startsAt),
            place: event.place,
            capacityText,
            confirmedCount: event.confirmedCount,
          }
        : null,
    isAdmin,
    eventIsPaid: !!event?.isPaid,
    canAddGuest: isAdmin,
    myAttendance: {
      title: myCta.title,
      preset: myCta.preset,
      isLoading: isAttendanceBusy(eventId),
      onPress: () => void onMyAttendancePress(),
    },
    confirmedCount: confirmed.length,
    confirmedGroups: groupPeople(confirmed, "confirmed"),
    showConfirmedGroupTitles: confirmed.length > 1,
    waitlistedRows: waitlisted.map((person) => toRow(person, "waitlisted")),
    cancelledGroups: groupPeople(cancelled, "cancelled"),
    showCancelledGroupTitles: cancelled.length > 1,
    cancelledCount: cancelled.length,
    isCancelledOpen,
    toggleCancelled: () => setIsCancelledOpen((open) => !open),
    openGuest: () => router.push(`/racha/${id}/event/${eventId}/guest`),
    backToRacha: () => router.dismissTo(`/racha/${id}`),
    retry: () => {
      void refetchRacha();
      void eventsQuery.refetch();
      void attendanceQuery.refetch();
    },
    isRetrying:
      isRachaRefetching ||
      eventsQuery.isRefetching ||
      attendanceQuery.isRefetching,
  };
}
