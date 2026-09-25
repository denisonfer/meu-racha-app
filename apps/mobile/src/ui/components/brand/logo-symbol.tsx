import Svg, { Path } from "react-native-svg";
import { theme } from "@/ui/theme";
import { TBrandMarkProps } from "./brand-types";

const RATIO = 64 / 64;

/** Só o símbolo (quadrado). Fonte: assets/brand/symbol.svg */
export const LogoSymbol = ({
  height = 64,
  color = "foreground",
  accentColor = "action",
}: TBrandMarkProps) => {
  return (
    <Svg
      width={height * RATIO}
      height={height}
      viewBox="0 0 64 64"
      accessibilityRole="image"
      accessibilityLabel="Meu Racha"
    >
      <Path
        fill={theme.colors[color]}
        d="M30.5 0H14A14 14 0 0 0 0 14V50A14 14 0 0 0 14 64H30.5V59H14.5A9.5 9.5 0 0 1 5 49.5V14.5A9.5 9.5 0 0 1 14.5 5H30.5Z"
      />
      <Path
        fill={theme.colors[color]}
        d="M30.5 19.09A13 13 0 0 0 30.5 44.91Z"
      />
      <Path
        fill={theme.colors[accentColor]}
        fillRule="evenodd"
        d="M33.5 0H50A14 14 0 0 1 64 14V50A14 14 0 0 1 50 64H33.5ZM33.5 19.09A13 13 0 0 1 33.5 44.91Z"
      />
    </Svg>
  );
};
