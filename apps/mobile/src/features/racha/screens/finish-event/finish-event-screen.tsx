import { ConfirmBottomSheet } from "@/ui/components";
import {
  FINISH_EVENT_NOT_UNDONE,
  FINISH_EVENT_REVIEWED,
  FINISH_EVENT_TITLE,
} from "../../utils/racha-messages";
import { useFinishEventScreen } from "./use-finish-event-screen";

export const FinishEventScreen = () => {
  const {
    isMissing,
    isLoading,
    isPaid,
    paidSummary,
    isFinishing,
    failureMessage,
    confirm,
    cancel,
  } = useFinishEventScreen();

  if (isMissing || isLoading) return null;

  return (
    <ConfirmBottomSheet
      title={FINISH_EVENT_TITLE}
      message={
        paidSummary
          ? `${paidSummary}\n${FINISH_EVENT_NOT_UNDONE}`
          : FINISH_EVENT_NOT_UNDONE
      }
      confirmLabel={isPaid ? FINISH_EVENT_REVIEWED : "Encerrar evento"}
      busyLabel="Encerrando"
      isBusy={isFinishing}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
