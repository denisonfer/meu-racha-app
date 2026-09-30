import { ConfirmBottomSheet } from "@/ui/components";
import { useLeaveRachaScreen } from "./use-leave-racha-screen";

export const LeaveRachaScreen = () => {
  const { name, isLeaving, failureMessage, confirm, cancel } =
    useLeaveRachaScreen();

  if (!name) return null;

  return (
    <ConfirmBottomSheet
      title={`Deixar ${name}?`}
      message="Para voltar, você vai precisar pedir de novo."
      confirmLabel="Deixar o racha"
      busyLabel="Saindo"
      isBusy={isLeaving}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
