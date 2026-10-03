import { BottomSheet, Button, Text } from "@/ui/components";
import {
  SORT_BACK,
  SORT_CONFIRM_SHEET_TEXT,
  SORT_CONFIRM_SHEET_TITLE,
  SORT_CONFIRM_TEAMS,
} from "../../utils/racha-messages";
import { useConfirmSortScreen } from "./use-confirm-sort-screen";

export const ConfirmSortScreen = () => {
  const { isMissing, isConfirming, failureMessage, confirm, cancel } =
    useConfirmSortScreen();

  if (isMissing) return null;

  return (
    <BottomSheet
      title={SORT_CONFIRM_SHEET_TITLE}
      supporting={<Text>{SORT_CONFIRM_SHEET_TEXT}</Text>}
      hasCloseButton={false}
      isBusy={isConfirming}
    >
      {failureMessage ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {failureMessage}
        </Text>
      ) : null}
      <Button
        title={SORT_CONFIRM_TEAMS}
        isLoading={isConfirming}
        onPress={confirm}
      />
      <Button
        title={SORT_BACK}
        preset="outline"
        isDisabled={isConfirming}
        onPress={cancel}
      />
    </BottomSheet>
  );
};
