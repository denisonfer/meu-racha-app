import { formatEventWhen } from "@meu-racha/domain";
import { router, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useToast } from "@/ui/components";
import { useCancelJoinRequest } from "../../hooks/use-cancel-join-request";
import { useMyJoinRequests } from "../../hooks/use-my-join-requests";
import { useDismissRachaNotice } from "../../hooks/use-dismiss-racha-notice";
import { useMyRachas } from "../../hooks/use-my-rachas";
import { useMyRachaEvents } from "../../hooks/use-my-racha-events";
import { useRachaNotices } from "../../hooks/use-racha-notices";
import { TRachaNotice } from "../../racha-types";
import {
  ROLE_ACCESSIBILITY_LABEL,
  memberCountLabel,
  pendingBadgeLabel,
  pendingCountLabel,
} from "../../utils/racha-labels";
import {
  ACTION_FAILED,
  CANCEL_JOIN_REQUEST_FAILED,
  JOIN_REQUEST_ALREADY_ANSWERED,
  JOIN_REQUEST_CANCELLED,
  NOTICE_OWNERSHIP_RECEIVED,
  NOTICE_RACHA_DELETED,
  NOTICE_REMOVED,
} from "../../utils/racha-messages";

const NOTICE_TEXT: Record<TRachaNotice["kind"], string> = {
  RACHA_DELETED: NOTICE_RACHA_DELETED,
  OWNERSHIP_RECEIVED: NOTICE_OWNERSHIP_RECEIVED,
  REMOVED: NOTICE_REMOVED,
};

export function useRachasScreen() {
  const rachasQuery = useMyRachas();
  const eventsQuery = useMyRachaEvents();
  const joinRequestsQuery = useMyJoinRequests();
  const noticesQuery = useRachaNotices();
  const { dismiss } = useDismissRachaNotice();
  const { cancelJoinRequest, isCancelling } = useCancelJoinRequest();
  const showToast = useToast();
  const queryClient = useQueryClient();

  // refetch é estável; o objeto do useQuery muda a cada estado e faria loop no foco
  const { refetch: refetchRachas } = rachasQuery;
  const { refetch: refetchEvents } = eventsQuery;
  const { refetch: refetchJoinRequests } = joinRequestsQuery;
  const { refetch: refetchNotices } = noticesQuery;

  // a aba fica montada: sem isso selo e aprovação não chegam do outro aparelho
  // o 1º foco é a montagem, que já buscou
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      void refetchRachas();
      void refetchEvents();
      void refetchJoinRequests();
      void refetchNotices();
      // a home aberta depois não pode vir do cache sem a linha de pedidos
      void queryClient.invalidateQueries({ queryKey: ["racha"] });
    }, [
      refetchRachas,
      refetchEvents,
      refetchJoinRequests,
      refetchNotices,
      queryClient,
    ])
  );

  const joinRequests = joinRequestsQuery.data ?? [];
  const eventsByRacha = new Map(
    (eventsQuery.data ?? []).map((event) => [event.rachaId, event])
  );
  // isCancelling só vê a última mutation: um cancelamento por vez
  const isAnyCancelling = joinRequests.some((request) =>
    isCancelling(request.rachaId)
  );

  const cancel = async (rachaId: string) => {
    try {
      await cancelJoinRequest(rachaId);
      showToast(JOIN_REQUEST_CANCELLED, "success");
    } catch (error) {
      if ((error as Error).message === "join_request_not_pending") {
        showToast(JOIN_REQUEST_ALREADY_ANSWERED);
      } else {
        showToast(CANCEL_JOIN_REQUEST_FAILED, "danger");
      }
    }
  };

  const dismissNotice = async (id: string) => {
    try {
      await dismiss(id);
    } catch {
      showToast(ACTION_FAILED, "danger");
    }
  };

  return {
    // erro ao carregar os avisos não aparece: a lista segue sem eles
    notices: (noticesQuery.data ?? []).map((notice) => ({
      id: notice.id,
      title: notice.rachaName,
      text: NOTICE_TEXT[notice.kind],
      dismiss: () => void dismissNotice(notice.id),
    })),
    rachas: (rachasQuery.data ?? []).map((racha) => {
      const event = eventsByRacha.get(racha.id);
      const isOwnerOrAdmin = racha.role === "OWNER" || racha.role === "ADMIN";
      const hasPending = isOwnerOrAdmin && racha.pendingCount > 0;
      const membersLabel = memberCountLabel(racha.memberCount);
      const labelParts = [
        racha.name,
        ROLE_ACCESSIBILITY_LABEL[racha.role],
        membersLabel,
      ];
      if (hasPending) labelParts.push(pendingCountLabel(racha.pendingCount));

      return {
        id: racha.id,
        name: racha.name,
        role: racha.role,
        membersLabel,
        pendingLabel: hasPending ? pendingBadgeLabel(racha.pendingCount) : null,
        accessibilityLabel: labelParts.join(", "),
        canCreateEvent: isOwnerOrAdmin,
        event: event
          ? {
              kicker:
                event.status === "active"
                  ? "Evento em curso"
                  : "Evento agendado",
              when: formatEventWhen(event.startsOn, event.startsAt),
              place: event.place,
              confirmedCount: event.confirmedCount,
              myStatus: event.myStatus,
              myQueuePosition: event.myQueuePosition,
              onOpenAttendance: () =>
                router.push(`/racha/${racha.id}/event/${event.id}/attendance`),
            }
          : null,
      };
    }),
    joinRequests: joinRequests.map((request) => ({
      rachaId: request.rachaId,
      rachaName: request.rachaName,
      isCancelling: isCancelling(request.rachaId),
      isCancelDisabled: isAnyCancelling && !isCancelling(request.rachaId),
    })),
    isLoading:
      rachasQuery.isPending ||
      joinRequestsQuery.isPending ||
      eventsQuery.isPending,
    isError:
      rachasQuery.isError || joinRequestsQuery.isError || eventsQuery.isError,
    retry: () => {
      void rachasQuery.refetch();
      void eventsQuery.refetch();
      void joinRequestsQuery.refetch();
      void refetchNotices();
    },
    isRetrying:
      rachasQuery.isRefetching ||
      joinRequestsQuery.isRefetching ||
      eventsQuery.isRefetching,
    createRacha: () => router.push("/racha/create"),
    openRacha: (id: string) => router.push(`/racha/${id}`),
    createEvent: (id: string) => router.push(`/racha/${id}/event/new`),
    cancelJoinRequest: (rachaId: string) => void cancel(rachaId),
    enterCode: () => router.push("/racha/join"),
  };
}
