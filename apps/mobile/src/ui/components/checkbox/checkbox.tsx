import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons/static";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";
import { TCheckboxProps } from "./checkbox-types";

export const Checkbox = ({
  label,
  accessibilityLabel,
  isChecked,
  onChange,
  error,
  isDisabled = false,
}: TCheckboxProps) => {
  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => onChange(!isChecked)}
        disabled={isDisabled}
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: isChecked, disabled: isDisabled }}
        style={({ pressed }) => [
          styles.row,
          { opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        ]}
      >
        <View
          style={[
            styles.box,
            {
              backgroundColor: isChecked
                ? theme.colors.action
                : theme.colors.surface,
              borderColor: error
                ? theme.colors.danger
                : isChecked
                  ? theme.colors.action
                  : theme.colors.border,
            },
          ]}
        >
          {isChecked ? (
            <Ionicons
              name="checkmark"
              size={16}
              color={theme.colors.onAction}
            />
          ) : null}
        </View>

        {typeof label === "string" ? (
          <Text preset="small">{label}</Text>
        ) : (
          label
        )}
      </Pressable>

      {error ? (
        <Text preset="small" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.space[4],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[8],
    minHeight: theme.minTouch,
  },
  box: {
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: theme.radius.check,
    borderWidth: 1,
  },
});
