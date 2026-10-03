import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import {
  useEventSortDraft,
  useEventSortProposal,
} from "../../hooks/use-event-sort-proposal";
import { sortFailureMessage } from "../../utils/racha-messages";

// a proposta velha ou o Sorteio já publicado: a tela de baixo mostra o que vale
const CLOSES_SHEET = [
  "roster_changed",
  "proposal_outdated",
  "already_confirmed",
  "event_not_upcoming",
  "no_proposal",
];

export function useConfirmSortScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const proposalQuery = useEventSortProposal(id, eventId, true);
  const { confirmEventSort } = useEventSortDraft(id, eventId);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [isConfirming, setIsConfirming] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const proposal = proposalQuery.data;
  const version = proposal?.state === "ready" ? proposal.version : null;
  const isMissing = !eventId || (proposalQuery.isSuccess && version === null);
  useEffect(() => {
    if (isMissing && !isConfirming && navigation.isFocused()) router.back();
  }, [isMissing, isConfirming, navigation]);

  const confirm = async () => {
    if (version === null || isConfirming) return;
    setFailureMessage(null);
    setIsConfirming(true);
    try {
      // só o banco confirma: a tela de Times abre com a resposta dele
      await confirmEventSort(version);
      router.dismissTo(`/racha/${id}/event/${eventId}/sort`);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (CLOSES_SHEET.includes(code)) {
        router.back();
        return;
      }
      if (!navigation.isFocused()) {
        showToast(sortFailureMessage(error), "danger");
        return;
      }
      setIsConfirming(false);
      setFailureMessage(sortFailureMessage(error));
    }
  };

  return {
    isMissing: isMissing || version === null,
    isConfirming,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
