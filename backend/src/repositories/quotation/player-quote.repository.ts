import { PlayerQuote } from '../../domain/quotation/player-quote';

/**
 * Puerto de dominio para la persistencia de PlayerQuote.
 * Token: PLAYER_QUOTE_REPOSITORY (modules/quotation/quotation.constants.ts).
 */
export interface PlayerQuoteRepository {
  saveMany(quotes: PlayerQuote[]): Promise<void>;
  findLatestByPlayerId(playerId: string): Promise<PlayerQuote | null>;
}
