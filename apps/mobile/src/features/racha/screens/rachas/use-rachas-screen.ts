import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { useToast } from "@/ui/components";
import { useCancelJoinRequest } from "../../hooks/use-cancel-join-request";
import { useMyJoinRequests } from "../../hooks/use-my-join-requests";
import { useDismissRachaNotice } from "../../hooks/use-dismiss-racha-notice";
import { useMyRachas } from "../../hooks/use-my-rachas";
import { useRachaNotices } from "../../hooks/use-racha-notices";
import {
  ROLE_ACCESSIBILITY_LABEL,
  memberCountLabel,
  pendingBadgeLabel,
  pendingCountLabel,
} from "../../utils/racha-labels";
import {
  ACTION_FAILED,
  CANCEL_JOIN_REQUEST_FAILED,
  JOIN_REQUEST_CANCELLED,
  NOTICE_RACHA_DELETED,
  NOTICE_REMOVED,
} from "../../utils/racha-messages";

export function useRachasScreen() {
  const rachasQuery = useMyRachas();
  const joinRequestsQuery = useMyJoinRequests();
  const noticesQuery = useRachaNotices();
  const { dismiss } = useDismissRachaNotice();
  const { cancelJoinRequest, isCancelling } = useCancelJoinRequest();
  const showToast = useToast();

  // refetch é estável; o objeto do useQuery muda a cada estado e faria loop no foco
  const { refetch: refetchRachas } = rachasQuery;
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
      void refetchJoinRequests();
      void refetchNotices();
    }, [refetchRachas, refetchJoinRequests, refetchNotices])
  );

  const joinRequests = joinRequestsQuery.data ?? [];
  // isCancelling só vê a última mutation: um cancelamento por vez
  const isAnyCancelling = joinRequests.some((request) =>
    isCancelling(request.rachaId)
  );

  const cancel = async (rachaId: string) => {
    try {
      await cancelJoinRequest(rachaId);
      showToast(JOIN_REQUEST_CANCELLED, "success");
    } catch (error) {
      if ((error as Error).message !== "join_request_not_pending") {
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
      text:
        notice.kind === "RACHA_DELETED" ? NOTICE_RACHA_DELETED : NOTICE_REMOVED,
      dismiss: () => void dismissNotice(notice.id),
    })),
    rachas: (rachasQuery.data ?? []).map((racha) => {
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
        // Evento só o Dono cria por enquanto; o resto vê o aviso sem botão
        canCreateEvent: racha.role === "OWNER",
      };
    }),
    joinRequests: joinRequests.map((request) => ({
      rachaId: request.rachaId,
      rachaName: request.rachaName,
      isCancelling: isCancelling(request.rachaId),
      isCancelDisabled: isAnyCancelling && !isCancelling(request.rachaId),
    })),
    isLoading: rachasQuery.isPending || joinRequestsQuery.isPending,
    isError: rachasQuery.isError || joinRequestsQuery.isError,
    retry: () => {
      void rachasQuery.refetch();
      void joinRequestsQuery.refetch();
      void refetchNotices();
    },
    isRetrying: rachasQuery.isRefetching || joinRequestsQuery.isRefetching,
    createRacha: () => router.push("/racha/create"),
    openRacha: (id: string) => router.push(`/racha/${id}`),
    cancelJoinRequest: (rachaId: string) => void cancel(rachaId),
    enterCode: () => router.push("/racha/join"),
  };
}
