import { theme, TThemeColor, TThemeTextPreset } from "@/ui/theme";
import { PropsWithChildren } from "react";
import { Text as RNText, TextProps } from "react-native";

export type TTextProps = TextProps &
  PropsWithChildren & {
    /**
     * @default "body"
     */
    preset?: TThemeTextPreset;
    /**
     * @default "text"
     */
    color?: TThemeColor;
  };

export const Text = ({
  children,
  preset = "body",
  color = "foreground",
  style,
  ...props
}: TTextProps) => {
  return (
    <RNText
      {...props}
      style={[theme.text[preset], { color: theme.colors[color] }, style]}
    >
      {children}
    </RNText>
  );
};
