import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/ui/hooks/use-debounced-value";
import {
  availabilityQuery,
  isAskable,
  TAvailabilityField,
} from "../utils/availability";

const TYPING_DELAY = 400;

export function useAvailability(field: TAvailabilityField, value: string) {
  const debounced = useDebouncedValue(value, TYPING_DELAY);
  const enabled = isAskable(field, debounced);

  const query = useQuery({ ...availabilityQuery(field, debounced), enabled });

  const isSettled = debounced === value;

  return {
    isChecking: isAskable(field, value) && (!isSettled || query.isFetching),
    isAvailable: isSettled ? (query.data ?? null) : null,
  };
}
