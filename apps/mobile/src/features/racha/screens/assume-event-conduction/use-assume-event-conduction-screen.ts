import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useAssumeEventConduction } from "../../hooks/use-assume-event-conduction";
import { useOpenEvents } from "../../hooks/use-open-events";
import { ACTION_FAILED } from "../../utils/racha-messages";

export function useAssumeEventConductionScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const { assumeEventConduction } = useAssumeEventConduction(id);
  const eventsQuery = useOpenEvents(id);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [isAssuming, setIsAssuming] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const isMissing = !eventId;
  const event = eventsQuery.data?.find((item) => item.id === eventId);
  const isUpcoming = event?.status === "upcoming";
  const canAssume = event?.status === "active" || isUpcoming;
  useEffect(() => {
    if (isMissing || (eventsQuery.isFetched && !canAssume)) router.back();
  }, [isMissing, eventsQuery.isFetched, canAssume]);

  const confirm = async () => {
    if (!eventId || !canAssume || isAssuming) return;
    setFailureMessage(null);
    setIsAssuming(true);
    try {
      await assumeEventConduction(eventId);
      router.dismissTo(`/racha/${id}`);
      // assumir a preparação do Sorteio leva direto a ele; o voltar cai na home
      if (isUpcoming) router.push(`/racha/${id}/event/${eventId}/sort`);
    } catch {
      if (!navigation.isFocused()) {
        showToast(ACTION_FAILED);
        return;
      }
      setIsAssuming(false);
      setFailureMessage(ACTION_FAILED);
    }
  };

  return {
    isMissing,
    canAssume,
    isUpcoming,
    conductorName: event?.conductorName ?? null,
    isAssuming,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
