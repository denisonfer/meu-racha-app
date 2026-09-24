import { FieldValues, useController } from "react-hook-form";
import { ChipGroup } from "./chip-group";
import { TFormChipGroupProps } from "./chip-types";

export function FormChipGroup<T extends FieldValues, V extends string>({
  control,
  name,
  ...props
}: TFormChipGroupProps<T, V>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <ChipGroup<V>
      {...props}
      value={field.value}
      onChange={field.onChange}
      error={fieldState.error?.message}
    />
  );
}
