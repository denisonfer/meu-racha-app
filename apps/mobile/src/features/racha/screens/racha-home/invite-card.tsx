import { StyleSheet, View } from "react-native";
import { Button, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TInviteCardProps = {
  code: string;
  onShare: () => void;
};

export const InviteCard = ({ code, onShare }: TInviteCardProps) => (
  <View style={styles.card}>
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.bold}>Compartilhar convite</Text>
        <Text preset="small" color="muted">
          Mande o link ou o código. Quem entrar vira membro do racha.
        </Text>
      </View>
      <View
        style={styles.codeBox}
        accessible
        accessibilityLabel={`Código do racha: ${code.split("").join(" ")}`}
      >
        <Text preset="caption" color="muted" style={styles.bold}>
          Código
        </Text>
        <Text style={styles.code}>{code}</Text>
      </View>
    </View>
    <Button title="Compartilhar convite" onPress={onShare} />
  </View>
);

const styles = StyleSheet.create({
  card: {
    gap: theme.space[8],
    padding: 12,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.action,
    backgroundColor: theme.colors.surfaceRaised,
  },
  row: { flexDirection: "row", alignItems: "center", gap: theme.space[8] },
  copy: { flex: 1, gap: 2 },
  bold: { fontFamily: "Manrope-Bold" },
  codeBox: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.background,
  },
  code: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
});
