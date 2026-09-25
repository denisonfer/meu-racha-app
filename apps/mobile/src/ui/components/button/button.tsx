import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { Text } from "../text/text";
import { TButtonPreset, TButtonProps, TPresetConfig } from "./button-types";
import { theme } from "@/ui/theme";

const presetConfig: Record<TButtonPreset, TPresetConfig> = {
  primary: {
    backgroundColor: "action",
    pressedBackgroundColor: "actionPressed",
    titleColor: "onAction",
  },
  secondary: {
    backgroundColor: "foreground",
    pressedBackgroundColor: "foregroundPressed",
    titleColor: "onAction",
  },
  destructive: {
    backgroundColor: "danger",
    pressedBackgroundColor: "dangerPressed",
    titleColor: "surface",
  },
  text: {
    backgroundColor: "background",
    pressedBackgroundColor: "background",
    titleColor: "foreground",
  },
};

const disabledConfig: TPresetConfig = {
  backgroundColor: "surface",
  pressedBackgroundColor: "surface",
  titleColor: "muted",
};

export const Button = ({
  title,
  preset = "primary",
  isLoading = false,
  isDisabled = false,
  style,
  ...props
}: TButtonProps) => {
  const isInactive = isDisabled || isLoading;
  const config = isDisabled ? disabledConfig : presetConfig[preset];

  return (
    <Pressable
      {...props}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: isLoading }}
      style={(state) => [
        styles.container,
        {
          backgroundColor:
            theme.colors[
              state.pressed
                ? config.pressedBackgroundColor
                : config.backgroundColor
            ],
        },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={theme.colors[config.titleColor]}
        />
      ) : (
        <Text preset="button" color={config.titleColor} style={styles.title}>
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: theme.minTouch,
    paddingVertical: theme.space[8],
    paddingHorizontal: theme.space[24],
    borderRadius: theme.radius.control,
  },
  title: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.action,
  },
});
