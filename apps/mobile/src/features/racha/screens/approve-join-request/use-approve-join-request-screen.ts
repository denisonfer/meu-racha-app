import { formatAge, formatPlaysAs, isBelowMinAge } from "@meu-racha/domain";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useApproveJoinRequest } from "../../hooks/use-approve-join-request";
import { useRacha } from "../../hooks/use-racha";
import { useRachaJoinRequests } from "../../hooks/use-racha-join-requests";
import {
  JOIN_REQUEST_ACTION_FAILED,
  JOIN_REQUEST_ALREADY_RESOLVED,
  JOIN_REQUEST_APPROVED,
} from "../../utils/racha-messages";

export function useApproveJoinRequestScreen() {
  const { id, requestId } = useLocalSearchParams<{
    id: string;
    requestId: string;
  }>();
  const navigation = useNavigation();
  const { data: requests, isError: isListError } = useRachaJoinRequests(id);
  const { data: racha } = useRacha(id);
  const { approve } = useApproveJoinRequest(id);
  const showToast = useToast();

  const [stars, setStars] = useState<number | null>(null);
  const [isSuperStar, setIsSuperStar] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  // no iOS o formSheet cobre o toast da raiz: o erro fica na folha
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  // a lista recarrega antes da mutation terminar e o pedido some com a folha aberta
  const found = requests?.find((item) => item.id === requestId);
  const [request, setRequest] = useState(found);
  if (found && found !== request) setRequest(found);

  const close = useBottomSheetClose();

  const isGone = requests !== undefined && !found && !isApproving;
  useEffect(() => {
    if (!isGone) return;
    router.back();
    showToast(JOIN_REQUEST_ALREADY_RESOLVED);
  }, [isGone, showToast]);

  const isUnreachable = !request && isListError;
  useEffect(() => {
    if (!isUnreachable) return;
    if (navigation.isFocused()) router.back();
    showToast(JOIN_REQUEST_ACTION_FAILED, "danger");
  }, [isUnreachable, navigation, showToast]);

  const isGoalkeeper = request?.playsAs === "GOALKEEPER";
  const canApprove = isGoalkeeper || stars !== null;
  const minAge = racha?.minAge ?? null;

  const confirm = async () => {
    if (!request || !canApprove) return;
    setFailureMessage(null);
    setIsApproving(true);
    try {
      await approve({
        requestId: request.id,
        stars: isGoalkeeper ? null : stars,
        isSuperStar: isGoalkeeper ? false : isSuperStar,
      });
      // isApproving fica true: o pedido já sumiu e dispararia o "já resolvido"
      close();
      showToast(JOIN_REQUEST_APPROVED(request.displayName), "success");
    } catch (error) {
      const code = (error as Error).message;
      if (code === "already_resolved") {
        close();
        showToast(JOIN_REQUEST_ALREADY_RESOLVED);
        return;
      }
      if (code === "not_allowed") {
        close();
        return;
      }
      setIsApproving(false);
      setFailureMessage(JOIN_REQUEST_ACTION_FAILED);
    }
  };

  return {
    person: request && {
      name: request.displayName,
      photoUrl: request.photoUrl,
      title: `Aprovar ${request.displayName.split(" ")[0]}`,
      summary: `${formatAge(request.age, null)} · ${formatPlaysAs(
        request.playsAs,
        request.primaryPosition,
        request.secondaryPosition
      )}`,
      belowMinAgeText: isBelowMinAge(request.age, minAge)
        ? `Abaixo da idade mínima (${minAge})`
        : null,
    },
    isGoalkeeper,
    stars,
    setStars: (value: number) => {
      setFailureMessage(null);
      setStars(value);
    },
    starsWord: stars === 1 ? "Estrela" : "Estrelas",
    isSuperStar,
    setIsSuperStar: (value: boolean) => {
      setFailureMessage(null);
      setIsSuperStar(value);
    },
    canApprove,
    failureMessage,
    isApproving,
    confirm: () => void confirm(),
  };
}
