/**
 * Redondea a 2 decimales (020-order-matching-engine, spec FR-011a: todo
 * precio calculado automaticamente se redondea a 2 decimales antes de
 * persistir/comparar, para que dos valuaciones conceptualmente iguales
 * produzcan siempre el mismo valor comparado).
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
