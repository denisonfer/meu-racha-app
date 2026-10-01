import { applyBrlMask } from "@meu-racha/domain";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TAmountFieldProps = {
  label: string;
  value: number | null;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  hint: string;
  keepHint?: boolean;
  isDisabled: boolean;
};

export const AmountField = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  keepHint = false,
  isDisabled,
}: TAmountFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const borderColor = error
    ? theme.colors.danger
    : isFocused
      ? theme.colors.action
      : theme.colors.border;

  return (
    <View style={styles.amount}>
      <Text style={styles.bold}>{label}</Text>
      <View
        style={[
          styles.amountInput,
          { borderColor, opacity: isDisabled ? 0.5 : 1 },
        ]}
      >
        <TextInput
          value={value === null ? "" : applyBrlMask(String(value))}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.muted}
          keyboardType="number-pad"
          maxLength={10}
          editable={!isDisabled}
          accessibilityLabel={label}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={styles.amountText}
        />
      </View>
      {error ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {hint && (keepHint || !error) ? (
        <Text preset="small" color="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  amount: { gap: theme.space[8] },
  bold: { fontFamily: "Manrope-Bold" },
  amountInput: {
    minHeight: theme.minTouch,
    justifyContent: "center",
    paddingHorizontal: theme.space[16],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
    borderWidth: 1,
  },
  amountText: {
    color: theme.colors.foreground,
    ...theme.text.body,
  },
});
