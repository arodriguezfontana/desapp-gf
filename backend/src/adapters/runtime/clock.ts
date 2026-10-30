/**
 * Puerto para obtener la hora actual. Mantiene a los Services libres de
 * `new Date()` directo, de modo que los tests puedan fijar el tiempo con un
 * doble. Token: CLOCK.
 */
export interface Clock {
  now(): Date;
}
