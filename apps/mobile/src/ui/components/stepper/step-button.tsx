import { Pressable, StyleSheet } from "react-native";
import { theme } from "@/ui/theme";
import { Icon } from "../icon";

type TStepButtonProps = {
  icon: "minus" | "plus";
  isEnabled: boolean;
  onPress: () => void;
};

export const StepButton = ({ icon, isEnabled, onPress }: TStepButtonProps) => (
  <Pressable
    onPress={onPress}
    disabled={!isEnabled}
    style={({ pressed }) => [
      styles.button,
      {
        borderColor: isEnabled
          ? theme.colors.muted
          : theme.colors.mutedDisabled,
        opacity: pressed ? 0.8 : 1,
      },
    ]}
  >
    <Icon name={icon} color={isEnabled ? "foreground" : "textDisabled"} />
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    width: theme.minTouch,
    height: theme.minTouch,
    borderRadius: theme.radius.control,
    borderWidth: 1,
  },
});
