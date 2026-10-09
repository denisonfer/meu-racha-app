import { StyleSheet, View } from "react-native";
import { theme } from "@/ui/theme";
import { Text } from "../text/text";

type TTabBadgeProps = { count: number };

export const TabBadge = ({ count }: TTabBadgeProps) => {
  if (count < 1) return null;

  return (
    <View
      style={styles.badge}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text color="onAction" style={styles.count}>
        {count > 9 ? "9+" : String(count)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -7,
    left: 13,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.action,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  count: {
    fontFamily: "BarlowCondensed-Bold",
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
});
