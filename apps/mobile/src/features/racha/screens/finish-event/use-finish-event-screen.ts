import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { useEventAttendance } from "../../hooks/use-event-attendance";
import { useFinishEvent } from "../../hooks/use-finish-event";
import { useOpenEvents } from "../../hooks/use-open-events";
import {
  finishEventErrorMessage,
  finishEventPaidSummary,
} from "../../utils/racha-messages";

export function useFinishEventScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const { finishEvent } = useFinishEvent(id);
  const eventsQuery = useOpenEvents(id);
  const attendanceQuery = useEventAttendance(id, eventId);
  const isPaid = eventsQuery.data?.find((item) => item.id === eventId)?.isPaid;
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
      // Evento pago: o botão da folha é a conferência dos pagamentos
      await finishEvent({ eventId, paymentsReviewed: isPaid === true });
      // isFinishing fica true: evita o segundo toque e o piscar do botão enquanto a folha fecha.
      // depois do settle, a Presença mostra quem pagou e a Meta
      router.dismissTo(`/racha/${id}/event/${eventId}/attendance`);
    } catch (error) {
      // a folha pode ter perdido o foco (fechada no arrasto, o que o Android não deixa impedir):
      // sem a tela em foco pra mostrar o erro no rodapé, ele vai pro toast
      if (!navigation.isFocused()) {
        showToast(finishEventErrorMessage(error));
        return;
      }
      setIsFinishing(false);
      setFailureMessage(finishEventErrorMessage(error));
    }
  };

  const attendance = attendanceQuery.data;
  // resumo só com a Presença carregada; sem ele a folha ainda pede a conferência
  const paidSummary =
    isPaid && attendance
      ? finishEventPaidSummary(
          attendance.people.filter((person) => person.didAttend).length,
          attendance.presentPayerCount,
          attendance.payerTarget
        )
      : null;

  return {
    isPaid: isPaid === true,
    paidSummary,
    // sem saber se é pago a folha errada pediria o botão errado
    isLoading: eventsQuery.isPending,
    isMissing,
    isFinishing,
    failureMessage,
    confirm: () => void confirm(),
    cancel: close,
  };
}
