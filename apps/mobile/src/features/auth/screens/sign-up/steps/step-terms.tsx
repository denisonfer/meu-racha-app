import { Control } from "react-hook-form";
import { Linking, StyleSheet, View } from "react-native";
import { FormCheckbox, FormInput, Text, TextLink } from "@/ui/components";
import { theme } from "@/ui/theme";
import { TSignUpFormInput } from "../sign-up-schema";

export const StepTerms = ({
  control,
}: {
  control: Control<TSignUpFormInput>;
}) => {
  return (
    <View style={styles.step}>
      <Text preset="h2" style={styles.title}>
        Só mais um passo
      </Text>

      <FormInput
        control={control}
        name="birthDate"
        label="Data de nascimento"
        preset="date"
        placeholder="DD/MM/AAAA"
        hint="Fica privada. Serve só para confirmar seus 16 anos."
      />

      <FormCheckbox
        control={control}
        name="acceptedTerms"
        accessibilityLabel="Li e aceito os Termos de Uso e a Política de Privacidade"
        label={
          <Text preset="small" style={styles.terms}>
            Li e aceito os{" "}
            <TextLink
              preset="small"
              onPress={() => Linking.openURL("https://meuracha.app/termos")}
            >
              Termos de Uso
            </TextLink>{" "}
            e a{" "}
            <TextLink
              preset="small"
              onPress={() =>
                Linking.openURL("https://meuracha.app/privacidade")
              }
            >
              Política de Privacidade
            </TextLink>
            .
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  step: { gap: theme.space[16] },
  title: { textAlign: "center" },
  terms: { flex: 1 },
});
