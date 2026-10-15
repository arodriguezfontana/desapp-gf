import { PlayerQuote } from '../../domain/quotation/player-quote';

/**
 * Puerto de dominio para la persistencia de PlayerQuote.
 * Token: PLAYER_QUOTE_REPOSITORY (modules/quotation/quotation.constants.ts).
 *
 * El historial de cotizaciones es por usuario, no global
 * (019-per-user-valuation-strategies, spec DD-002): toda consulta de
 * historial está acotada por `userId`.
 */
export interface PlayerQuoteRepository {
  saveMany(quotes: PlayerQuote[]): Promise<void>;
  findAllByPlayerIdAndUserId(playerId: string, userId: string): Promise<PlayerQuote[]>;
}
