import { useEffect, useState } from 'react';

/**
 * Hook para retrasar el cambio de un valor por un determinado número de milisegundos.
 * Usado para el input de texto libre (equipo) con debounce por defecto de 400ms.
 */
export function useDebounce<T>(value: T, delayMs: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

