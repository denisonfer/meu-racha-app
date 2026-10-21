import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";

export const EnvironmentBadge = () => {
  const { top } = useSafeAreaInsets();

  return (
    // não rouba o toque de botões no topo da tela
    <View pointerEvents="none" style={[styles.container, { top }]}>
      <View style={styles.badge}>
        <Text preset="small" style={styles.text}>
          HOMOLOG
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningSurface,
  },
  text: { fontFamily: "Manrope-Bold" },
});
