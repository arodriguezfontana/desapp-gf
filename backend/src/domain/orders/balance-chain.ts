import { TokenTransactionType } from './enums/token-transaction-type';
import { NegativeBalanceChainError } from './errors/negative-balance-chain.error';
import { INITIAL_EMISSION_QUANTITY } from './token-emission';

/**
 * Cadena de saldos de una tenencia (030-token-balance-snapshot). Funciones puras de dominio:
 * las usan la siembra de simulación y el backfill de los asientos históricos.
 */

/** Un movimiento de una tenencia con lo mínimo para ordenarlo en el tiempo. */
export interface ChainMovement {
  id: string;
  type: TokenTransactionType;
  quantity: number;
  createdAt: Date;
}

/** Saldo de una tenencia antes y después de un movimiento. */
export interface ChainBalance {
  before: number;
  after: number;
}

const typeRank = (type: TokenTransactionType): number => (type === TokenTransactionType.CREDIT ? 0 : 1);

/**
 * Orden cronológico determinista de los movimientos de una tenencia: por instante ascendente; a
 * igual instante, los CREDIT antes que los DEBIT (es el orden real con el que el sistema los
 * aplica y el que nunca deja la tenencia en negativo); y a igualdad total, por `id`. El log no
 * guarda un número de secuencia, así que entre movimientos idénticos en tipo e instante los saldos
 * intermedios son una aproximación; el saldo final no cambia. No muta la entrada.
 */
export function orderForChain<T extends ChainMovement>(movements: readonly T[]): T[] {
  return [...movements].sort((a, b) => {
    const byTime = a.createdAt.getTime() - b.createdAt.getTime();
    if (byTime !== 0) return byTime;
    const byType = typeRank(a.type) - typeRank(b.type);
    if (byType !== 0) return byType;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Aplica los movimientos en el orden recibido a partir del saldo de apertura y devuelve el saldo
 * antes/después de cada uno: cada `before` es el `after` del movimiento anterior.
 * @throws NegativeBalanceChainError si la apertura o algún saldo resultante es negativo.
 */
export function chainBalances(
  opening: number,
  movements: ReadonlyArray<{ type: TokenTransactionType; quantity: number }>,
): ChainBalance[] {
  if (opening < 0) {
    throw new NegativeBalanceChainError();
  }
  const result: ChainBalance[] = [];
  let balance = opening;
  for (const movement of movements) {
    const after = movement.type === TokenTransactionType.CREDIT ? balance + movement.quantity : balance - movement.quantity;
    if (after < 0) {
      throw new NegativeBalanceChainError();
    }
    result.push({ before: balance, after });
    balance = after;
  }
  return result;
}

/** Resultado de reconstruir la cadena de una tenencia a partir de sus asientos sin saldos. */
export type ChainReconstruction =
  | { status: 'ok'; opening: number; snapshots: Map<string, ChainBalance> }
  | {
      status: 'inconsistent';
      reason: 'opening-mismatch' | 'negative-balance';
      opening: number;
      net: number;
      closingBalance: number;
    };

/**
 * Reconstruye el saldo antes/después de los asientos `pending` de una tenencia (backfill de
 * 030-token-balance-snapshot), validándolo contra el saldo real.
 *
 * - `closingBalance` es el saldo que la tenencia tenía justo después del último asiento pendiente:
 *   el `balance_before` del primer asiento ya completo o, si no hay, la cantidad actual.
 * - `apertura = closingBalance − neto` (neto = Σ CREDIT − Σ DEBIT). Es válida si es 0 o, sólo para
 *   el superusuario, la cantidad de la emisión inicial anterior a la feature (que nunca se auditó).
 *   Cualquier otra apertura es una inconsistencia entre el historial y el saldo real.
 * - La cadena no puede pasar por un saldo negativo.
 *
 * Devuelve un mapa `id → { before, after }` si todo valida; si no, la causa, sin inventar valores.
 */
export function reconstructHoldingChain(props: {
  pending: readonly ChainMovement[];
  closingBalance: number;
  isSuperuser: boolean;
}): ChainReconstruction {
  const { pending, closingBalance, isSuperuser } = props;
  const net = pending.reduce(
    (acc, movement) => acc + (movement.type === TokenTransactionType.CREDIT ? movement.quantity : -movement.quantity),
    0,
  );
  const opening = closingBalance - net;
  const validOpening = opening === 0 || (isSuperuser && opening === INITIAL_EMISSION_QUANTITY);
  if (!validOpening) {
    return { status: 'inconsistent', reason: 'opening-mismatch', opening, net, closingBalance };
  }

  const ordered = orderForChain(pending);
  try {
    const balances = chainBalances(opening, ordered);
    const snapshots = new Map<string, ChainBalance>();
    ordered.forEach((movement, index) => snapshots.set(movement.id, balances[index]));
    return { status: 'ok', opening, snapshots };
  } catch (error) {
    if (error instanceof NegativeBalanceChainError) {
      return { status: 'inconsistent', reason: 'negative-balance', opening, net, closingBalance };
    }
    throw error;
  }
}
