import { useRef } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import { Button, FormInput, Screen, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { useResetPasswordScreen } from "./use-reset-password-screen";

export const ResetPasswordScreen = () => {
  const {
    status,
    retry,
    control,
    isPending,
    isPasswordChanged,
    submit,
    requestNewLink,
    backToSignIn,
  } = useResetPasswordScreen();
  const confirmationRef = useRef<TextInput>(null);

  if (status === "checking") {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    );
  }

  if (status === "offline") {
    return (
      <Screen>
        <View style={styles.content}>
          <Text preset="h2">Sem conexão</Text>
          <Text preset="body" color="muted">
            Seu link continua valendo. Conecte-se e tente de novo.
          </Text>
        </View>
        <ScreenFooter>
          <Button title="Tentar de novo" onPress={retry} />
        </ScreenFooter>
      </Screen>
    );
  }

  if (status === "dead") {
    return (
      <Screen>
        <View style={styles.content}>
          <Text preset="h2">Esse link não vale mais</Text>
          <Text preset="body" color="muted">
            O link vale 1 hora e serve uma vez só. Esse já foi usado ou passou
            do prazo.
          </Text>
          <Text preset="small" color="muted">
            Peça outro: ele chega no mesmo e-mail.
          </Text>
        </View>
        <ScreenFooter>
          <Button title="Pedir outro link" onPress={requestNewLink} />
          <Button
            title="Voltar para o login"
            preset="text"
            onPress={backToSignIn}
          />
        </ScreenFooter>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text preset="h2">Nova senha</Text>
        <Text preset="body" color="muted">
          Ao trocar, as outras sessões são encerradas. Só esta continua.
        </Text>
        <FormInput
          control={control}
          name="password"
          label="Nova senha"
          preset="password"
          placeholder="mínimo de 8 caracteres"
          isDisabled={isPasswordChanged}
          next={confirmationRef}
        />
        <FormInput
          ref={confirmationRef}
          control={control}
          name="confirmation"
          label="Repita a senha"
          preset="password"
          isDisabled={isPasswordChanged}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>
      <ScreenFooter>
        <Button title="Trocar senha" isLoading={isPending} onPress={submit} />
      </ScreenFooter>
    </Screen>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1 },
  content: {
    gap: theme.space[16],
    paddingTop: theme.space[16],
  },
});
