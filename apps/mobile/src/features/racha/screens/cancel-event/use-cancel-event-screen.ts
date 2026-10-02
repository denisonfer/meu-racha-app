import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useCancelEvent } from "../../hooks/use-cancel-event";
import { ACTION_FAILED } from "../../utils/racha-messages";

export function useCancelEventScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const { cancelEvent } = useCancelEvent(id);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [isCancelling, setIsCancelling] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const isMissing = !eventId;
  useEffect(() => {
    if (isMissing) router.back();
  }, [isMissing]);

  const confirm = async () => {
    if (!eventId) return;
    setFailureMessage(null);
    setIsCancelling(true);
    try {
      await cancelEvent(eventId);
      // isCancelling fica true: evita o segundo toque e o piscar do botão enquanto a folha fecha
      router.dismissTo(`/racha/${id}`);
    } catch {
      // a folha pode ter perdido o foco (fechada no arrasto, o que o Android não deixa impedir):
      // sem a tela em foco pra mostrar o erro no rodapé, ele vai pro toast
      if (!navigation.isFocused()) {
        showToast(ACTION_FAILED);
        return;
      }
      setIsCancelling(false);
      setFailureMessage(ACTION_FAILED);
    }
  };

  return {
    isMissing,
    isCancelling,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
