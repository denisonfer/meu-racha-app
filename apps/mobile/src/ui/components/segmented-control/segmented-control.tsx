import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";

export type TSegmentedControlOption<V extends string> = {
  value: V;
  label: string;
};

export type TSegmentedControlProps<V extends string> = {
  options: TSegmentedControlOption<V>[];
  value: V;
  onChange: (value: V) => void;
  accessibilityLabel: string;
};

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: TSegmentedControlProps<V>) {
  return (
    <View
      style={styles.track}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              isSelected && styles.segmentSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              color={isSelected ? "foreground" : "muted"}
              style={[styles.label, isSelected && styles.labelSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    height: 44,
    padding: 3,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentSelected: {
    backgroundColor: theme.colors.surfaceRaised,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Manrope-Medium",
  },
  labelSelected: {
    fontFamily: "Manrope-Bold",
  },
  pressed: { opacity: 0.8 },
});
