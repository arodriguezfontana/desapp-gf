import { TokenHolding } from '../portfolio/token-holding';
import { Fill } from './match-order';

/**
 * Usuarios involucrados en los fills, sin repetidos y ordenados por `userId`
 * ascendente. Es el orden deterministico en el que el Service debe lockear los
 * holdings (research.md D4) para que dos ordenes concurrentes sobre los mismos
 * usuarios en direcciones opuestas nunca se deadlockeen entre si.
 */
export function involvedUserIdsInLockOrder(fills: Fill[]): string[] {
  const userIds = new Set<string>();
  for (const fill of fills) {
    userIds.add(fill.buyerUserId);
    userIds.add(fill.sellerUserId);
  }
  return Array.from(userIds).sort((a, b) => a.localeCompare(b));
}

/**
 * Funcion pura de dominio (constitucion, Principio II y VI): aplica cada fill al
 * holding del comprador (credito) y al del vendedor (debito) y devuelve los
 * holdings resultantes por `userId`, sin tocar los recibidos.
 *
 * Si `buyerUserId === sellerUserId` (auto-match) el credito y el debito caen
 * sobre EL MISMO holding: por eso cada operacion lee el holding recien antes de
 * aplicarse, para que el debito parta del estado ya acreditado y el saldo neto
 * quede sin cambio.
 *
 * @throws InsufficientHoldingError si algun debito dejaria un holding negativo.
 */
export function settleFills(fills: Fill[], holdings: ReadonlyMap<string, TokenHolding>): Map<string, TokenHolding> {
  const settled = new Map(holdings);
  for (const fill of fills) {
    settled.set(fill.buyerUserId, settled.get(fill.buyerUserId)!.credit(fill.quantity));
    settled.set(fill.sellerUserId, settled.get(fill.sellerUserId)!.debit(fill.quantity));
  }
  return settled;
}
