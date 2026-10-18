import { maskPixKey, pixKeyTypeLabel } from "@meu-racha/domain";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useToast } from "@/ui/components";
import { usePayment } from "../../hooks/use-payment";
import { useOpenEvents } from "../../hooks/use-open-events";
import { useRacha } from "../../hooks/use-racha";
import { paymentView } from "../../utils/payment-view";
import {
  payKeyLine,
  payRecipient,
  PAY_COPIED,
} from "../../utils/racha-messages";

export function usePayScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const { data: racha } = useRacha(id);
  const { data: events } = useOpenEvents(id);
  const paymentQuery = usePayment(id, eventId);
  const showToast = useToast();
  const [failedCode, setFailedCode] = useState<string | null>(null);

  const { refetch } = paymentQuery;
  // volta do app do banco: o Dono/Admin pode ter marcado "pagou" nesse meio-tempo
  useFocusEffect(
    useCallback(() => {
      void refetch({ cancelRefetch: false });
    }, [refetch])
  );

  const payment = paymentQuery.data;
  const view = payment ? paymentView(payment) : null;
  const event = events?.find((item) => item.id === eventId);
  const brCode = view?.brCode ?? null;

  const copy = async () => {
    if (!brCode) return;
    await Clipboard.setStringAsync(brCode);
    showToast(PAY_COPIED, "success");
  };

  return {
    isLoading: paymentQuery.isPending,
    isError: paymentQuery.isError,
    retry: () => void paymentQuery.refetch(),
    isRetrying: paymentQuery.isRefetching,
    context:
      racha && event
        ? `${racha.name} · ${event.startsOn.slice(8, 10)}/${event.startsOn.slice(5, 7)}`
        : (racha?.name ?? ""),
    kind: view?.kind ?? null,
    isWaitlisted: payment?.isWaitlisted ?? false,
    amountText: view ? `R$ ${view.amountDue}` : "",
    creditLeft: view?.creditLeft ?? 0,
    rows: view?.rows ?? [],
    recipient: payment ? payRecipient(payment.recipientName) : "",
    keyLine:
      payment?.pixKey && payment.pixKeyType
        ? payKeyLine(
            pixKeyTypeLabel(payment.pixKeyType),
            maskPixKey(payment.pixKey, payment.pixKeyType)
          )
        : null,
    brCode,
    // o QR que falhou vale para este código; um valor novo tenta de novo
    isQrFailed: brCode !== null && failedCode === brCode,
    onQrError: () => setFailedCode(brCode),
    copy: () => void copy(),
  };
}
