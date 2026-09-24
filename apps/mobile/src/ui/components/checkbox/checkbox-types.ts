import { ReactNode } from "react";
import { Control, FieldValues, Path } from "react-hook-form";

export type TCheckboxProps = {
  /** Texto ao lado da caixa. ReactNode para caber link (ex.: Termos). */
  label: ReactNode;
  /** Lido por leitor de tela quando o label não é texto puro. */
  accessibilityLabel: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
  error?: string;
  isDisabled?: boolean;
};

export type TFormCheckboxProps<T extends FieldValues> = Omit<
  TCheckboxProps,
  "isChecked" | "onChange" | "error"
> & {
  control: Control<T>;
  name: Path<T>;
};
