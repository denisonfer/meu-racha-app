import { useEffect, useState } from "react";

/**
 * Atrasa o valor até ele parar de mudar por `delay` ms.
 * Sem isso, cada tecla digitada vira uma requisição.
 */
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
