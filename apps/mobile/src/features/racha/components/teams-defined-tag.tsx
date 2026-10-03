import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { SORT_TEAMS_DEFINED } from "../utils/racha-messages";

export const TeamsDefinedTag = () => (
  <View style={styles.badge}>
    <Text preset="caption" color="action" style={styles.label}>
      {SORT_TEAMS_DEFINED.toUpperCase()}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.actionDisabled,
  },
  label: { fontFamily: "Manrope-ExtraBold", letterSpacing: 0.6 },
});
