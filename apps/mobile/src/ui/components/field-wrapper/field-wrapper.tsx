import { StyleSheet, View } from "react-native";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";
import { TFieldWrapperProps } from "./field-wrapper-types";

export const FieldWrapper = ({
  label,
  labelSuffix,
  hint,
  error,
  children,
}: TFieldWrapperProps) => {
  return (
    <View style={styles.wrapper}>
      <Text preset="small" color="foreground">
        {label}
        {labelSuffix ? (
          <Text preset="small" color="muted">
            {" "}
            {labelSuffix}
          </Text>
        ) : null}
      </Text>

      {children}

      {error ? (
        <Text preset="small" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text preset="small" color="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.space[4],
  },
});
