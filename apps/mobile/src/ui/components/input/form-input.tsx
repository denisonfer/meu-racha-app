import { Control, FieldValues, Path, useController } from "react-hook-form";
import { Input } from "./input";
import { TInputProps } from "./input-types";

export type TFormInputProps<T extends FieldValues> = Omit<
  TInputProps,
  "value" | "onChangeText" | "onBlur" | "error"
> & {
  control: Control<T>;
  name: Path<T>;
};

export function FormInput<T extends FieldValues>({
  control,
  name,
  ref,
  ...inputProps
}: TFormInputProps<T>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <Input
      {...inputProps}
      ref={ref}
      value={field.value}
      onChangeText={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
    />
  );
}
