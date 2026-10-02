import { ConfirmBottomSheet } from "@/ui/components";
import { FINISH_EVENT_TITLE } from "../../utils/racha-messages";
import { useFinishEventScreen } from "./use-finish-event-screen";

export const FinishEventScreen = () => {
  const { isMissing, isFinishing, failureMessage, confirm, cancel } =
    useFinishEventScreen();

  if (isMissing) return null;

  return (
    <ConfirmBottomSheet
      title={FINISH_EVENT_TITLE}
      message="Não dá para desfazer."
      confirmLabel="Encerrar evento"
      busyLabel="Encerrando"
      isBusy={isFinishing}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
