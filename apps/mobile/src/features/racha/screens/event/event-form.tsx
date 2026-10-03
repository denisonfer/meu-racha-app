import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { Button, Input, ScreenFooter, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { OptionalNumberField } from "../../components/optional-number-field";
import { PRICE_HINT, SPOT_LIMIT_HINT } from "../../utils/racha-messages";
import { AmountField } from "../logistics/amount-field";
import { EventDateField } from "./event-date-field";
import { TEventEditor, useEventForm } from "./use-event-screen";

export const EventForm = ({ editor }: { editor: TEventEditor }) => {
  const {
    values,
    errors,
    isSaving,
    isDatePickerOpen,
    today,
    isDirty,
    canSave,
    failureMessage,
    setStartsOn,
    openDatePicker,
    closeDatePicker,
    setHour,
    setMinute,
    setPlace,
    setIsPaid,
    setPriceText,
    setSpotLimitText,
    setPayerTargetText,
    save,
  } = useEventForm(editor);

  return (
    <>
      {/* abre no topo: rolar até o Pago esconderia a data */}
      <ScrollView
        style={[styles.scroll, isSaving && styles.dim]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        pointerEvents={isSaving ? "none" : "auto"}
      >
        <EventDateField
          value={values.startsOn}
          minimum={today}
          error={errors.startsOn}
          isDisabled={isSaving}
          isOpen={isDatePickerOpen}
          onOpen={openDatePicker}
          onClose={closeDatePicker}
          onChange={setStartsOn}
        />

        <View style={styles.time}>
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

        <Input
          label="Local"
          value={values.place}
          onChangeText={setPlace}
          error={errors.place}
          isDisabled={isSaving}
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
                label="Valor da diária"
                value={values.price}
                onChangeText={setPriceText}
                error={errors.price}
                hint={PRICE_HINT}
                keepHint
                isDisabled={isSaving}
              />
              <Input
                label="Meta de pagantes"
                preset="numeric"
                value={
                  values.payerTarget === null ? "" : String(values.payerTarget)
                }
                onChangeText={setPayerTargetText}
                hint="Quantos pagantes que vieram cobrem o custo do dia."
                error={errors.payerTarget}
                maxLength={4}
                isDisabled={isSaving}
              />
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
  time: { gap: 12 },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.space[8],
  },
  bold: { fontFamily: "Manrope-Bold" },
  grow: { flex: 1 },
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
});
