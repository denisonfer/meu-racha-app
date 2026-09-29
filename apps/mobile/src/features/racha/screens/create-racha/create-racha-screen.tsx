import { ScrollView, StyleSheet } from "react-native";
import {
  Button,
  FormInput,
  NoticeBanner,
  Screen,
  ScreenFooter,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { RulesSection } from "./rules-section";
import { useCreateRachaScreen } from "./use-create-racha-screen";

export const CreateRachaScreen = () => {
  const {
    control,
    nameRef,
    rules,
    summary,
    setRule,
    matchDurationError,
    isRulesExpanded,
    toggleRules,
    isCreating,
    isBlocked,
    blockedMessage,
    failureMessage,
    submit,
  } = useCreateRachaScreen();

  return (
    <Screen title="Criar racha" canGoBack>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FormInput
          ref={nameRef}
          control={control}
          name="name"
          label="Nome do racha"
          placeholder="Ex.: Racha da Quadra do Zé"
          hint="Aparece no convite que você manda para a galera."
          autoFocus
          maxLength={40}
          isDisabled={isCreating}
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        <RulesSection
          rules={rules}
          summary={summary}
          onChange={setRule}
          isExpanded={isRulesExpanded}
          onToggle={toggleRules}
          isDisabled={isCreating}
          matchDurationError={matchDurationError}
        />
      </ScrollView>

      <ScreenFooter>
        {isBlocked ? (
          <NoticeBanner tone="warning" text={blockedMessage} />
        ) : null}
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title="Criar racha"
          accessibilityLabel={isCreating ? "Criando racha" : "Criar racha"}
          isLoading={isCreating}
          isDisabled={isBlocked}
          onPress={submit}
        />
      </ScreenFooter>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: theme.space[24], paddingBottom: theme.space[24] },
});
