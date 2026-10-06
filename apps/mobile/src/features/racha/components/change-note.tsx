import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TChangeNoteProps = {
  icon: ReactNode;
  title: string;
  caption: string;
};

/** O que mudou nos Times, sem tom de aviso: nada deu errado. */
export const ChangeNote = ({ icon, title, caption }: TChangeNoteProps) => (
  <View
    accessible
    accessibilityRole="summary"
    accessibilityLiveRegion="polite"
    accessibilityLabel={`${title}. ${caption}`}
    style={styles.note}
  >
    {icon}
    <View style={styles.texts}>
      <Text preset="small" style={styles.title}>
        {title}
      </Text>
      <Text preset="caption" color="muted">
        {caption}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    backgroundColor: theme.colors.surface,
  },
  texts: { flex: 1, gap: 2 },
  title: { fontFamily: "Manrope-Bold" },
});
