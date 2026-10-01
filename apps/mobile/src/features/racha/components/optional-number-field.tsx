import { StyleSheet, TextInput, View } from "react-native";
import { Chip, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TOptionalNumberFieldProps = {
  // hora e minuto não têm rótulo: o título da seção já diz o que é
  label?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit: string;
  // sem o chip, 0 continua sendo um número — horário meia-noite não é "nenhum"
  noneLabel?: string;
  restoreValue?: number;
  hint: string;
  error?: string;
  // a mensagem do dia/horário fica fora do campo; a borda ainda marca os dois
  isInvalid?: boolean;
  isDisabled?: boolean;
  accessibilityLabel: string;
  isOptional?: boolean;
};

export const OptionalNumberField = ({
  label,
  value,
  onChange,
  unit,
  noneLabel,
  restoreValue,
  hint,
  error,
  isInvalid = false,
  isDisabled = false,
  accessibilityLabel,
  isOptional = false,
}: TOptionalNumberFieldProps) => {
  const isNone = value === null;

  return (
    <View style={styles.stack}>
      {label ? (
        <Text style={styles.bold}>
          {label}
          {isOptional ? (
            <Text preset="small" color="muted">
              {" "}
              Opcional
            </Text>
          ) : null}
        </Text>
      ) : null}
      <View style={styles.row}>
        <View
          style={[styles.field, error || isInvalid ? styles.fieldError : null]}
        >
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
        {noneLabel ? (
          <Chip
            label={noneLabel}
            isSelected={isNone}
            isDisabled={isDisabled}
            onPress={() => onChange(isNone ? (restoreValue ?? null) : null)}
          />
        ) : null}
      </View>
      {error ? (
        <Text preset="small" color="errorText" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text preset="small" color="muted">
          {hint}
        </Text>
      ) : null}
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
