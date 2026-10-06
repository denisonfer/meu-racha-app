import { StyleSheet, View } from "react-native";
import { BolinhaMark, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TProps = {
  left: number;
  top: number;
  width: number;
  height: number;
  title: string;
  countText: string;
  isBlue: boolean;
  // o cartão "Vai" ganha 1 px azul depois da primeira bolinha
  isHighlighted: boolean;
};

export const BolinhasRevealColumn = ({
  left,
  top,
  width,
  height,
  title,
  countText,
  isBlue,
  isHighlighted,
}: TProps) => (
  <View
    accessibilityLabel={`${title}, ${countText}`}
    style={[
      styles.card,
      { left, top, width, height },
      isHighlighted && { borderColor: theme.colors.bolinhaAzul },
    ]}
  >
    <View style={styles.head}>
      <BolinhaMark
        isBlue={isBlue}
        size={14}
        strokeWidth={5}
        color={isBlue ? theme.colors.bolinhaAzul : theme.colors.bolinhaVermelha}
      />
      <Text preset="small" style={styles.title}>
        {title}
      </Text>
    </View>
    <Text style={styles.count}>{countText}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    padding: 12,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: theme.colors.surface,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: "Manrope-Bold" },
  count: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 18,
    lineHeight: 22,
    color: theme.colors.muted,
  },
});
