import { Circle, Line, Path, Rect } from "react-native-svg";
import { BrandSvg, TBrandIconProps } from "./brand-svg";

export const RachaIcon = (props: TBrandIconProps) => (
  <BrandSvg {...props}>
    <Rect x={3} y={5} width={18} height={14} rx={2} />
    <Line x1={12} y1={5} x2={12} y2={19} />
    <Circle cx={12} cy={12} r={2.6} />
  </BrandSvg>
);

export const NotificationIcon = (props: TBrandIconProps) => (
  <BrandSvg {...props}>
    <Path d="M6 9a6 6 0 0 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9z" />
    <Path d="M10 20a2 2 0 0 0 4 0" />
  </BrandSvg>
);

// duas bolinhas, uma cheia: o gesto do sorteio
export const BolinhasIcon = ({ color, ...props }: TBrandIconProps) => (
  <BrandSvg color={color} {...props}>
    <Circle cx={8.5} cy={12} r={5} />
    <Circle cx={15.5} cy={12} r={5} fill={color} stroke="none" />
  </BrandSvg>
);
