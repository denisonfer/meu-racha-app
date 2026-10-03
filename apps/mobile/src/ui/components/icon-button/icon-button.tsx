import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { theme, TThemeColor } from "@/ui/theme";
import { Icon, TIconName } from "../icon";

type TIconButtonProps = {
  icon: TIconName;
  color?: TThemeColor;
  /** Botão só com ícone não tem texto: o rótulo é obrigatório. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  onPress: () => void;
};

export const IconButton = ({
  icon,
  color = "foreground",
  accessibilityLabel,
  accessibilityHint,
  isLoading = false,
  isDisabled = false,
  onPress,
}: TIconButtonProps) => {
  const isInactive = isDisabled || isLoading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: isLoading }}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={theme.colors[color]} />
      ) : (
        <Icon name={icon} size={22} color={color} />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: theme.minTouch,
    height: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.control,
  },
  pressed: { backgroundColor: theme.colors.surfaceRaised },
});
