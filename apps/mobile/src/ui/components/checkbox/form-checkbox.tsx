import { FieldValues, useController } from "react-hook-form";
import { Checkbox } from "./checkbox";
import { TFormCheckboxProps } from "./checkbox-types";

export function FormCheckbox<T extends FieldValues>({
  control,
  name,
  ...props
}: TFormCheckboxProps<T>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <Checkbox
      {...props}
      isChecked={Boolean(field.value)}
      onChange={field.onChange}
      error={fieldState.error?.message}
    />
  );
}
