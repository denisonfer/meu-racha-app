import { StyleSheet, View } from "react-native";
import { Button, Icon, Screen, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { InviteCodeField } from "../../components/invite-code-field";
import { useEnterCodeScreen } from "./use-enter-code-screen";

export const EnterCodeScreen = () => {
  const {
    code,
    changeCode,
    codeError,
    networkError,
    isChecking,
    canSubmit,
    submit,
  } = useEnterCodeScreen();

  return (
    <Screen title="Entrar com código" canGoBack>
      <InviteCodeField
        value={code}
        onChange={changeCode}
        error={codeError}
        isDisabled={isChecking}
        onSubmit={submit}
      />

      <ScreenFooter>
        {networkError ? (
          <View style={styles.networkError} accessibilityRole="alert">
            <Icon name="wifi-off" color="muted" />
            <Text preset="small" style={styles.networkErrorText}>
              {networkError}
            </Text>
          </View>
        ) : null}
        <Button
          title="Continuar"
          accessibilityLabel={isChecking ? "Verificando" : "Continuar"}
          isLoading={isChecking}
          isDisabled={!canSubmit}
          onPress={submit}
        />
      </ScreenFooter>
    </Screen>
  );
};

const styles = StyleSheet.create({
  networkError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    backgroundColor: theme.colors.surface,
  },
  networkErrorText: { flex: 1, fontFamily: "Manrope-Bold" },
});
