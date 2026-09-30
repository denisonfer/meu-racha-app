import { INVITE_CODE_LENGTH, normalizeInviteCode } from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useToast } from "@/ui/components";
import { useCancelJoinRequest } from "../../hooks/use-cancel-join-request";
import { useInvite } from "../../hooks/use-invite";
import { useRequestJoin } from "../../hooks/use-request-join";
import {
  CANCEL_JOIN_REQUEST_FAILED,
  JOIN_REQUEST_CANCELLED,
  REQUEST_JOIN_FAILED,
} from "../../utils/racha-messages";

export function useJoinRachaScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = normalizeInviteCode(rawCode ?? "");
  // sem consultar: com a query desabilitada o carregando giraria pra sempre
  const isCodeValid = code.length === INVITE_CODE_LENGTH;

  const {
    data: invite,
    isPending,
    refetch,
    isRefetching,
    isFetchedAfterMount,
  } = useInvite(code);
  const { requestJoin } = useRequestJoin();
  const { cancelJoinRequest, isCancelling } = useCancelJoinRequest();
  const showToast = useToast();
  const [isRequesting, setIsRequesting] = useState(false);

  const isMember = invite?.myStatus === "MEMBER";

  // MEMBER em cache pode ser de antes de a pessoa sair: só redireciona com dado fresco
  useEffect(() => {
    if (!invite || !isMember) return;
    if (isFetchedAfterMount) router.replace(`/racha/${invite.rachaId}`);
    else void refetch();
  }, [invite, isMember, isFetchedAfterMount, refetch]);

  const request = async () => {
    if (!invite || isRequesting) return;
    setIsRequesting(true);
    try {
      await requestJoin(invite.rachaId);
      router.dismissTo("/rachas");
    } catch (error) {
      if ((error as Error).message !== "already_requested") {
        showToast(REQUEST_JOIN_FAILED, "danger");
      } else {
        // o Convite velho não mostrava o pedido: sem pedido nem vínculo, o beco seguiria calado
        const { data: fresh } = await refetch();
        if (fresh && fresh.myStatus == null) {
          showToast(REQUEST_JOIN_FAILED, "danger");
        }
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const cancel = async () => {
    if (!invite) return;
    try {
      await cancelJoinRequest(invite.rachaId);
      showToast(JOIN_REQUEST_CANCELLED, "success");
    } catch (error) {
      if ((error as Error).message !== "join_request_not_pending") {
        showToast(CANCEL_JOIN_REQUEST_FAILED, "danger");
      }
    }
  };

  return {
    isLoading: isCodeValid && (isPending || isMember),
    isGone: !isCodeValid || invite === null,
    invite: invite && {
      name: invite.name,
      ownerName: invite.ownerName,
      memberCount: invite.memberCount,
      memberWord: invite.memberCount === 1 ? "membro" : "membros",
      minAge: invite.minAge,
      status: invite.myStatus,
    },
    retry: () => void refetch(),
    isRetrying: isRefetching,
    backToRachas: () => router.dismissTo("/rachas"),
    // aberto pelo link depois do login, o Convite é a única tela da pilha
    goBack: () =>
      router.canGoBack() ? router.back() : router.replace("/rachas"),
    request: () => void request(),
    isRequesting,
    cancel: () => void cancel(),
    isCancelling: invite ? isCancelling(invite.rachaId) : false,
  };
}
