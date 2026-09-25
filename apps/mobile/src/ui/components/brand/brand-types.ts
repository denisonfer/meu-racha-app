import { TThemeColor } from "@/ui/theme";

export type TBrandMarkProps = {
  /** Altura em pontos. A largura sai da proporção original do arquivo. */
  height?: number;
  /** Cor do "meu" e do lado claro do símbolo. */
  color?: TThemeColor;
  /** Cor do "racha" e do lado lima do símbolo. */
  accentColor?: TThemeColor;
};
