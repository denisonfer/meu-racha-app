import { ConfirmBottomSheet } from "@/ui/components";
import {
  BLOCK_BUSY,
  BLOCK_CONFIRM,
  blockText,
  blockTitle,
} from "../../utils/moderation-messages";
import { useBlockProfileScreen } from "./use-block-profile-screen";

export const BlockProfileScreen = () => {
  const { name, firstName, isBlocking, failureMessage, confirm, cancel } =
    useBlockProfileScreen();

  if (name === undefined) return null;

  return (
    <ConfirmBottomSheet
      title={blockTitle(name)}
      message={blockText(firstName)}
      confirmLabel={BLOCK_CONFIRM}
      busyLabel={BLOCK_BUSY}
      isBusy={isBlocking}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
