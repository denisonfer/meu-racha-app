import { INVITE_CODE_LENGTH, normalizeInviteCode } from "@meu-racha/domain";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

const HINT = "O código tem 6 caracteres e vem no convite que te mandaram.";

type TInviteCodeFieldProps = {
  value: string;
  onChange: (code: string) => void;
  error?: string | null;
  isDisabled?: boolean;
  onSubmit?: () => void;
};

// Um campo só, não 6 caixas: colar o código inteiro tem que funcionar.
export const InviteCodeField = ({
  value,
  onChange,
  error,
  isDisabled = false,
  onSubmit,
}: TInviteCodeFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error) && !isDisabled;

  return (
    <View style={styles.stack}>
      <Text
        color={isDisabled ? "textDisabled" : "foreground"}
        style={styles.bold}
      >
        Código do convite
      </Text>
      <View
        style={[
          styles.field,
          isDisabled
            ? styles.fieldDisabled
            : hasError
              ? styles.fieldError
              : isFocused
                ? styles.fieldFocused
                : null,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={(text) => onChange(normalizeInviteCode(text))}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onSubmitEditing={onSubmit}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          // sem maxLength: no iOS ele corta o texto colado antes da
          // normalização ("k7q-2mz" perderia o Z); normalizeInviteCode já
          // limita em 6
          returnKeyType="go"
          editable={!isDisabled}
          cursorColor={theme.colors.action}
          selectionColor={theme.colors.action}
          accessibilityLabel="Código do convite"
          accessibilityHint={HINT}
          // lido letra por letra ("K 7 Q 2 M Z"), não como palavra
          accessibilityValue={{ text: value.split("").join(" ") }}
          style={[styles.input, isDisabled && styles.inputDisabled]}
        />
        {hasError ? (
          <Icon name="alert" size={22} color="danger" />
        ) : (
          <Text
            color="muted"
            style={styles.counter}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {value.length}/{INVITE_CODE_LENGTH}
          </Text>
        )}
      </View>
      {hasError ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {error}
        </Text>
      ) : (
        <Text preset="small" color={isDisabled ? "mutedDisabled" : "muted"}>
          {HINT}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { gap: theme.space[8] },
  bold: { fontFamily: "Manrope-Bold" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 72,
    paddingHorizontal: 19,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.muted,
    backgroundColor: theme.colors.surface,
  },
  // borda de 2: o padding perde 1 pro texto não pular
  fieldFocused: {
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: theme.colors.action,
  },
  fieldError: {
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: theme.colors.danger,
  },
  fieldDisabled: {
    borderColor: theme.colors.mutedDisabled,
    backgroundColor: theme.colors.surfaceDisabled,
  },
  input: {
    flex: 1,
    height: 64,
    color: theme.colors.foreground,
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 36,
    letterSpacing: 8,
    fontVariant: ["tabular-nums"],
  },
  inputDisabled: { color: theme.colors.textDisabled },
  counter: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 20,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
});
