import { StyleSheet, View } from "react-native";
import { Input, NoticeBanner, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  PIX_KEY_LABEL,
  PIX_KEY_PLACEHOLDER,
  PIX_LOCKED,
  PIX_LOCKED_ACTION,
  PIX_LOCKED_TITLE,
  PIX_NO_KEY,
  PIX_ONLY_OWNER_CHANGES,
  PIX_ONLY_OWNER_SETS,
} from "../utils/racha-messages";

export type TPixKeyFieldProps = {
  mode: "edit" | "locked" | "readonly";
  value: string;
  onChangeText?: (value: string) => void;
  error?: string;
  hint?: string;
  onConfirmEmail?: () => void;
  isDisabled?: boolean;
};

export const PixKeyField = ({
  mode,
  value,
  onChangeText,
  error,
  hint,
  onConfirmEmail,
  isDisabled,
}: TPixKeyFieldProps) => {
  if (mode === "edit") {
    return (
      <Input
        label={PIX_KEY_LABEL}
        value={value}
        onChangeText={onChangeText}
        placeholder={PIX_KEY_PLACEHOLDER}
        error={error}
        hint={hint}
        autoCapitalize="none"
        autoCorrect={false}
        isDisabled={isDisabled}
      />
    );
  }

  const isLocked = mode === "locked";

  return (
    <View style={styles.wrapper}>
      <Text preset="small" color={isLocked ? "textDisabled" : "foreground"}>
        {PIX_KEY_LABEL}
      </Text>
      <View style={styles.box} accessibilityLabel={PIX_KEY_LABEL}>
        <Text
          color={isLocked ? "textDisabled" : value ? "foreground" : "muted"}
        >
          {value || (isLocked ? "" : PIX_NO_KEY)}
        </Text>
      </View>
      {isLocked ? (
        <NoticeBanner
          tone="warning"
          title={PIX_LOCKED_TITLE}
          text={PIX_LOCKED}
          actionLabel={PIX_LOCKED_ACTION}
          onAction={onConfirmEmail}
        />
      ) : (
        <Text preset="small" color="muted">
          {value ? PIX_ONLY_OWNER_CHANGES : PIX_ONLY_OWNER_SETS}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { gap: theme.space[8] },
  box: {
    minHeight: theme.minTouch,
    justifyContent: "center",
    paddingHorizontal: theme.space[16],
    backgroundColor: theme.colors.surfaceDisabled,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.mutedDisabled,
  },
});
