import { ConfirmBottomSheet } from "@/ui/components";
import { useDeleteRachaScreen } from "./use-delete-racha-screen";

export const DeleteRachaScreen = () => {
  const { name, isDeleting, failureMessage, confirm, cancel } =
    useDeleteRachaScreen();

  if (!name) return null;

  return (
    <ConfirmBottomSheet
      title={`Excluir ${name}?`}
      message="Não dá para desfazer."
      confirmLabel="Excluir racha"
      busyLabel="Excluindo"
      isBusy={isDeleting}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
