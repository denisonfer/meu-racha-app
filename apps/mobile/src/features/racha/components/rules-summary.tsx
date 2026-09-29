import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/components";

export const RulesSummary = ({ parts }: { parts: string[] }) => (
  <View style={styles.row} importantForAccessibility="no-hide-descendants">
    {parts.map((part, index) => (
      <Text key={part} style={styles.part}>
        {index > 0 ? <Text color="muted">· </Text> : null}
        {part}
      </Text>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: 6, rowGap: 2 },
  part: { fontFamily: "Manrope-Bold" },
});
