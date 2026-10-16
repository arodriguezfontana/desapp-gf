import { DomainError } from '../../../shared/errors/domain-error';

/**
 * Falla el cálculo de un jugador puntual indicado por `playerId` en
 * POST /users/me/quotes/recalculate. A diferencia del modo masivo (que saltea
 * y continúa, FR-014b), en modo puntual no hay "resto del catálogo" al que
 * seguir, así que se rechaza la operación completa (019, contracts, 422).
 */
export class PlayerQuoteCalculationFailedError extends DomainError {
  constructor(playerId: string, cause: unknown) {
    super(
      `No se pudo calcular la cotización del jugador '${playerId}': ${cause instanceof Error ? cause.message : String(cause)}.`,
    );
  }
}
