import { View } from "react-native";
import { theme } from "@/ui/theme";

const SIZES = {
  xs: { width: 8, height: 11 },
  sm: { width: 11, height: 15 },
  md: { width: 13, height: 18 },
  lg: { width: 16, height: 22 },
} as const;

export type TPenaltyCardSize = keyof typeof SIZES;

export type TPenaltyCardProps = {
  color: "yellow" | "red";
  size: TPenaltyCardSize;
};

/** Marca do cartão. O texto ao lado carrega o sentido — a cor do cartão não vai em letra. */
export const PenaltyCard = ({ color, size }: TPenaltyCardProps) => {
  const box = SIZES[size];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: box.width,
        height: box.height,
        borderRadius: 2,
        backgroundColor:
          color === "yellow"
            ? theme.colors.cartaoAmarelo
            : theme.colors.cartaoVermelho,
      }}
    />
  );
};
