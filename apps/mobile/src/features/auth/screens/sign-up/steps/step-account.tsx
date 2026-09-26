import { useRef } from "react";
import { Control, useWatch } from "react-hook-form";
import { StyleSheet, TextInput, View } from "react-native";
import { FormInput, Text, TInputStatus } from "@/ui/components";
import { theme } from "@/ui/theme";
import { useAvailability } from "../../../hooks/use-availability";
import { TSignUpFormInput } from "../sign-up-schema";

export const StepAccount = ({
  control,
}: {
  control: Control<TSignUpFormInput>;
}) => {
  const displayNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const username = useWatch({ control, name: "username" });
  const email = useWatch({ control, name: "email" });

  const usernameCheck = useAvailability("username", username ?? "");
  const emailCheck = useAvailability("email", email ?? "");

  return (
    <View style={styles.step}>
      <Text preset="h2" style={styles.title}>
        Criar conta
      </Text>

      <FormInput
        control={control}
        name="username"
        label="Nome de usuário"
        preset="username"
        placeholder="zepequeno"
        status={availabilityStatus(usernameCheck)}
        next={displayNameRef}
      />
      <FormInput
        ref={displayNameRef}
        control={control}
        name="displayName"
        label="Nome"
        placeholder="José Pequeno"
        next={emailRef}
      />
      <FormInput
        ref={emailRef}
        control={control}
        name="email"
        label="E-mail"
        preset="email"
        placeholder="ze.pequeno@email.com"
        status={availabilityStatus(emailCheck)}
        next={passwordRef}
      />
      <FormInput
        ref={passwordRef}
        control={control}
        name="password"
        label="Senha"
        preset="password"
        placeholder="mínimo de 8 caracteres"
        returnKeyType="done"
      />
    </View>
  );
};

function availabilityStatus({
  isChecking,
  isAvailable,
}: {
  isChecking: boolean;
  isAvailable: boolean | null;
}): TInputStatus | undefined {
  if (isChecking) return "checking";
  if (isAvailable === true) return "valid";
  if (isAvailable === false) return "invalid";
  return undefined;
}

const styles = StyleSheet.create({
  step: { gap: theme.space[16] },
  title: { textAlign: "center" },
});
