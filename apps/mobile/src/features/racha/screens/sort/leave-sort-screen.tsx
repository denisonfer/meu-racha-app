import { ConfirmBottomSheet } from "@/ui/components";
import {
  SORT_LEAVE_BUSY,
  SORT_LEAVE_CONFIRM,
} from "../../utils/racha-messages";
import { useLeaveSortScreen } from "./use-leave-sort-screen";

export const LeaveSortScreen = () => {
  const {
    isMissing,
    title,
    message,
    isLeaving,
    failureMessage,
    confirm,
    cancel,
  } = useLeaveSortScreen();

  if (isMissing) return null;

  return (
    <ConfirmBottomSheet
      title={title}
      message={message}
      confirmLabel={SORT_LEAVE_CONFIRM}
      busyLabel={SORT_LEAVE_BUSY}
      isBusy={isLeaving}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
