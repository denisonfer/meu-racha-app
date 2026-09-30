import { ConfirmBottomSheet } from "@/ui/components";
import { useExpelMemberScreen } from "./use-expel-member-screen";

export const ExpelMemberScreen = () => {
  const { name, isExpelling, failureMessage, confirm, cancel } =
    useExpelMemberScreen();

  if (!name) return null;

  return (
    <ConfirmBottomSheet
      title={`Expulsar ${name}?`}
      message="A pessoa pode pedir para entrar de novo."
      confirmLabel="Expulsar"
      busyLabel="Expulsando"
      isBusy={isExpelling}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
