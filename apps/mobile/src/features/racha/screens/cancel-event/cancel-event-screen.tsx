import { ConfirmBottomSheet } from "@/ui/components";
import { CANCEL_EVENT_TITLE } from "../../utils/racha-messages";
import { useCancelEventScreen } from "./use-cancel-event-screen";

export const CancelEventScreen = () => {
  const { isMissing, isCancelling, failureMessage, confirm, cancel } =
    useCancelEventScreen();

  if (isMissing) return null;

  return (
    <ConfirmBottomSheet
      title={CANCEL_EVENT_TITLE}
      message="Não dá para desfazer."
      confirmLabel="Cancelar evento"
      cancelLabel="Voltar"
      busyLabel="Cancelando"
      isBusy={isCancelling}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
