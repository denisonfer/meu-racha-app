import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  PRO_PRIVACY_SHORT,
  PRO_RESTORE,
  PRO_TERMS_SHORT,
} from "../../utils/plan-messages";

type TPlanLinksProps = {
  onRestore?: () => void;
  // Termos e Privacidade só na oferta: no estado eles já estão em Configurações
  onTerms?: () => void;
  onPrivacy?: () => void;
  isDisabled?: boolean;
};

export const PlanLinks = ({
  onRestore,
  onTerms,
  onPrivacy,
  isDisabled = false,
}: TPlanLinksProps) => {
  const links = [
    { label: PRO_RESTORE, onPress: onRestore, role: "button" as const },
    { label: PRO_TERMS_SHORT, onPress: onTerms, role: "link" as const },
    { label: PRO_PRIVACY_SHORT, onPress: onPrivacy, role: "link" as const },
  ].filter((link) => link.onPress);
  if (links.length === 0) return null;

  return (
    <View style={styles.row}>
      {links.map((link, index) => (
        <View key={link.label} style={styles.item}>
          {index > 0 ? (
            <Text preset="small" color="muted">
              ·
            </Text>
          ) : null}
          <Pressable
            onPress={link.onPress}
            disabled={isDisabled}
            accessibilityRole={link.role}
            accessibilityState={{ disabled: isDisabled }}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Text preset="small" color="muted" style={styles.label}>
              {link.label}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  item: { flexDirection: "row", alignItems: "center" },
  link: {
    minHeight: theme.minTouch,
    justifyContent: "center",
    paddingHorizontal: theme.space[8],
  },
  label: { fontFamily: "Manrope-Bold", textDecorationLine: "underline" },
  pressed: { opacity: 0.8 },
});
