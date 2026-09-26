import { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Button, FormInput, LogoLockup, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { useSignInScreen } from "./use-sign-in-screen";

export const SignInScreen = () => {
  const { control, isPending, submit, navigateToSignUp } = useSignInScreen();

  const passwordRef = useRef<TextInput>(null);

  return (
    <Screen>
      <View style={styles.header}>
        <LogoLockup height={44} />
        <Text preset="body" color="muted">
          Organize. Sorteie. Jogue.
        </Text>
      </View>

      <View style={styles.form}>
        <FormInput
          control={control}
          name="username"
          label="Username"
          preset="username"
          placeholder="seu_username"
          next={passwordRef}
        />

        <FormInput
          ref={passwordRef}
          control={control}
          name="password"
          label="Senha"
          preset="password"
          placeholder="sua senha"
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        <Button
          title="Esqueci minha senha"
          preset="text"
          onPress={() => {}}
          style={{ alignSelf: "flex-end" }}
        />
      </View>

      <View style={styles.footer}>
        <Button title="Entrar" isLoading={isPending} onPress={submit} />
        <View style={styles.footerLink}>
          <Text preset="small" color="muted">
            Não tem uma conta?
          </Text>
          <Button
            title="Criar conta"
            preset="text"
            onPress={navigateToSignUp}
          />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    gap: theme.space[4],
    paddingVertical: theme.space[48],
  },
  form: {
    gap: theme.space[16],
  },
  footer: {
    marginTop: "auto",
    gap: theme.space[8],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
    paddingTop: theme.space[16],
  },
  footerLink: {
    flexDirection: "row",
    gap: theme.space[4],
    alignItems: "center",
    justifyContent: "center",
  },
});
