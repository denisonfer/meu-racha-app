import { ConfirmBottomSheet } from "@/ui/components";
import {
  MATCH_DISCARD_BUSY,
  MATCH_DISCARD_CONFIRM,
  MATCH_DISCARD_TEXT,
  MATCH_DISCARD_TITLE,
} from "../../utils/racha-messages";
import { useMatchDiscardScreen } from "./use-match-discard-screen";

export const MatchDiscardScreen = () => {
  const { isMissing, isDiscarding, failureMessage, confirm, cancel } =
    useMatchDiscardScreen();

  if (isMissing) return null;

  return (
    <ConfirmBottomSheet
      title={MATCH_DISCARD_TITLE}
      message={MATCH_DISCARD_TEXT}
      confirmLabel={MATCH_DISCARD_CONFIRM}
      busyLabel={MATCH_DISCARD_BUSY}
      isBusy={isDiscarding}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
};
