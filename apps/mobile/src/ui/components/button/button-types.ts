import { TThemeColor } from "@/ui/theme";
import { PressableProps } from "react-native";
import type { TIconName } from "../icon";

export type TButtonPreset =
  | "primary"
  | "secondary"
  | "destructive"
  | "text"
  | "outline"
  | "destructiveOutline";

export type TButtonProps = PressableProps & {
  title: string;
  preset?: TButtonPreset;
  isLoading?: boolean;
  isDisabled?: boolean;
  /** Antes do título, na cor dele. */
  icon?: TIconName;
};

export type TPresetConfig = {
  backgroundColor: TThemeColor;
  pressedBackgroundColor: TThemeColor;
  titleColor: TThemeColor;
  borderColor?: TThemeColor;
};
