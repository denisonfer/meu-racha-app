import { StyleSheet, View } from "react-native";
import { Icon } from "../icon";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";

export type TNoticeBannerProps = {
  tone: "warning";
  text: string;
};

export const NoticeBanner = ({ text }: TNoticeBannerProps) => {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Icon name="alert" color="warning" />
      <Text preset="small" style={styles.text}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningSurface,
  },
  text: {
    flex: 1,
    fontFamily: "Manrope-Bold",
  },
});
