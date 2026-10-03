import { StyleSheet, Switch, View } from "react-native";
import { BottomSheet, Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  ATTENDANCE_MONTHLY_HINT,
  ATTENDANCE_MONTHLY_SAVE,
  MONTHLY_PRICE_HINT,
} from "../../utils/racha-messages";
import { useMonthlyPassScreen } from "./use-monthly-pass-screen";

export const MonthlyPassScreen = () => {
  const {
    isMissing,
    switchLabel,
    yearMonthLabel,
    enabled,
    setEnabled,
    isDirty,
    isSaving,
    failureMessage,
    save,
  } = useMonthlyPassScreen();

  if (isMissing) return null;

  return (
    <BottomSheet
      title="Mensalista"
      supporting={
        <Text preset="small" color="muted">
          {ATTENDANCE_MONTHLY_HINT}
        </Text>
      }
      isBusy={isSaving}
    >
      <View style={styles.field}>
        <Text style={styles.label}>Mês</Text>
        <View style={styles.monthBox}>
          <Text style={styles.bold}>{yearMonthLabel}</Text>
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={[styles.bold, styles.grow]}>{switchLabel}</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          disabled={isSaving}
          accessibilityLabel={switchLabel}
          trackColor={{
            false: theme.colors.mutedDisabled,
            true: theme.colors.action,
          }}
          thumbColor={enabled ? theme.colors.onAction : theme.colors.muted}
          ios_backgroundColor={theme.colors.mutedDisabled}
        />
      </View>

      <Text preset="small" color="muted" style={styles.note}>
        {MONTHLY_PRICE_HINT}
      </Text>

      <View style={styles.footer}>
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title={ATTENDANCE_MONTHLY_SAVE}
          onPress={save}
          isDisabled={!isDirty}
          isLoading={isSaving}
          accessibilityLabel={isSaving ? "Salvando" : ATTENDANCE_MONTHLY_SAVE}
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  field: { gap: 7 },
  label: { fontFamily: "Manrope-Bold", fontSize: 14 },
  bold: { fontFamily: "Manrope-Bold" },
  grow: { flex: 1 },
  monthBox: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[16],
    minHeight: 52,
    paddingVertical: theme.space[8],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
  },
  note: { marginTop: 4, lineHeight: 17 },
  footer: { gap: 10, paddingTop: theme.space[8] },
});
