import { TextInput, TextInputProps } from "react-native";
import { Ref, RefObject } from "react";

export type TInputPreset =
  "text" | "email" | "username" | "password" | "numeric" | "date";

export type TInputStatus = "checking" | "valid" | "invalid";

export type TInputProps = TextInputProps & {
  label: string;
  /**
   * @default "text"
   */
  preset?: TInputPreset;
  error?: string;
  isDisabled?: boolean;
  labelSuffix?: string;
  hint?: string;
  status?: TInputStatus;
  ref?: Ref<TextInput>;
  /** Foca este campo no return. Teclado permanece aberto. */
  next?: RefObject<TextInput | null>;
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
