import { StyleSheet, View } from "react-native";
import { theme } from "@/ui/theme";

export type TStepIndicatorProps = {
  total: number;
  /** Passo atual, começando em 1. */
  current: number;
};

export const StepIndicator = ({ total, current }: TStepIndicatorProps) => {
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`Passo ${current} de ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dash,
            {
              backgroundColor:
                index < current ? theme.colors.action : theme.colors.divider,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.space[4],
  },
  dash: {
    width: 24,
    height: 4,
    borderRadius: theme.radius.pill,
  },
});
