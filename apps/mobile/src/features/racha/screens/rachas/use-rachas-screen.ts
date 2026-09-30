import { router } from "expo-router";
import { useToast } from "@/ui/components";
import { useCancelJoinRequest } from "../../hooks/use-cancel-join-request";
import { useMyJoinRequests } from "../../hooks/use-my-join-requests";
import { useMyRachas } from "../../hooks/use-my-rachas";
import { memberCountLabel } from "../../utils/racha-labels";
import {
  CANCEL_JOIN_REQUEST_FAILED,
  JOIN_REQUEST_CANCELLED,
} from "../../utils/racha-messages";

export function useRachasScreen() {
  const rachasQuery = useMyRachas();
  const joinRequestsQuery = useMyJoinRequests();
  const { cancelJoinRequest, isCancelling } = useCancelJoinRequest();
  const showToast = useToast();

  const joinRequests = joinRequestsQuery.data ?? [];
  // isCancelling só enxerga a última mutation disparada: enquanto um pedido
  // cancela, os outros cartões ficam com o botão desabilitado — nunca há
  // dois cancelamentos em voo.
  const isAnyCancelling = joinRequests.some((request) =>
    isCancelling(request.rachaId)
  );

  const cancel = async (rachaId: string) => {
    try {
      await cancelJoinRequest(rachaId);
      showToast(JOIN_REQUEST_CANCELLED, "success");
    } catch (error) {
      // join_request_not_pending: outro aparelho já resolveu o pedido; o
      // refetch (onSettled da mutation) tira ou atualiza o cartão sem toast.
      if ((error as Error).message !== "join_request_not_pending") {
        showToast(CANCEL_JOIN_REQUEST_FAILED, "danger");
      }
    }
  };

  return {
    rachas: (rachasQuery.data ?? []).map((racha) => ({
      id: racha.id,
      name: racha.name,
      role: racha.role,
      membersLabel: memberCountLabel(racha.memberCount),
      // Evento só o Dono cria por enquanto; o resto vê o aviso sem botão
      canCreateEvent: racha.role === "OWNER",
    })),
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
    },
    isRetrying: rachasQuery.isRefetching || joinRequestsQuery.isRefetching,
    createRacha: () => router.push("/racha/create"),
    openRacha: (id: string) => router.push(`/racha/${id}`),
    cancelJoinRequest: (rachaId: string) => void cancel(rachaId),
    enterCode: () => router.push("/racha/join"),
  };
}
