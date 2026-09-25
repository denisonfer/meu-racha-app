import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "@/ui/theme";

export const ScreenFooter = ({ children }: PropsWithChildren) => {
  return <View style={styles.footer}>{children}</View>;
};

const styles = StyleSheet.create({
  footer: {
    marginTop: "auto",
    gap: theme.space[8],
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
    paddingTop: theme.space[16],
  },
});
