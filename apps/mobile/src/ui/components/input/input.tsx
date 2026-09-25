import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Icon } from "../icon";
import { FieldWrapper } from "../field-wrapper";
import { theme } from "@/ui/theme";
import {
  TInputPreset,
  TInputProps,
  TInputStatus,
  TPresetConfig,
} from "./input-types";
import { applyDateMask } from "@meu-racha/domain";

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
  date: {
    keyboardType: "number-pad",
    maxLength: 10, // DD/MM/AAAA
  },
};

const StatusIcon = ({ status }: { status?: TInputStatus }) => {
  if (!status) return null;

  if (status === "checking") {
    return (
      <ActivityIndicator
        size="small"
        color={theme.colors.muted}
        accessibilityLabel="Verificando"
      />
    );
  }

  const isValid = status === "valid";

  return (
    <Icon
      name={isValid ? "success" : "error"}
      color={isValid ? "success" : "danger"}
      accessibilityLabel={isValid ? "Disponível" : "Indisponível"}
    />
  );
};

export const Input = ({
  label,
  labelSuffix,
  hint,
  preset = "text",
  error,
  isDisabled = false,
  status,
  onFocus,
  onBlur,
  onChangeText,
  onSubmitEditing,
  returnKeyType,
  submitBehavior,
  next,
  ref,
  style,
  ...props
}: TInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecret, setIsSecret] = useState(preset === "password");

  const config = presetConfig[preset];
  const hasEyeToggle = preset === "password";
  const hasDateMask = preset === "date";

  const borderColor = error
    ? theme.colors.danger
    : isFocused
      ? theme.colors.action
      : theme.colors.border;

  return (
    <FieldWrapper
      label={label}
      labelSuffix={labelSuffix}
      hint={hint}
      error={error}
    >
      <View
        style={[styles.field, { borderColor, opacity: isDisabled ? 0.5 : 1 }]}
      >
        <TextInput
          {...config}
          {...props}
          ref={ref}
          returnKeyType={returnKeyType ?? (next ? "next" : undefined)}
          submitBehavior={submitBehavior ?? (next ? "submit" : undefined)}
          onSubmitEditing={
            onSubmitEditing || next
              ? (event) => {
                  onSubmitEditing?.(event);
                  next?.current?.focus();
                }
              : undefined
          }
          secureTextEntry={hasEyeToggle ? isSecret : config.secureTextEntry}
          editable={!isDisabled}
          onChangeText={(text) =>
            onChangeText?.(hasDateMask ? applyDateMask(text) : text)
          }
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

        <StatusIcon status={status} />

        {hasEyeToggle && (
          <Pressable
            onPress={() => setIsSecret((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={isSecret ? "Mostrar senha" : "Ocultar senha"}
          >
            <Icon name={isSecret ? "eye-off" : "eye"} color="muted" />
          </Pressable>
        )}
      </View>
    </FieldWrapper>
  );
};

const styles = StyleSheet.create({
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
