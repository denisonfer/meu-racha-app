import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TMatchGoalTextProps = {
  scorer: string;
  assist: string | null;
  label: string;
  preset: "body" | "small";
};

// ⚽ = quem fez; 👟 = quem deu a assistência
export const MatchGoalText = ({
  scorer,
  assist,
  label,
  preset,
}: TMatchGoalTextProps) => (
  <View accessible accessibilityLabel={label} style={styles.block}>
    <Text preset={preset}>{`⚽ ${scorer}`}</Text>
    {assist ? (
      <Text preset="caption" color="muted">{`👟 ${assist}`}</Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  block: { flex: 1, gap: theme.space[8] / 2 },
});
