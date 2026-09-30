import { StyleSheet, View } from "react-native";
import { BottomSheet, Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { useDeleteRachaScreen } from "./use-delete-racha-screen";

export const DeleteRachaScreen = () => {
  const { name, isDeleting, failureMessage, confirm, cancel } =
    useDeleteRachaScreen();

  if (!name) return null;

  return (
    <BottomSheet
      title={`Excluir ${name}?`}
      supporting={<Text>Não dá para desfazer.</Text>}
      hasCloseButton={false}
      isBusy={isDeleting}
    >
      {failureMessage ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {failureMessage}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          title="Excluir racha"
          preset="destructive"
          onPress={confirm}
          isLoading={isDeleting}
          accessibilityLabel={isDeleting ? "Excluindo" : "Excluir racha"}
          style={styles.deleteButton}
        />
        <Button
          title="Cancelar"
          preset="outline"
          onPress={cancel}
          isDisabled={isDeleting}
          style={styles.cancelButton}
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  actions: { gap: theme.space[8] },
  deleteButton: { minHeight: 56 },
  cancelButton: { minHeight: 48 },
});
