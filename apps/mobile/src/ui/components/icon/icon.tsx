import { theme, TThemeColor } from "@/ui/theme";
import { iconMap, TIconName } from "./icon-map";

export type TIconProps = {
  name: TIconName;
  /**
   * @default 20
   */
  size?: number;
  /**
   * @default "foreground"
   */
  color?: TThemeColor;
  strokeWidth?: number;
  fill?: TThemeColor;
  /** Ícone com significado próprio precisa de rótulo; decorativo, não. */
  accessibilityLabel?: string;
};

export const Icon = ({
  name,
  size = 20,
  color = "foreground",
  strokeWidth,
  fill,
  accessibilityLabel,
}: TIconProps) => {
  const LucideIcon = iconMap[name];

  return (
    <LucideIcon
      size={size}
      color={theme.colors[color]}
      strokeWidth={strokeWidth}
      fill={fill && theme.colors[fill]}
      accessibilityLabel={accessibilityLabel}
    />
  );
};
