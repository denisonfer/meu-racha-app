import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";

export type TPaymentBreakdownProps = {
  rows: { label: string; value: string; isTotal?: boolean }[];
};

export const PaymentBreakdown = ({ rows }: TPaymentBreakdownProps) => (
  <View style={styles.card}>
    {rows.map((row, index) => (
      <View
        key={row.label}
        style={[styles.row, index > 0 && styles.divider]}
        accessible
        accessibilityLabel={`${row.label}: ${row.value}`}
      >
        <Text
          preset="small"
          color={row.isTotal ? "foreground" : "muted"}
          style={row.isTotal ? styles.bold : undefined}
        >
          {row.label}
        </Text>
        <Text preset="stat" style={styles.value}>
          {row.value}
        </Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.space[16],
  },
  row: {
    minHeight: theme.minTouch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  bold: { fontFamily: "Manrope-Bold" },
  value: { fontVariant: ["tabular-nums"] },
});
