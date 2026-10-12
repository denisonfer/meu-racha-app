import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BottomSheet, Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  DELETE_ACCOUNT_CHECK_FAILED,
  DELETE_ACCOUNT_RETRY,
  DELETE_ACCOUNT_TITLE,
} from "../../utils/settings-messages";
import { DeleteAccountBlocked } from "./delete-account-blocked";
import { DeleteAccountConfirm } from "./delete-account-confirm";
import { useDeleteAccountScreen } from "./use-delete-account-screen";

export const DeleteAccountScreen = () => {
  const {
    sheet,
    hasCheckFailed,
    retryCheck,
    loseRachas,
    ownedRachas,
    conducting,
    isDeleting,
    failureMessage,
    confirm,
    cancel,
    openRacha,
    openEvent,
  } = useDeleteAccountScreen();

  if (sheet === "blocked")
    return (
      <DeleteAccountBlocked
        ownedRachas={ownedRachas}
        conducting={conducting}
        onOpenRacha={openRacha}
        onOpenEvent={openEvent}
      />
    );

  if (sheet === "confirm")
    return (
      <DeleteAccountConfirm
        loseRachas={loseRachas}
        isBusy={isDeleting}
        failureMessage={failureMessage}
        onConfirm={confirm}
        onCancel={cancel}
      />
    );

  return (
    <BottomSheet title={DELETE_ACCOUNT_TITLE}>
      {hasCheckFailed ? (
        <View style={styles.failed}>
          <Text accessibilityRole="alert">{DELETE_ACCOUNT_CHECK_FAILED}</Text>
          <Button title={DELETE_ACCOUNT_RETRY} onPress={retryCheck} />
        </View>
      ) : (
        <ActivityIndicator
          color={theme.colors.foreground}
          style={styles.loading}
        />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  failed: { gap: theme.space[16] },
  loading: { paddingVertical: theme.space[24] },
});
