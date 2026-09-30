import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  Button,
  EmptyState,
  Screen,
  ScreenFooter,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { RachaForm } from "../../components/racha-form";
import { TRacha } from "../../racha-types";
import {
  useRachaSettingsForm,
  useRachaSettingsScreen,
} from "./use-racha-settings-screen";

export const RachaSettingsScreen = () => {
  const { racha, isLoading, retry, isRetrying } = useRachaSettingsScreen();

  return (
    <Screen title="Configurações do racha" canGoBack>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : !racha ? (
        <EmptyState
          title="Não deu pra abrir o racha"
          text="Confira a internet e tente de novo."
          actionLabel="Tentar de novo"
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : (
        <RachaSettingsForm racha={racha} />
      )}
    </Screen>
  );
};

const RachaSettingsForm = ({ racha }: { racha: TRacha }) => {
  const {
    form,
    minAgeRestoreValue,
    isSaving,
    isDirty,
    failureMessage,
    save,
    openDelete,
  } = useRachaSettingsForm(racha);

  return (
    <>
      <RachaForm
        {...form}
        minAgeRestoreValue={minAgeRestoreValue}
        isRulesHintVisible={false}
        isDisabled={isSaving}
      >
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
