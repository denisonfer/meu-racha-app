import type { TPositionDetail } from "@meu-racha/domain";
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import type { TPositionDetailSlot } from "../utils/position-detail-view";
import type { TPositionSlot } from "../utils/racha-labels";
import { PositionDetailField } from "./position-detail-field";

type TPositionDetailSlotsProps = {
  slots: TPositionDetailSlot[];
  values: Record<TPositionSlot, TPositionDetail | null>;
  errors: Partial<Record<TPositionSlot, string>>;
  onChange: (slot: TPositionSlot, value: TPositionDetail) => void;
  isDisabled: boolean;
};

/** As zonas do Membro, cada uma com o seletor ou o texto de quem não escolhe. */
export const PositionDetailSlots = ({
  slots,
  values,
  errors,
  onChange,
  isDisabled,
}: TPositionDetailSlotsProps) => (
  <View style={styles.list}>
    {slots.map((slot) =>
      slot.options.length > 0 ? (
        <PositionDetailField
          key={slot.slot}
          label={slot.label}
          accessibilityLabel={slot.accessibilityLabel}
          options={slot.options}
          value={values[slot.slot]}
          onChange={(value) => onChange(slot.slot, value)}
          error={errors[slot.slot]}
          isDisabled={isDisabled}
        />
      ) : (
        <View
          key={slot.slot}
          style={styles.fixed}
          accessible
          accessibilityLabel={`${slot.accessibilityLabel}. ${slot.noChoiceText ?? ""}`}
        >
          <Text preset="small">{slot.label}</Text>
          <Text preset="small" color="muted">
            {slot.noChoiceText}
          </Text>
        </View>
      )
    )}
  </View>
);

const styles = StyleSheet.create({
  list: { gap: theme.space[16] },
  fixed: { gap: theme.space[4] },
});
