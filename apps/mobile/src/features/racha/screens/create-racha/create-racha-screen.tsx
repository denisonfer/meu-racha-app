import { DEFAULT_MIN_AGE } from "@meu-racha/domain";
import { useCallback, useEffect, useRef } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type HostInstance,
} from "react-native";
import {
  Button,
  FormInput,
  NoticeBanner,
  Screen,
  ScreenFooter,
  Text,
} from "@/ui/components";
import { theme } from "@/ui/theme";
import { OptionalNumberField } from "../../components/optional-number-field";
import { RulesSection } from "./rules-section";
import { useCreateRachaScreen } from "./use-create-racha-screen";

const FOCUSED_INPUT_GAP = 48;

const useScrollFocusedInput = () => {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardOpen = useRef(false);

  const align = useCallback(() => {
    if (!keyboardOpen.current) return;

    const input = TextInput.State.currentlyFocusedInput();
    const scroll = scrollRef.current as (ScrollView & HostInstance) | null;
    if (!input || !scroll) return;

    scroll.measureInWindow((_x, top, _width, height) => {
      input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
        const overflow =
          inputTop + inputHeight + FOCUSED_INPUT_GAP - (top + height);
        if (overflow > 0) {
          scroll.scrollTo({ y: scrollY.current + overflow, animated: true });
        }
      });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const show = Keyboard.addListener("keyboardDidShow", () => {
      keyboardOpen.current = true;
      requestAnimationFrame(align);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpen.current = false;
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, [align]);

  return {
    scrollRef,
    align,
    onScroll: (offsetY: number) => {
      scrollY.current = offsetY;
    },
  };
};

export const CreateRachaScreen = () => {
  const {
    control,
    nameRef,
    minAge,
    setMinAge,
    minAgeError,
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
  const { scrollRef, align, onScroll } = useScrollFocusedInput();

  return (
    <Screen title="Criar racha" canGoBack>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          onScroll(event.nativeEvent.contentOffset.y);
        }}
        onLayout={align}
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
        />

        <OptionalNumberField
          label="Idade mínima"
          value={minAge}
          onChange={setMinAge}
          unit="anos"
          noneLabel="Sem idade mínima"
          restoreValue={DEFAULT_MIN_AGE}
          hint="Não barra ninguém: aparece no convite e destaca, no pedido, quem tem menos que isso."
          error={minAgeError}
          isDisabled={isCreating}
          accessibilityLabel="Idade mínima, em anos"
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
