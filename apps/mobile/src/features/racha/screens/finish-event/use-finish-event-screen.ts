import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useFinishEvent } from "../../hooks/use-finish-event";
import { ACTION_FAILED } from "../../utils/racha-messages";

export function useFinishEventScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const { finishEvent } = useFinishEvent(id);
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [isFinishing, setIsFinishing] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const isMissing = !eventId;
  useEffect(() => {
    if (isMissing) router.back();
  }, [isMissing]);

  const confirm = async () => {
    if (!eventId) return;
    setFailureMessage(null);
    setIsFinishing(true);
    try {
      await finishEvent(eventId);
      // isFinishing fica true: evita o segundo toque e o piscar do botão enquanto a folha fecha.
      // encerrar não abre outro evento
      router.dismissTo(`/racha/${id}`);
    } catch {
      // a folha pode ter perdido o foco (fechada no arrasto, o que o Android não deixa impedir):
      // sem a tela em foco pra mostrar o erro no rodapé, ele vai pro toast
      if (!navigation.isFocused()) {
        showToast(ACTION_FAILED);
        return;
      }
      setIsFinishing(false);
      setFailureMessage(ACTION_FAILED);
    }
  };

  return {
    isMissing,
    isFinishing,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
