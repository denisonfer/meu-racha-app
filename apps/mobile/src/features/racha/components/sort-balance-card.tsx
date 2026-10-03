import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TSortBalanceCardProps = {
  scoreText: string;
  label: string;
  caption: string;
  accessibilityLabel: string;
};

/** Percentual e rótulo do equilíbrio; o rótulo e o rótulo de acessibilidade dizem o que a cor sozinha não diz. */
export const SortBalanceCard = ({
  scoreText,
  label,
  caption,
  accessibilityLabel,
}: TSortBalanceCardProps) => (
  <View style={styles.card} accessible accessibilityLabel={accessibilityLabel}>
    <Text preset="score" color="action" style={styles.score}>
      {scoreText}
    </Text>
    <View style={styles.texts}>
      <Text preset="h3">{label}</Text>
      <Text preset="small" color="muted">
        {caption}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[16],
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  score: { fontSize: 48, lineHeight: 48, fontVariant: ["tabular-nums"] },
  texts: { flex: 1, gap: 2 },
});
