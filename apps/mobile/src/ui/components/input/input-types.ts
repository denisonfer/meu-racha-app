import { TextInput, TextInputProps } from "react-native";
import { Ref } from "react";

export type TInputPreset =
  "text" | "email" | "username" | "password" | "numeric";

export type TInputProps = TextInputProps & {
  label: string;
  /**
   * @default "text"
   */
  preset?: TInputPreset;
  /** Mensagem de erro. Presente = campo em estado de erro. */
  error?: string;
  isDisabled?: boolean;
  /** React 19: ref é prop normal, sem forwardRef. */
  ref?: Ref<TextInput>;
};

export type TPresetConfig = Pick<
  TextInputProps,
  | "keyboardType"
  | "autoCapitalize"
  | "autoComplete"
  | "autoCorrect"
  | "maxLength"
  | "secureTextEntry"
>;
