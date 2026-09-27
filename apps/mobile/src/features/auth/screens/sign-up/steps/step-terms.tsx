import { Control } from "react-hook-form";
import * as WebBrowser from "expo-web-browser";
import { StyleSheet, View } from "react-native";
import { FormCheckbox, FormInput, Text, TextLink } from "@/ui/components";
import { theme } from "@/ui/theme";
import { TSignUpFormInput } from "../sign-up-schema";

/**
 * Sai do código porque o endereço muda de mão: primeiro o subdomínio grátis do
 * Pages, depois o domínio próprio. O padrão é o domínio final para nenhuma
 * build sem env ficar com link morto.
 */
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://meuracha.app";

/**
 * Abre por cima do cadastro, não no navegador do sistema: sair do app no meio
 * do formulário é o caminho mais curto para a pessoa não voltar.
 */
const openPage = (path: string) =>
  void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`, {
    toolbarColor: theme.colors.background,
    controlsColor: theme.colors.action,
  });

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
            <TextLink preset="small" onPress={() => openPage("/termos")}>
              Termos de Uso
            </TextLink>{" "}
            e a{" "}
            <TextLink preset="small" onPress={() => openPage("/privacidade")}>
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
