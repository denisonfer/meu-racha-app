import { PropsWithChildren } from "react";

export type TFieldWrapperProps = PropsWithChildren & {
  label: string;
  error?: string;
};
