import Svg, { Circle, Path } from "react-native-svg";
import { theme } from "@/ui/theme";

/** Azul tem um círculo, vermelha um traço: a cor nunca vai sozinha. */
export const BolinhaMark = ({
  isBlue,
  size,
  color = theme.colors.onAction,
  strokeWidth = 3.2,
}: {
  isBlue: boolean;
  size: number;
  color?: string;
  strokeWidth?: number;
}) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    {isBlue ? (
      <Circle cx={16} cy={16} r={9} stroke={color} strokeWidth={strokeWidth} />
    ) : (
      <Path
        d="M16 5v22"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    )}
  </Svg>
);
