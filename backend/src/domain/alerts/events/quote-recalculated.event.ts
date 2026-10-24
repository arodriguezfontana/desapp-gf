export const QUOTE_RECALCULATED_EVENT = 'quote.recalculated';

/**
 * Emitido por QuotationService.recalculateAll() una vez por cada PlayerQuote
 * nueva efectivamente persistida (025-player-price-alerts, data-model.md).
 * Ni QuotationService ni este evento conocen el módulo de alertas
 * (spec FR-021).
 */
export class QuoteRecalculatedEvent {
  constructor(
    public readonly userId: string,
    public readonly playerId: string,
    public readonly value: number,
    public readonly occurredAt: Date,
  ) {}
}
