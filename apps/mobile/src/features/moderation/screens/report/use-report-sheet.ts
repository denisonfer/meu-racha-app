import { useMutation } from "@tanstack/react-query";
import { useNavigation } from "expo-router";
import { useState } from "react";
import { useBottomSheetClose, useToast } from "@/ui/components";
import { moderationApi } from "../../moderation-api";
import type { TReportKind, TReportReason } from "../../moderation-types";
import {
  firstName,
  REPORT_FAILED,
  REPORT_RACHA_TEXT,
  REPORT_REASONS_PROFILE,
  REPORT_REASONS_RACHA,
  REPORT_SENT_PROFILE,
  REPORT_SENT_RACHA,
  reportProfileText,
  reportSentBlockAction,
  reportSentBlockAsk,
  reportTitle,
} from "../../utils/moderation-messages";
import type { TReportFormProps } from "./report-form";
import type { TReportSentProps } from "./report-sent";

const optionsOf = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, title]) => ({
    value: value as TReportReason,
    title,
  }));

export type TReportTarget = {
  kind: TReportKind;
  id: string;
  name: string;
  /** Só no Perfil ainda não bloqueado: a folha enviada oferece bloquear. */
  onBlock: (() => void) | null;
};

export type TReportSheetProps = {
  isSent: boolean;
  form: TReportFormProps;
  sent: TReportSentProps;
};

export function useReportSheet(target: TReportTarget): TReportSheetProps {
  const navigation = useNavigation();
  const showToast = useToast();
  const close = useBottomSheetClose();
  const [reason, setReason] = useState<TReportReason | "">("");
  const [details, setDetails] = useState("");
  const [hasFailed, setHasFailed] = useState(false);
  const mutation = useMutation({
    mutationFn: (chosen: TReportReason) =>
      moderationApi.reportContent(target.kind, target.id, chosen, details),
  });

  const isProfile = target.kind === "profile";
  const first = firstName(target.name);

  const send = async () => {
    if (!reason || mutation.isPending) return;
    setHasFailed(false);
    try {
      await mutation.mutateAsync(reason);
    } catch {
      // a folha pode ter saído no arrasto do Android: o erro vai para o toast
      if (navigation.isFocused()) setHasFailed(true);
      else showToast(REPORT_FAILED);
    }
  };

  return {
    isSent: mutation.isSuccess,
    form: {
      title: reportTitle(target.name),
      text: isProfile ? reportProfileText(first) : REPORT_RACHA_TEXT,
      options: optionsOf(
        isProfile ? REPORT_REASONS_PROFILE : REPORT_REASONS_RACHA
      ),
      reason,
      onReasonChange: (value) => {
        setHasFailed(false);
        setReason(value);
      },
      details,
      onDetailsChange: setDetails,
      isSending: mutation.isPending,
      failureMessage: hasFailed ? REPORT_FAILED : null,
      onSend: () => void send(),
    },
    sent: {
      text: isProfile ? REPORT_SENT_PROFILE : REPORT_SENT_RACHA,
      blockAsk: target.onBlock ? reportSentBlockAsk(first) : null,
      blockAction: reportSentBlockAction(first),
      onBlock: () => target.onBlock?.(),
      onClose: close,
    },
  };
}
