import { StyleSheet, TextInput, View } from "react-native";
import { Chip, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TOptionalNumberFieldProps = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit: string;
  noneLabel: string;
  restoreValue: number;
  hint: string;
  error?: string;
  isDisabled?: boolean;
  accessibilityLabel: string;
  isOptional?: boolean;
};

// Campo numérico com opção "nenhum valor" (chip) — nasceu da Duração da
// partida e passou a servir também a Idade mínima do Criar racha.
export const OptionalNumberField = ({
  label,
  value,
  onChange,
  unit,
  noneLabel,
  restoreValue,
  hint,
  error,
  isDisabled = false,
  accessibilityLabel,
  isOptional = false,
}: TOptionalNumberFieldProps) => {
  const isNone = value === null;

  return (
    <View style={styles.stack}>
      <Text style={styles.bold}>
        {label}
        {isOptional ? (
          <Text preset="small" color="muted">
            {" "}
            Opcional
          </Text>
        ) : null}
      </Text>
      <View style={styles.row}>
        <View style={[styles.field, error ? styles.fieldError : null]}>
          <TextInput
            value={value === null ? "" : String(value)}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, "");
              onChange(digits ? Number(digits) : null);
            }}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="–"
            placeholderTextColor={theme.colors.muted}
            editable={!isDisabled}
            accessibilityLabel={accessibilityLabel}
            style={styles.input}
          />
          <Text color="muted" style={styles.bold}>
            {unit}
          </Text>
        </View>
        <Chip
          label={noneLabel}
          isSelected={isNone}
          isDisabled={isDisabled}
          onPress={() => onChange(isNone ? restoreValue : null)}
        />
      </View>
      {error ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {error}
        </Text>
      ) : (
        <Text preset="small" color="muted">
          {hint}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { gap: 12 },
  bold: { fontFamily: "Manrope-Bold" },
  row: { flexDirection: "row", alignItems: "center", gap: theme.space[8] },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 132,
    height: 56,
    paddingHorizontal: 15,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.muted,
    backgroundColor: theme.colors.background,
  },
  fieldError: { borderColor: theme.colors.danger },
  input: {
    flex: 1,
    color: theme.colors.foreground,
    ...theme.text.stat,
    fontVariant: ["tabular-nums"],
  },
});
