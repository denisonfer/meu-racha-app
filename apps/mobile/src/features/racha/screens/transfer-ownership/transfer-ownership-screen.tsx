import { ConfirmBottomSheet } from "@/ui/components";
import { useTransferOwnershipScreen } from "./use-transfer-ownership-screen";

export const TransferOwnershipScreen = () => {
  const { rachaName, name, isTransferring, failureMessage, confirm, cancel } =
    useTransferOwnershipScreen();

  if (!name || !rachaName) return null;

  return (
    <ConfirmBottomSheet
      title={`Passar ${rachaName} para ${name}?`}
      message={`${name} vira dono e você vira admin. Só volta a ser seu se a pessoa passar de volta.`}
      confirmLabel="Passar o racha"
      busyLabel="Passando"
      isBusy={isTransferring}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
