import { formatAge, formatPlaysAs, isBelowMinAge } from "@meu-racha/domain";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useToast } from "@/ui/components";
import { rachaKey, useRacha } from "../../hooks/use-racha";
import { useRachaJoinRequests } from "../../hooks/use-racha-join-requests";
import { useRefuseJoinRequest } from "../../hooks/use-refuse-join-request";
import {
  JOIN_REQUEST_ACTION_FAILED,
  JOIN_REQUEST_ALREADY_RESOLVED,
  JOIN_REQUEST_REFUSED,
  MEMBER_NOT_ALLOWED,
} from "../../utils/racha-messages";
import { shareInvite } from "../../utils/share-invite";

export function useJoinRequestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestsQuery = useRachaJoinRequests(id);
  const { data: racha } = useRacha(id);
  const { refuse, refusingId } = useRefuseJoinRequest(id);
  const showToast = useToast();
  const queryClient = useQueryClient();

  const isNotAllowed = requestsQuery.error?.message === "not_allowed";
  useEffect(() => {
    if (!isNotAllowed) return;
    void queryClient.invalidateQueries({ queryKey: rachaKey(id) });
    router.dismissTo(`/racha/${id}`);
    showToast(MEMBER_NOT_ALLOWED);
  }, [isNotAllowed, id, queryClient, showToast]);

  const refuseRequest = async (requestId: string) => {
    try {
      await refuse(requestId);
      showToast(JOIN_REQUEST_REFUSED, "success");
    } catch (error) {
      const code = (error as Error).message;
      if (code === "not_allowed") {
        showToast(MEMBER_NOT_ALLOWED);
        return;
      }
      showToast(
        code === "already_resolved"
          ? JOIN_REQUEST_ALREADY_RESOLVED
          : JOIN_REQUEST_ACTION_FAILED,
        "danger"
      );
    }
  };

  const minAge = racha?.minAge ?? null;
  const requests = (requestsQuery.data ?? []).map((request) => {
    const ageText = formatAge(request.age, minAge);
    const playsAsText = formatPlaysAs(
      request.playsAs,
      request.primaryPosition,
      request.secondaryPosition
    );
    return {
      id: request.id,
      name: request.displayName,
      photoUrl: request.photoUrl,
      ageText,
      isBelowMinAge: isBelowMinAge(request.age, minAge),
      playsAsText,
      accessibilityLabel: `${request.displayName}, ${ageText.replace(" · ", ", ")}, ${playsAsText}`,
      isRefusing: refusingId === request.id,
      isDisabled: refusingId !== null,
      onRefuse: () => void refuseRequest(request.id),
      onApprove: () => router.push(`/racha/${id}/approve/${request.id}`),
    };
  });

  return {
    requests,
    countLabel: `${requests.length === 1 ? "1 pedido" : `${requests.length} pedidos`} · mais antigos primeiro`,
    isLoading: requestsQuery.isPending,
    isError: requestsQuery.isError && !isNotAllowed,
    retry: () => void requestsQuery.refetch(),
    isRetrying: requestsQuery.isRefetching,
    shareInvite: () => racha && shareInvite(racha.name, racha.inviteCode),
  };
}
