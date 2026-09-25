import { TThemeColor } from "@/ui/theme";
import { PressableProps } from "react-native";

export type TButtonPreset = "primary" | "secondary" | "destructive" | "text";

export type TButtonProps = PressableProps & {
  title: string;
  preset?: TButtonPreset;
  isLoading?: boolean;
  isDisabled?: boolean;
};

export type TPresetConfig = {
  backgroundColor: TThemeColor;
  pressedBackgroundColor: TThemeColor;
  titleColor: TThemeColor;
};
