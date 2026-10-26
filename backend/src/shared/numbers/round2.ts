/**
 * Redondea a 2 decimales (020-order-matching-engine, spec FR-011a: todo
 * precio calculado automaticamente se redondea a 2 decimales antes de
 * persistir/comparar, para que dos valuaciones conceptualmente iguales
 * produzcan siempre el mismo valor comparado).
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Redondea a 6 decimales: la precision con la que se persiste un score
 * (`DECIMAL(8,6)`, constitucion Technology Stack → Persistencia), para que lo
 * que devuelve un calculo al vuelo coincida con lo que se guardaria.
 */
export function roundToSixDecimals(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
