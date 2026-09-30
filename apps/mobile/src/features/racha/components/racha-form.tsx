import { DEFAULT_MIN_AGE, TRachaRules } from "@meu-racha/domain";
import {
  PropsWithChildren,
  RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Control } from "react-hook-form";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type HostInstance,
} from "react-native";
import { FormInput } from "@/ui/components";
import { theme } from "@/ui/theme";
import { TRachaForm } from "../racha-form-schema";
import { OptionalNumberField } from "./optional-number-field";
import { RulesSection } from "./rules-section";

export type TRachaFormProps = {
  control: Control<TRachaForm>;
  nameRef: RefObject<TextInput | null>;
  minAge: number | null;
  setMinAge: (value: number | null) => void;
  minAgeError?: string;
  rules: TRachaRules;
  summary: string[];
  setRule: <K extends keyof TRachaRules>(key: K, value: TRachaRules[K]) => void;
  matchDurationError?: string;
  isRulesExpanded: boolean;
  toggleRules: () => void;
};

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

export const RachaForm = ({
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
  isDisabled,
  isNameAutoFocused = false,
  isRulesHintVisible = true,
  minAgeRestoreValue = DEFAULT_MIN_AGE,
  children,
}: TRachaFormProps &
  PropsWithChildren<{
    isDisabled: boolean;
    isNameAutoFocused?: boolean;
    isRulesHintVisible?: boolean;
    minAgeRestoreValue?: number;
  }>) => {
  const { scrollRef, align, onScroll } = useScrollFocusedInput();

  return (
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
        autoFocus={isNameAutoFocused}
        maxLength={40}
        isDisabled={isDisabled}
      />

      <OptionalNumberField
        label="Idade mínima"
        value={minAge}
        onChange={setMinAge}
        unit="anos"
        noneLabel="Sem idade mínima"
        restoreValue={minAgeRestoreValue}
        hint="Não barra ninguém: aparece no convite e destaca, no pedido, quem tem menos que isso."
        error={minAgeError}
        isDisabled={isDisabled}
        accessibilityLabel="Idade mínima, em anos"
      />

      <RulesSection
        rules={rules}
        summary={summary}
        onChange={setRule}
        isExpanded={isRulesExpanded}
        onToggle={toggleRules}
        isDisabled={isDisabled}
        matchDurationError={matchDurationError}
        isHintVisible={isRulesHintVisible}
      />

      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: theme.space[24], paddingBottom: theme.space[24] },
});
