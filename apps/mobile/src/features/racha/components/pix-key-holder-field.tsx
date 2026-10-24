import { StyleSheet, View } from "react-native";
import { Input, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import {
  PIX_KEY_HOLDER_HINT,
  PIX_KEY_HOLDER_LABEL,
} from "../utils/racha-messages";

export type TPixKeyHolderFieldProps = {
  mode: "edit" | "locked" | "readonly";
  value: string;
  onChangeText?: (value: string) => void;
  error?: string;
  isDisabled?: boolean;
};

// fora da edição só aparece com titular salvo: o aviso de travado ou de "só o Dono" já
// fica no campo da chave, logo acima
export const PixKeyHolderField = ({
  mode,
  value,
  onChangeText,
  error,
  isDisabled,
}: TPixKeyHolderFieldProps) => {
  if (mode === "edit") {
    return (
      <Input
        label={PIX_KEY_HOLDER_LABEL}
        value={value}
        onChangeText={onChangeText}
        error={error}
        hint={PIX_KEY_HOLDER_HINT}
        autoCapitalize="words"
        maxLength={60}
        isDisabled={isDisabled}
      />
    );
  }

  if (!value) return null;

  const isLocked = mode === "locked";

  return (
    <View style={styles.wrapper}>
      <Text preset="small" color={isLocked ? "textDisabled" : "foreground"}>
        {PIX_KEY_HOLDER_LABEL}
      </Text>
      <View style={styles.box} accessibilityLabel={PIX_KEY_HOLDER_LABEL}>
        <Text color={isLocked ? "textDisabled" : "foreground"}>{value}</Text>
      </View>
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
