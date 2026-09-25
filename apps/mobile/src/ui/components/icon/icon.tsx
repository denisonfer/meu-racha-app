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
  /** Ícone com significado próprio precisa de rótulo; decorativo, não. */
  accessibilityLabel?: string;
};

export const Icon = ({
  name,
  size = 20,
  color = "foreground",
  strokeWidth,
  accessibilityLabel,
}: TIconProps) => {
  const LucideIcon = iconMap[name];

  return (
    <LucideIcon
      size={size}
      color={theme.colors[color]}
      strokeWidth={strokeWidth}
      accessibilityLabel={accessibilityLabel}
    />
  );
};
