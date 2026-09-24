import { Pressable, StyleSheet } from "react-native";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";
import { TChipProps } from "./chip-types";

export const Chip = ({
  label,
  isSelected = false,
  isDisabled = false,
  onPress,
}: TChipProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: isSelected
            ? theme.colors.action
            : theme.colors.surface,
          borderColor: isSelected ? theme.colors.action : theme.colors.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text preset="small" color={isSelected ? "onAction" : "foreground"}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    justifyContent: "center",
    minHeight: theme.minTouch,
    paddingHorizontal: theme.space[16],
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
});
