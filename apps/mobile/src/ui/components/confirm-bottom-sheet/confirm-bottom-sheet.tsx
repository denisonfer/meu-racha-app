import { StyleSheet, View } from "react-native";
import { theme } from "@/ui/theme";
import { BottomSheet } from "../bottom-sheet/bottom-sheet";
import { Button } from "../button/button";
import { Text } from "../text/text";

export type TConfirmBottomSheetProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  busyLabel: string;
  isBusy: boolean;
  failureMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmBottomSheet = ({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  busyLabel,
  isBusy,
  failureMessage,
  onConfirm,
  onCancel,
}: TConfirmBottomSheetProps) => (
  <BottomSheet
    title={title}
    supporting={<Text>{message}</Text>}
    hasCloseButton={false}
    isBusy={isBusy}
  >
    {failureMessage ? (
      <Text preset="small" color="errorText" accessibilityRole="alert">
        {failureMessage}
      </Text>
    ) : null}
    <View style={styles.actions}>
      <Button
        title={confirmLabel}
        preset="destructive"
        onPress={onConfirm}
        isLoading={isBusy}
        accessibilityLabel={isBusy ? busyLabel : confirmLabel}
        style={styles.confirmButton}
      />
      <Button
        title={cancelLabel}
        preset="outline"
        onPress={onCancel}
        isDisabled={isBusy}
        style={styles.cancelButton}
      />
    </View>
  </BottomSheet>
);

const styles = StyleSheet.create({
  actions: { gap: theme.space[8] },
  confirmButton: { minHeight: 56 },
  cancelButton: { minHeight: 48 },
});
