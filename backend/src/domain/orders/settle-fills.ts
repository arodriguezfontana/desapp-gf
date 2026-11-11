import { MovementSnapshot, TokenHolding } from '../portfolio/token-holding';
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

/** Saldo de cada parte de un fill justo antes y despues de aplicarlo (030-token-balance-snapshot). */
export interface FillSnapshot {
  buyer: MovementSnapshot;
  seller: MovementSnapshot;
}

/**
 * Funcion pura de dominio (constitucion, Principio II y VI): aplica cada fill al
 * holding del comprador (credito) y al del vendedor (debito) y devuelve los
 * holdings resultantes por `userId`, sin tocar los recibidos, junto con el saldo
 * antes/despues de cada movimiento (un snapshot por fill, en el orden de `fills`).
 *
 * Los snapshots salen de las mismas operaciones `applyCredit`/`applyDebit` que cambian el
 * saldo: no se recalculan despues (spec 030, FR-002).
 *
 * Si `buyerUserId === sellerUserId` (auto-match) el credito y el debito caen
 * sobre EL MISMO holding: por eso cada operacion lee el holding recien antes de
 * aplicarse, para que el debito parta del estado ya acreditado y el saldo neto
 * quede sin cambio.
 *
 * @throws InsufficientHoldingError si algun debito dejaria un holding negativo.
 */
export function settleFillsAudited(
  fills: Fill[],
  holdings: ReadonlyMap<string, TokenHolding>,
): { holdings: Map<string, TokenHolding>; snapshots: FillSnapshot[] } {
  const settled = new Map(holdings);
  const snapshots: FillSnapshot[] = [];
  for (const fill of fills) {
    const credited = settled.get(fill.buyerUserId)!.applyCredit(fill.quantity);
    settled.set(fill.buyerUserId, credited.holding);
    const debited = settled.get(fill.sellerUserId)!.applyDebit(fill.quantity);
    settled.set(fill.sellerUserId, debited.holding);
    snapshots.push({ buyer: credited.snapshot, seller: debited.snapshot });
  }
  return { holdings: settled, snapshots };
}

/**
 * Igual que `settleFillsAudited` pero devuelve solo los holdings resultantes. Es el calculo
 * original (constitucion, Principio II y VI): los dos comparten una unica implementacion.
 *
 * @throws InsufficientHoldingError si algun debito dejaria un holding negativo.
 */
export function settleFills(fills: Fill[], holdings: ReadonlyMap<string, TokenHolding>): Map<string, TokenHolding> {
  return settleFillsAudited(fills, holdings).holdings;
}
