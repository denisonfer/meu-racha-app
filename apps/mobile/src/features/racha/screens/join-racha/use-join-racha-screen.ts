import {
  asksPositionDetail,
  INVITE_CODE_LENGTH,
  normalizeInviteCode,
  type TPositionDetail,
} from "@meu-racha/domain";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useToast } from "@/ui/components";
import { useCancelJoinRequest } from "../../hooks/use-cancel-join-request";
import { useInvite } from "../../hooks/use-invite";
import { useMyPositions } from "../../hooks/use-my-positions";
import { useRequestJoin } from "../../hooks/use-request-join";
import {
  hasDetailChoice,
  positionDetailSlots,
} from "../../utils/position-detail-view";
import {
  positionDetailJoinLabel,
  type TPositionSlot,
  ZONE_NAME,
} from "../../utils/racha-labels";
import {
  CANCEL_JOIN_REQUEST_FAILED,
  JOIN_REQUEST_ALREADY_ANSWERED,
  JOIN_REQUEST_CANCELLED,
  POSITION_DETAIL_MISMATCH,
  POSITION_DETAIL_REQUIRED,
  REQUEST_JOIN_FAILED,
} from "../../utils/racha-messages";
import type { TJoinPositionRow } from "./join-position-section";

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

  // U1: Racha 8+ pede a subdivisão de cada zona DEFENSOR/MEIO_CAMPO do Perfil
  const asksDetail =
    invite != null &&
    invite.myStatus === null &&
    asksPositionDetail(invite.outfieldPerTeam);
  const positionsQuery = useMyPositions(asksDetail);
  const slots = positionsQuery.data
    ? positionDetailSlots(positionsQuery.data)
    : [];
  // Goleiro e ATA/TODAS: tela igual à de Racha 3–7
  const showDetails =
    asksDetail && (!positionsQuery.data || hasDetailChoice(slots));
  const [details, setDetails] = useState<
    Record<TPositionSlot, TPositionDetail | null>
  >({ primary: null, secondary: null });
  const [triedSubmit, setTriedSubmit] = useState(false);
  const missingErrors = Object.fromEntries(
    slots
      .filter((slot) => slot.options.length > 0 && details[slot.slot] === null)
      .map((slot) => [slot.slot, slot.requiredError])
  ) as Partial<Record<TPositionSlot, string>>;
  const isDetailsReady = !asksDetail || positionsQuery.isSuccess;
  const detailRows: TJoinPositionRow[] = slots.map((slot) => {
    const zone =
      slot.slot === "primary"
        ? positionsQuery.data?.primaryPosition
        : positionsQuery.data?.secondaryPosition;
    return {
      ...slot,
      zoneTitle:
        slot.slot === "primary" ? "Posição principal" : "Posição secundária",
      zoneName: zone ? ZONE_NAME[zone] : "",
      fieldLabel: zone ? positionDetailJoinLabel(zone) : slot.label,
    };
  });

  // MEMBER em cache pode ser de antes de a pessoa sair: só redireciona com dado fresco
  useEffect(() => {
    if (!invite || !isMember) return;
    if (isFetchedAfterMount) router.replace(`/racha/${invite.rachaId}`);
    else void refetch();
  }, [invite, isMember, isFetchedAfterMount, refetch]);

  const request = async () => {
    if (!invite || isRequesting || !isDetailsReady) return;
    setTriedSubmit(true);
    if (Object.keys(missingErrors).length > 0) return;
    setIsRequesting(true);
    try {
      // só manda subdivisão onde a zona tem o que escolher; o resto o banco quer nulo
      const choice = (slot: TPositionSlot) =>
        slots.some((item) => item.slot === slot && item.options.length > 0)
          ? details[slot]
          : null;
      await requestJoin(
        invite.rachaId,
        asksDetail
          ? { primary: choice("primary"), secondary: choice("secondary") }
          : undefined
      );
      router.dismissTo("/rachas");
    } catch (error) {
      const code = (error as Error).message;
      if (
        code === "position_detail_required" ||
        code === "position_detail_mismatch"
      ) {
        // Perfil ou tamanho de Time mudou com a tela aberta: relê os dois
        void refetch();
        void positionsQuery.refetch();
        showToast(
          code === "position_detail_required"
            ? POSITION_DETAIL_REQUIRED
            : POSITION_DETAIL_MISMATCH,
          "danger"
        );
      } else if (code !== "already_requested") {
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
      if ((error as Error).message === "join_request_not_pending") {
        showToast(JOIN_REQUEST_ALREADY_ANSWERED);
      } else {
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
    positionSection: showDetails
      ? {
          outfieldPerTeam: invite.outfieldPerTeam,
          rows: detailRows,
          values: details,
          errors: triedSubmit ? missingErrors : {},
          onChange: (slot: TPositionSlot, value: TPositionDetail) =>
            setDetails((current) => ({ ...current, [slot]: value })),
          isDisabled: isRequesting,
          isLoading: positionsQuery.isPending,
          isError: positionsQuery.isError,
          onRetry: () => void positionsQuery.refetch(),
        }
      : null,
    canRequest: isDetailsReady,
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
