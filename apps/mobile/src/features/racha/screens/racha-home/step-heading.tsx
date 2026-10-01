import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";
import { theme } from "@/ui/theme";

type TStepHeadingProps = {
  number: number;
  title: string;
  text: string;
  isHighlighted?: boolean;
};

export const StepHeading = ({
  number,
  title,
  text,
  isHighlighted = false,
}: TStepHeadingProps) => (
  <View style={styles.stepHeading}>
    <Text
      preset="stat"
      color={isHighlighted ? "action" : "muted"}
      style={styles.stepNumber}
    >
      {number}
    </Text>
    <View style={styles.stepTexts}>
      <Text preset="h3">{title}</Text>
      <Text preset="small" color={isHighlighted ? "foreground" : "muted"}>
        {text}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  stepHeading: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stepNumber: { width: 24, fontSize: 32, lineHeight: 32 },
  stepTexts: { flex: 1, gap: theme.space[4] },
});
