import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons/static";
import { Text } from "../text/text";
import { theme } from "@/ui/theme";
import { TInputPreset, TInputProps, TPresetConfig } from "./input-types";

const presetConfig: Record<TInputPreset, TPresetConfig> = {
  text: {},
  email: {
    keyboardType: "email-address",
    autoCapitalize: "none",
    autoComplete: "email",
    autoCorrect: false,
  },
  username: {
    autoCapitalize: "none",
    autoComplete: "username",
    autoCorrect: false,
    maxLength: 20,
  },
  password: {
    autoCapitalize: "none",
    autoComplete: "new-password",
    autoCorrect: false,
    secureTextEntry: true,
  },
  numeric: {
    keyboardType: "number-pad",
  },
};

export const Input = ({
  label,
  preset = "text",
  error,
  isDisabled = false,
  onFocus,
  onBlur,
  style,
  ...props
}: TInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecret, setIsSecret] = useState(preset === "password");

  const config = presetConfig[preset];
  const hasEyeToggle = preset === "password";

  const borderColor = error
    ? theme.colors.danger
    : isFocused
      ? theme.colors.action
      : theme.colors.border;

  return (
    <View style={styles.wrapper}>
      <Text preset="small" color="muted">
        {label}
      </Text>

      <View
        style={[styles.field, { borderColor, opacity: isDisabled ? 0.5 : 1 }]}
      >
        <TextInput
          {...config}
          {...props}
          secureTextEntry={hasEyeToggle ? isSecret : config.secureTextEntry}
          editable={!isDisabled}
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.muted}
          style={[styles.textInput, style]}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
        />

        {hasEyeToggle && (
          <Pressable
            onPress={() => setIsSecret((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={isSecret ? "Mostrar senha" : "Ocultar senha"}
          >
            <Ionicons
              name={isSecret ? "eye-off" : "eye"}
              size={20}
              color={theme.colors.muted}
            />
          </Pressable>
        )}
      </View>

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
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[8],
    minHeight: theme.minTouch,
    paddingHorizontal: theme.space[16],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    paddingVertical: theme.space[8],
    color: theme.colors.foreground,
    ...theme.text.body,
  },
});
