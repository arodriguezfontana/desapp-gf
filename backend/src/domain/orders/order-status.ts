/**
 * Estado de una Order (020-order-matching-engine, data-model.md).
 * Se deriva de remainingQuantity vs quantity, o explícitamente CANCELLED
 * al cancelar la orden (023-cancel-order).
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
