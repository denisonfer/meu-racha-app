import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TNotificationSectionHeaderProps = {
  title: string;
  isNew: boolean;
};

export const NotificationSectionHeader = ({
  title,
  isNew,
}: TNotificationSectionHeaderProps) => (
  <View style={styles.header}>
    {isNew ? <View style={styles.dot} /> : null}
    <Text color={isNew ? "foreground" : "muted"} style={styles.title}>
      {title}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[8],
    marginBottom: theme.space[8],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.action,
  },
  title: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.26,
  },
});
