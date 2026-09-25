import { StyleSheet, View } from "react-native";
import { Chip } from "./chip";
import { FieldWrapper } from "../field-wrapper";
import { theme } from "@/ui/theme";
import { TChipGroupProps } from "./chip-types";

export function ChipGroup<V extends string>({
  label,
  options,
  value,
  onChange,
  error,
  isDisabled = false,
  isFullWidth = false,
  labelSuffix,
  hint,
}: TChipGroupProps<V>) {
  return (
    <FieldWrapper
      label={label}
      labelSuffix={labelSuffix}
      hint={hint}
      error={error}
    >
      <View style={styles.group} accessibilityRole="radiogroup">
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            isSelected={option.value === value}
            isDisabled={isDisabled}
            isFullWidth={isFullWidth}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </FieldWrapper>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[8],
  },
});
