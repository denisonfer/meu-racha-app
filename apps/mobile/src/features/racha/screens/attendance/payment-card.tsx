import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  PAY,
  PAY_COVERED_CREDIT,
  PAYMENT_CARD_DAILY,
  PAYMENT_CARD_LABEL,
  PAYMENT_CARD_WITH_CREDIT,
} from "../../utils/racha-messages";

export type TPaymentCardProps = {
  amountDue: number;
  hasCredit: boolean;
  onPress: () => void;
};

export const PaymentCard = ({
  amountDue,
  hasCredit,
  onPress,
}: TPaymentCardProps) => {
  const isCovered = amountDue <= 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isCovered
          ? `${PAYMENT_CARD_LABEL}: ${PAY_COVERED_CREDIT}`
          : `${PAYMENT_CARD_LABEL}: R$ ${amountDue}. ${PAY}`
      }
      style={styles.card}
    >
      <View style={styles.info}>
        <Text preset="small" color="muted" style={styles.bold}>
          {PAYMENT_CARD_LABEL}
        </Text>
        {isCovered ? (
          <Text style={styles.bold}>{PAY_COVERED_CREDIT}</Text>
        ) : (
          <View style={styles.value}>
            <Text preset="stat" style={styles.amount}>
              R$ {amountDue}
            </Text>
            <Text preset="small" color="muted" style={styles.bold}>
              {hasCredit ? PAYMENT_CARD_WITH_CREDIT : PAYMENT_CARD_DAILY}
            </Text>
          </View>
        )}
      </View>
      {isCovered ? (
        <Icon name="chevron-right" />
      ) : (
        <View style={styles.pill}>
          <Text preset="button" color="onAction">
            {PAY}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 14,
    paddingRight: 12,
    paddingBottom: 14,
    paddingLeft: 16,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  info: { gap: 2, flexShrink: 1 },
  value: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  amount: { fontVariant: ["tabular-nums"] },
  bold: { fontFamily: "Manrope-Bold" },
  pill: {
    minHeight: theme.minTouch,
    justifyContent: "center",
    paddingHorizontal: theme.space[24],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.action,
  },
});
