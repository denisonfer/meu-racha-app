import { Control, FieldValues, Path } from "react-hook-form";

export type TChipProps = {
  label: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  /** Divide a largura com os irmãos — usado no segmentado (Linha | Gol). */
  isFullWidth?: boolean;
  onPress: () => void;
};

export type TChipOption<V extends string> = {
  value: V;
  label: string;
};

export type TChipGroupProps<V extends string> = {
  label: string;
  options: TChipOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  error?: string;
  isDisabled?: boolean;
  labelSuffix?: string;
  hint?: string;
  /** Segmentado: as opções dividem a largura em vez de fluir em linha. */
  isFullWidth?: boolean;
};

export type TFormChipGroupProps<T extends FieldValues, V extends string> = Omit<
  TChipGroupProps<V>,
  "value" | "onChange" | "error"
> & {
  control: Control<T>;
  name: Path<T>;
};
