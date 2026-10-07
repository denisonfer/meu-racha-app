import { StyleSheet, View } from "react-native";
import { PenaltyCard, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  RESENHA_CARDS,
  RESENHA_RED,
  RESENHA_YELLOW,
} from "../../utils/racha-messages";

export type TResenhaCardRow = {
  key: string;
  color: "yellow" | "red";
  name: string;
  matchNumber: number;
};

export type TResenhaCardListProps = {
  cards: TResenhaCardRow[];
};

export const ResenhaCardList = ({ cards }: TResenhaCardListProps) => {
  if (cards.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityLabel={RESENHA_CARDS}>
      <Text preset="h3" style={styles.title}>
        {RESENHA_CARDS}
      </Text>
      {cards.map((card) => (
        <View key={card.key} style={styles.row}>
          <PenaltyCard color={card.color} size="md" />
          <Text preset="small" style={styles.word}>
            {card.color === "yellow" ? RESENHA_YELLOW : RESENHA_RED}
          </Text>
          <Text style={styles.name}>{card.name}</Text>
          <Text preset="small" color="muted">
            {`Partida ${card.matchNumber}`}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  title: { marginBottom: 4 },
  row: {
    minHeight: theme.minTouch,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
  },
  word: { width: 72, fontFamily: "Manrope-Bold" },
  name: { flex: 1, fontFamily: "Manrope-Bold" },
});
