import { PropsWithChildren } from "react";

export type TFieldWrapperProps = PropsWithChildren & {
  label: string;
  /** Sufixo em cinza ao lado do label: "Posição secundária (opcional)". */
  labelSuffix?: string;
  /** Explicação abaixo do campo. Some quando há erro. */
  hint?: string;
  error?: string;
};
