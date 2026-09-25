import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button, FormInput, LogoLockup, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { useSignIn } from "../../hooks/use-sign-in";
import { signInSchema, TSignInForm } from "./sign-in-schema";

export const SignInScreen = () => {
  const { signIn, isPending, error } = useSignIn();

  const { control, handleSubmit } = useForm<TSignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { username: "", password: "" },
    mode: "onBlur",
  });

  return (
    <Screen isScrollable>
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
          returnKeyType="next"
        />

        <FormInput
          control={control}
          name="password"
          label="Senha"
          preset="password"
          placeholder="sua senha"
          returnKeyType="go"
          onSubmitEditing={handleSubmit((values) => signIn(values))}
        />

        {error ? (
          <Text preset="small" color="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Button
          title="Entrar"
          isLoading={isPending}
          onPress={handleSubmit((values) => signIn(values))}
        />
      </View>

      <View style={styles.footer}>
        <Text preset="small" color="muted">
          Primeira vez por aqui?
        </Text>
        <Button
          title="Criar conta"
          preset="secondary"
          onPress={() => router.push("/sign-up")}
        />
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
    alignItems: "center",
    gap: theme.space[8],
    marginTop: theme.space[40],
  },
});
