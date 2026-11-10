import { DomainError } from '../../../shared/errors/domain-error';

/**
 * 030-token-balance-snapshot: una cadena de saldos de una tenencia pasaría por un saldo negativo,
 * lo que contradice el invariante de que una tenencia nunca es negativa. Se rechaza en vez de
 * inventar valores (el backfill la reporta como inconsistencia).
 */
export class NegativeBalanceChainError extends DomainError {
  constructor() {
    super('La cadena de saldos de la tenencia pasaría por un saldo negativo.');
  }
}
