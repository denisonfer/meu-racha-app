import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "@/ui/components";
import { theme } from "@/ui/theme";

export type TResenhaCardProps = {
  title: string;
  summary: string;
  onOpen: () => void;
};

export const ResenhaCard = ({ title, summary, onOpen }: TResenhaCardProps) => (
  <Pressable
    onPress={onOpen}
    accessibilityRole="button"
    accessibilityLabel={title}
    accessibilityHint="Abre a Resenha"
    style={({ pressed }) => [styles.card, pressed && styles.pressed]}
  >
    <View style={styles.copy}>
      <Text preset="small" color="muted" style={styles.bold}>
        {title}
      </Text>
      <Text style={styles.bold}>{summary}</Text>
    </View>
    <Icon name="chevron-right" color="muted" />
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  bold: { fontFamily: "Manrope-Bold" },
  pressed: { opacity: 0.8 },
});
