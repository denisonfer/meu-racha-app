import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useEventMatch } from "../../hooks/use-event-match";
import { useEventMatchActions } from "../../hooks/use-event-match-actions";
import { matchFailureMessage } from "../../utils/racha-messages";

export function useMatchDiscardScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const matchQuery = useEventMatch(id, eventId);
  const { discardEventMatch } = useEventMatchActions(id, eventId);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const matchId = matchQuery.data?.match?.id;

  const confirm = async () => {
    if (!matchId || isDiscarding) return;
    setFailureMessage(null);
    setIsDiscarding(true);
    try {
      await discardEventMatch(matchId);
      router.back();
    } catch (error) {
      if (!navigation.isFocused()) {
        showToast(matchFailureMessage(error), "danger");
        return;
      }
      setIsDiscarding(false);
      setFailureMessage(matchFailureMessage(error));
    }
  };

  return {
    isMissing: !matchId,
    isDiscarding,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
