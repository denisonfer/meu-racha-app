import { StyleSheet, View } from "react-native";
import { Bolinha, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  BOLINHAS_INTO_BAG,
  bolinhasAfter,
  bolinhasAllMoveText,
  bolinhasAllMoveTitle,
  bolinhasLegend,
  bolinhasMovedRow,
  bolinhasSummary,
} from "../../utils/racha-messages";

export type TBolinhasSummaryProps = {
  giverNumber: number;
  receiverNumber: number;
  count: number;
  receiverCount: number;
  blue: number;
  red: number;
  allMove: boolean;
  names: string[];
  capacity: number;
};

/** M2 (com sorteio) e M3 (todos vão): o que acontece antes de o Condutor confirmar. */
export const BolinhasSummary = ({
  giverNumber,
  receiverNumber,
  count,
  receiverCount,
  blue,
  red,
  allMove,
  names,
  capacity,
}: TBolinhasSummaryProps) => (
  <View accessibilityLiveRegion="polite" style={styles.card}>
    <Text style={styles.title}>
      {allMove
        ? bolinhasAllMoveTitle(count, giverNumber, receiverNumber)
        : bolinhasSummary(giverNumber, receiverNumber, blue, red)}
    </Text>
    {allMove ? (
      <View style={styles.moved}>
        {names.map((name) => (
          <Text key={name} preset="small" style={styles.movedName}>
            {bolinhasMovedRow(name, receiverNumber)}
          </Text>
        ))}
      </View>
    ) : (
      <View style={styles.balls}>
        {Array.from({ length: blue }, (_, i) => (
          <Bolinha key={`b${i}`} state="blue" size={32} />
        ))}
        {Array.from({ length: red }, (_, i) => (
          <Bolinha key={`r${i}`} state="red" size={32} />
        ))}
        <View style={styles.legend}>
          <Text preset="caption" style={styles.legendTitle}>
            {`${bolinhasLegend(blue, true)} · ${bolinhasLegend(red, false)}`}
          </Text>
          <Text preset="caption" color="muted">
            {BOLINHAS_INTO_BAG}
          </Text>
        </View>
      </View>
    )}
    <Text preset="small" color="muted">
      {allMove
        ? bolinhasAllMoveText(
            giverNumber,
            receiverNumber,
            receiverCount + count,
            capacity
          )
        : bolinhasAfter(receiverNumber, giverNumber, count - blue, capacity)}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  title: { fontFamily: "Manrope-Bold", lineHeight: 22 },
  balls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  legend: { marginLeft: 4 },
  legendTitle: { fontFamily: "Manrope-ExtraBold", letterSpacing: 0.6 },
  moved: { gap: 4 },
  movedName: { fontFamily: "Manrope-Bold" },
});
