import { StyleSheet, View } from "react-native";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";
import { TFieldWrapperProps } from "./field-wrapper-types";

export const FieldWrapper = ({
  label,
  error,
  children,
}: TFieldWrapperProps) => {
  return (
    <View style={styles.wrapper}>
      <Text preset="small" color="muted">
        {label}
      </Text>

      {children}

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
});
