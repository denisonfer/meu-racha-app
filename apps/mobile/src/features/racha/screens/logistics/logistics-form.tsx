import { DEFAULT_MIN_AGE } from "@meu-racha/domain";
import { ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { Button, Chip, Input, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { OptionalNumberField } from "../../components/optional-number-field";
import { TRacha } from "../../racha-types";
import {
  MONTHLY_PRICE_HINT,
  PIX_LOCKED,
  PRICE_HINT,
  SLOT_HINT,
  SPOT_LIMIT_HINT,
} from "../../utils/racha-messages";
import { AmountField } from "./amount-field";
import { useLogisticsForm } from "./use-logistics-screen";

const WEEKDAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
] as const;

export const LogisticsForm = ({ racha }: { racha: TRacha }) => {
  const {
    values,
    errors,
    isSaving,
    isDirty,
    canSave,
    failureMessage,
    setPlace,
    selectWeekday,
    setHour,
    setMinute,
    setMinAge,
    setIsPaid,
    setPriceText,
    setMonthlyPriceText,
    setSpotLimitText,
    save,
  } = useLogisticsForm(racha);

  return (
    <>
      {/* abre no topo: rolar até o Pago esconderia o local */}
      <ScrollView
        style={[styles.scroll, isSaving && styles.dim]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        pointerEvents={isSaving ? "none" : "auto"}
      >
        <Input
          label="Local"
          value={values.place}
          onChangeText={setPlace}
          error={errors.place}
          isDisabled={isSaving}
        />

        <View style={styles.section}>
          <Text style={styles.bold}>Dia e horário fixos</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {WEEKDAYS.map((day) => (
              <Chip
                key={day.value}
                label={day.label}
                isSelected={values.weekday === day.value}
                isDisabled={isSaving}
                onPress={() => selectWeekday(day.value)}
              />
            ))}
          </View>
          <Text preset="small" color="muted">
            {SLOT_HINT}
          </Text>
          <View style={styles.timeRow}>
            <OptionalNumberField
              value={values.kickoffHour}
              onChange={setHour}
              unit="h"
              hint=""
              error={errors.hour}
              isInvalid={Boolean(errors.slot)}
              isDisabled={isSaving}
              accessibilityLabel="Hora"
            />
            <OptionalNumberField
              value={values.kickoffMinute}
              onChange={setMinute}
              unit="min"
              hint=""
              error={errors.minute}
              isInvalid={Boolean(errors.slot)}
              isDisabled={isSaving}
              accessibilityLabel="Minuto"
            />
          </View>
          {errors.slot ? (
            <Text preset="small" color="errorText" accessibilityRole="alert">
              {errors.slot}
            </Text>
          ) : null}
        </View>

        <OptionalNumberField
          label="Idade mínima"
          value={values.minAge}
          onChange={setMinAge}
          unit="anos"
          noneLabel="Sem idade mínima"
          restoreValue={DEFAULT_MIN_AGE}
          hint="Não barra ninguém: aparece no convite e destaca, no pedido, quem tem menos que isso."
          error={errors.minAge}
          isDisabled={isSaving}
          accessibilityLabel="Idade mínima, em anos"
        />

        <View style={styles.card}>
          <View style={styles.paidHeader}>
            <Text style={[styles.bold, styles.grow]}>Pago</Text>
            <Switch
              value={values.isPaid}
              onValueChange={setIsPaid}
              disabled={isSaving}
              accessibilityLabel="Pago"
              trackColor={{
                false: theme.colors.mutedDisabled,
                true: theme.colors.action,
              }}
              thumbColor={
                values.isPaid ? theme.colors.onAction : theme.colors.muted
              }
              ios_backgroundColor={theme.colors.mutedDisabled}
            />
          </View>
          {values.isPaid ? (
            <View style={styles.paidBody}>
              <AmountField
                label="Valor"
                value={values.price}
                onChangeText={setPriceText}
                error={errors.price}
                hint={PRICE_HINT}
                keepHint
                isDisabled={isSaving}
              />
              <AmountField
                label="Valor mensal"
                value={values.monthlyPrice}
                onChangeText={setMonthlyPriceText}
                placeholder="Opcional"
                error={errors.monthlyPrice}
                hint={MONTHLY_PRICE_HINT}
                isDisabled={isSaving}
              />
              <View style={styles.amount}>
                <Text style={styles.bold}>Chave PIX</Text>
                <TextInput
                  value=""
                  editable={false}
                  accessibilityLabel="Chave PIX"
                  style={styles.pixInput}
                />
                <Text preset="small" color="muted">
                  {PIX_LOCKED}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <Input
          label="Limite de vagas"
          preset="numeric"
          value={values.spotLimit === null ? "" : String(values.spotLimit)}
          onChangeText={setSpotLimitText}
          placeholder="Sem limite"
          hint={SPOT_LIMIT_HINT}
          error={errors.spotLimit}
          maxLength={5}
          isDisabled={isSaving}
        />
      </ScrollView>

      <ScreenFooter>
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title="Salvar"
          accessibilityLabel={isSaving ? "Salvando" : "Salvar"}
          accessibilityHint={
            isDirty ? undefined : "Altere algum campo para salvar"
          }
          isLoading={isSaving}
          isDisabled={!canSave}
          onPress={save}
        />
      </ScreenFooter>
    </>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  dim: { opacity: 0.45 },
  content: { gap: theme.space[24], paddingBottom: theme.space[24] },
  section: { gap: 12 },
  bold: { fontFamily: "Manrope-Bold" },
  grow: { flex: 1 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[8],
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.space[8],
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
  },
  paidHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[16],
    padding: theme.space[16],
  },
  paidBody: {
    gap: theme.space[16],
    marginHorizontal: theme.space[16],
    paddingTop: theme.space[16],
    paddingBottom: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  amount: { gap: theme.space[8] },
  pixInput: {
    minHeight: theme.minTouch,
    paddingHorizontal: theme.space[16],
    backgroundColor: theme.colors.surfaceDisabled,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.mutedDisabled,
    color: theme.colors.textDisabled,
    ...theme.text.body,
  },
});
