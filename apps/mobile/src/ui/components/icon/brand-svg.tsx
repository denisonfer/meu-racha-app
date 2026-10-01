import { PropsWithChildren } from "react";
import Svg from "react-native-svg";

export type TBrandIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  accessibilityLabel?: string;
};

export const BrandSvg = ({
  size = 24,
  color,
  strokeWidth = 2,
  accessibilityLabel,
  children,
}: PropsWithChildren<TBrandIconProps>) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    accessibilityLabel={accessibilityLabel}
  >
    {children}
  </Svg>
);
