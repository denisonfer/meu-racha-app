import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { Icon } from "../icon";
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
  outline: {
    backgroundColor: "background",
    pressedBackgroundColor: "surface",
    titleColor: "foreground",
    borderColor: "muted",
  },
  destructiveOutline: {
    backgroundColor: "background",
    pressedBackgroundColor: "surface",
    titleColor: "errorText",
    borderColor: "danger",
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
  icon,
  style,
  ...props
}: TButtonProps) => {
  const isInactive = isDisabled || isLoading;

  const isOutline = preset === "outline" || preset === "destructiveOutline";
  const config: TPresetConfig = isDisabled
    ? {
        ...disabledConfig,
        borderColor: isOutline ? "mutedDisabled" : undefined,
      }
    : presetConfig[preset];

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
          borderWidth: config.borderColor ? 1 : 0,
          borderColor: config.borderColor
            ? theme.colors[config.borderColor]
            : undefined,
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
        <>
          {icon ? (
            <Icon name={icon} size={22} color={config.titleColor} />
          ) : null}
          <Text
            preset="button"
            color={config.titleColor}
            style={[preset === "text" ? styles.title : undefined]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: theme.space[8],
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
