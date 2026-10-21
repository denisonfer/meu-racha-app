import { StyleSheet, View } from "react-native";
import { Button, FormInput, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { useDevHubScreen } from "./use-dev-hub-screen";

export const DevHubScreen = () => {
  const { control, isStaging, buildLabel, isPending, submit, leave, close } =
    useDevHubScreen();

  return (
    <Screen>
      <View style={styles.content}>
        <Text preset="h2">DevHub</Text>
        <Text preset="body" color="muted">
          Ambiente atual: {isStaging ? "Homolog" : buildLabel}
        </Text>

        {isStaging ? (
          <Button
            title={`Voltar para ${buildLabel}`}
            isLoading={isPending}
            onPress={leave}
          />
        ) : (
          <>
            <FormInput
              control={control}
              name="key"
              label="Chave"
              preset="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Button
              title="Entrar no Homolog"
              isLoading={isPending}
              onPress={submit}
            />
          </>
        )}

        <Button
          title="Fechar"
          preset="text"
          isDisabled={isPending}
          onPress={close}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: theme.space[16],
    paddingVertical: theme.space[24],
  },
});
