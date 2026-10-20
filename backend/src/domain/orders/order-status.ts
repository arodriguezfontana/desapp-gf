/**
 * Estado de una Order (020-order-matching-engine, data-model.md). Se deriva
 * siempre de `remainingQuantity` vs `quantity` — nunca se setea de forma
 * independiente, para que nunca quede inconsistente (data-model.md,
 * invariantes de Order).
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  COMPLETED = 'COMPLETED',
}
