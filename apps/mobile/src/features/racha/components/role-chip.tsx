import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { TMemberRole } from "../racha-types";
import { ROLE_LABEL } from "../utils/racha-labels";

export const RoleChip = ({ role }: { role: TMemberRole }) => (
  <View style={[styles.chip, role !== "OWNER" && styles.chipMuted]}>
    <Text preset="caption" style={styles.label}>
      {ROLE_LABEL[role]}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  chip: {
    justifyContent: "center",
    height: 24,
    paddingHorizontal: theme.space[8],
    borderRadius: theme.radius.check,
    borderWidth: 1,
    borderColor: theme.colors.action,
  },
  chipMuted: { borderColor: theme.colors.muted },
  label: {
    fontFamily: "Manrope-ExtraBold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
