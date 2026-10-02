import { dateMaskToISO, isRealDate } from "@meu-racha/domain";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Button, FieldWrapper, Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TEventDateFieldProps = {
  value: string;
  minimum: string;
  error?: string;
  isDisabled: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
};

// O formulário guarda um dia civil, sem fuso; o picker precisa de um instante.
function localNoon(iso: string): Date {
  const [year = 2000, month = 1, day = 1] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function pickerValue(iso: string): Date {
  if (Platform.OS !== "android") return localNoon(iso);
  // O DatePickerState do Material 3 usa o dia em UTC, não o fuso do aparelho.
  const [year = 2000, month = 1, day = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function maskFromSelectedDate(date: Date): string {
  // O Material 3 devolve meia-noite UTC; o SwiftUI devolve a data no fuso local.
  const day = Platform.OS === "android" ? date.getUTCDate() : date.getDate();
  const month =
    Platform.OS === "android" ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const year =
    Platform.OS === "android" ? date.getUTCFullYear() : date.getFullYear();
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export const EventDateField = ({
  value,
  minimum,
  error,
  isDisabled,
  isOpen,
  onOpen,
  onClose,
  onChange,
}: TEventDateFieldProps) => {
  const iso = dateMaskToISO(value);
  const pickerDate = pickerValue(iso && isRealDate(iso) ? iso : minimum);

  return (
    <FieldWrapper label="Data" error={error}>
      <Pressable
        onPress={onOpen}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `Data: ${value}` : "Escolher data do evento"
        }
        accessibilityHint="Abre o calendário"
        style={[
          styles.field,
          { borderColor: error ? theme.colors.danger : theme.colors.border },
          isDisabled && styles.disabled,
        ]}
      >
        <Text color={value ? "foreground" : "muted"} style={styles.value}>
          {value || "Selecione uma data"}
        </Text>
        <Icon name="calendar" color="muted" />
      </Pressable>

      {isOpen ? (
        <View style={Platform.OS === "ios" ? styles.inlinePicker : undefined}>
          <DateTimePicker
            mode="date"
            style={Platform.OS === "ios" ? styles.picker : undefined}
            presentation={Platform.OS === "android" ? "dialog" : "inline"}
            display={Platform.OS === "ios" ? "inline" : "default"}
            value={pickerDate}
            minimumDate={localNoon(minimum)}
            accentColor={
              Platform.OS === "ios" ? theme.colors.action : undefined
            }
            locale="pt_BR"
            themeVariant="dark"
            positiveButton={{ label: "Confirmar" }}
            negativeButton={{ label: "Cancelar" }}
            onValueChange={(_event, date) => {
              onChange(maskFromSelectedDate(date));
              onClose();
            }}
            onDismiss={onClose}
          />
          {Platform.OS === "ios" && !value ? (
            <Button
              title="Usar hoje"
              preset="text"
              onPress={() => {
                onChange(maskFromSelectedDate(localNoon(minimum)));
                onClose();
              }}
            />
          ) : null}
        </View>
      ) : null}
    </FieldWrapper>
  );
};

const styles = StyleSheet.create({
  field: {
    minHeight: theme.minTouch,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[8],
    paddingHorizontal: theme.space[16],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
    borderWidth: 1,
  },
  value: { flex: 1 },
  disabled: { opacity: 0.5 },
  inlinePicker: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
    overflow: "hidden",
  },
  picker: { width: "100%" },
});
