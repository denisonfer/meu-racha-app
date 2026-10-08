import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { RankingRow, type TRankingRow } from "./ranking-row";

type TRankingListProps = {
  rows: TRankingRow[];
  caption: string;
};

export const RankingList = ({ rows, caption }: TRankingListProps) => (
  <View style={styles.wrap}>
    <Text preset="caption" color="muted" style={styles.caption}>
      {caption}
    </Text>
    <View style={styles.card}>
      {rows.map((row, index) => (
        <View key={row.key}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <RankingRow variant="list" {...row} />
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: { gap: theme.space[8] },
  caption: { fontFamily: "Manrope-Bold" },
  card: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  divider: {
    marginHorizontal: theme.space[16],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
});
