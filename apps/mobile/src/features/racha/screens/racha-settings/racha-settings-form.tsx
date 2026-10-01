import { StyleSheet, View } from "react-native";
import { Button, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { RachaForm } from "../../components/racha-form";
import { TRacha } from "../../racha-types";
import { useRachaSettingsForm } from "./use-racha-settings-screen";

export const RachaSettingsForm = ({ racha }: { racha: TRacha }) => {
  const { form, isSaving, isDirty, failureMessage, save, openDelete } =
    useRachaSettingsForm(racha);

  return (
    <>
      <RachaForm {...form} isRulesHintVisible={false} isDisabled={isSaving}>
        <View style={styles.deleteZone}>
          <Button
            preset="destructiveOutline"
            title="Excluir racha"
            accessibilityHint="Abre a confirmação"
            isDisabled={isSaving}
            onPress={openDelete}
            style={styles.deleteButton}
          />
        </View>
      </RachaForm>

      <ScreenFooter>
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title="Salvar"
          accessibilityLabel={isSaving ? "Salvando" : "Salvar"}
          accessibilityHint={
            isDirty ? undefined : "Altere algum campo para salvar"
          }
          isLoading={isSaving}
          isDisabled={!isDirty}
          onPress={save}
        />
      </ScreenFooter>
    </>
  );
};

const styles = StyleSheet.create({
  deleteZone: {
    marginTop: theme.space[16],
    paddingTop: theme.space[32],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  deleteButton: { minHeight: 48 },
});
