import { ConfirmBottomSheet } from "@/ui/components";
import {
  ATTENDANCE_REMOVE_GUEST,
  ATTENDANCE_REMOVE_GUEST_BUSY,
  ATTENDANCE_REMOVE_GUEST_MESSAGE,
  ATTENDANCE_REMOVE_GUEST_TITLE,
} from "../../utils/racha-messages";
import { useRemoveGuestScreen } from "./use-remove-guest-screen";

export const RemoveGuestScreen = () => {
  const { name, isRemoving, failureMessage, confirm, cancel } =
    useRemoveGuestScreen();

  if (!name) return null;

  return (
    <ConfirmBottomSheet
      title={ATTENDANCE_REMOVE_GUEST_TITLE(name)}
      message={ATTENDANCE_REMOVE_GUEST_MESSAGE}
      confirmLabel={ATTENDANCE_REMOVE_GUEST}
      busyLabel={ATTENDANCE_REMOVE_GUEST_BUSY}
      isBusy={isRemoving}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
