import { chainBalances, ChainBalance, ChainMovement, orderForChain } from '../../domain/orders/balance-chain';

/** Movimiento sembrado por la simulación, con su titular (030-token-balance-snapshot). */
export interface SimulatedMovement extends ChainMovement {
  userId: string;
  playerId: string;
}

/**
 * Saldo antes/después de cada movimiento sembrado, encadenado por tenencia (usuario, jugador) en
 * orden cronológico a partir de la tenencia de apertura que indica `openingFor`. Devuelve un mapa
 * por `id` de movimiento.
 *
 * Deja los asientos sembrados bien formados (saldos no negativos, `después = antes ± cantidad`,
 * cadena continua). No reconcilia la tenencia final de los bots, que la simulación fija en un valor
 * absoluto con `withQuantity`: son datos de prueba (spec 030, Fuera de alcance).
 * @throws NegativeBalanceChainError si alguna cadena pasaría por un saldo negativo.
 */
export function buildSimulationSnapshots(
  movements: readonly SimulatedMovement[],
  openingFor: (userId: string, playerId: string) => number,
): Map<string, ChainBalance> {
  const byHolding = new Map<string, SimulatedMovement[]>();
  for (const movement of movements) {
    const key = `${movement.userId}|${movement.playerId}`;
    const group = byHolding.get(key);
    if (group) group.push(movement);
    else byHolding.set(key, [movement]);
  }

  const result = new Map<string, ChainBalance>();
  for (const group of byHolding.values()) {
    const ordered = orderForChain(group);
    const balances = chainBalances(openingFor(ordered[0].userId, ordered[0].playerId), ordered);
    ordered.forEach((movement, index) => result.set(movement.id, balances[index]));
  }
  return result;
}
