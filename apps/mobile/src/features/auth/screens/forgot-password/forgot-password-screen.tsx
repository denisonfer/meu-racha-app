import { StyleSheet, View } from "react-native";
import { Button, FormInput, Screen, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { useForgotPasswordScreen } from "./use-forgot-password-screen";

export const ForgotPasswordScreen = () => {
  const { control, isPending, isSent, cooldown, submit, resend, backToSignIn } =
    useForgotPasswordScreen();

  if (isSent) {
    return (
      <Screen>
        <View style={styles.content}>
          <Text preset="h2">Confira seu e-mail</Text>
          <Text preset="body" color="muted">
            Se esse e-mail estiver cadastrado, o link chegou. Ele vale por 1
            hora e serve uma vez só.
          </Text>
          <Text preset="small" color="muted">
            Não achou? Olhe o spam. O link pode demorar alguns minutos.
          </Text>
        </View>

        <ScreenFooter>
          <Button
            title="Voltar para o login"
            preset="secondary"
            onPress={backToSignIn}
          />
          <Button
            title={
              cooldown > 0 ? `Enviar de novo (${cooldown}s)` : "Enviar de novo"
            }
            preset="text"
            isDisabled={cooldown > 0}
            isLoading={isPending}
            onPress={resend}
          />
        </ScreenFooter>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text preset="h2">Recuperar senha</Text>
        <Text preset="body" color="muted">
          Mandamos um link para o e-mail do seu cadastro. Ele vale por 1 hora e
          serve uma vez só.
        </Text>
        <FormInput
          control={control}
          name="email"
          label="E-mail"
          preset="email"
          placeholder="o e-mail do cadastro"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>

      <ScreenFooter>
        <Button title="Enviar link" isLoading={isPending} onPress={submit} />
        <Button
          title="Voltar para o login"
          preset="text"
          onPress={backToSignIn}
        />
      </ScreenFooter>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: theme.space[16],
    paddingTop: theme.space[16],
  },
});
