import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { calculatePlayerValue } from '../../domain/quotation/calculate-player-value';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { NoActiveStrategyError } from '../../domain/quotation/errors/no-active-strategy.error';
import { RecalculationInProgressError } from '../../domain/quotation/errors/recalculation-in-progress.error';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import { PlayerQuoteRepository } from '../../repositories/quotation/player-quote.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';
import {
  VALUATION_STRATEGY_REPOSITORY,
  PLAYER_QUOTE_REPOSITORY,
} from '../../modules/quotation/quotation.constants';
import { PLAYER_REPOSITORY } from '../../modules/player/player.constants';

export interface RecalculateResult {
  processedPlayers: number;
  errors: number;
  durationMs: number;
}

export interface PlayerQuoteWithStrategy {
  quote: PlayerQuote;
  strategyName: string;
}

/**
 * Orquesta el recálculo masivo de cotizaciones (012-valuation-strategies, spec US2).
 *
 * Lock en memoria (isRunning) siguiendo el mismo patrón que PlayerSyncService.
 * El recálculo es sincrónico: el endpoint espera a que termine y devuelve el resumen.
 */
@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);
  private isRunning = false;

  constructor(
    @Inject(VALUATION_STRATEGY_REPOSITORY)
    private readonly strategyRepository: ValuationStrategyRepository,
    @Inject(PLAYER_QUOTE_REPOSITORY)
    private readonly quoteRepository: PlayerQuoteRepository,
    @Inject(PLAYER_REPOSITORY)
    private readonly playerRepository: PlayerRepository,
  ) {}

  async getLatestQuoteByPlayerId(playerId: string): Promise<PlayerQuote | null> {
    return this.quoteRepository.findLatestByPlayerId(playerId);
  }

  /**
   * Obtiene la cotización vigente de un jugador a una fecha determinada (o la más reciente si date es undefined).
   * Lanza PlayerNotFoundError si el jugador no existe (013-player-quote-endpoint).
   * Retorna null sin excepción si el jugador existe pero no tiene cotizaciones para esa fecha.
   */
  async getQuoteAtDate(
    playerId: string,
    date?: Date,
  ): Promise<PlayerQuoteWithStrategy | null> {
    const player = await this.playerRepository.findById(playerId);
    if (!player) {
      throw new PlayerNotFoundError();
    }

    const quote = date
      ? await this.quoteRepository.findLatestAtDate(playerId, date)
      : await this.quoteRepository.findLatestByPlayerId(playerId);

    if (!quote) {
      return null;
    }

    const strategy = await this.strategyRepository.findById(quote.strategyId);
    return {
      quote,
      strategyName: strategy?.name ?? 'Estrategia por Defecto',
    };
  }

  async activateStrategy(id: string) {
    return this.strategyRepository.activateStrategy(id);
  }

  async listStrategies() {
    return this.strategyRepository.findAll();
  }

  /**
   * Recalcula las cotizaciones de todos los jugadores activos usando la estrategia activa.
   *
   * La validación de estrategia activa ocurre antes de adquirir el lock para que
   * un 422 no bloquee intentos futuros (spec contracts/quotes-api.md).
   */
  async recalculateAll(): Promise<RecalculateResult> {
    const strategy = await this.strategyRepository.findActive();
    if (!strategy) {
      throw new NoActiveStrategyError();
    }

    if (this.isRunning) {
      throw new RecalculationInProgressError();
    }
    this.isRunning = true;
    const startTime = Date.now();

    let processedPlayers = 0;
    let errors = 0;

    try {
      const players = await this.playerRepository.findAllActive();

      const quotes: PlayerQuote[] = [];
      for (const player of players) {
        try {
          const { score, value, appliedPosition, weightsUsed } = calculatePlayerValue(
            player,
            strategy,
          );
          quotes.push(
            PlayerQuote.create({
              id: randomUUID(),
              playerId: player.id,
              strategyId: strategy.id,
              weightSnapshot: weightsUsed,
              factorEscalaSnapshot: strategy.factorEscala,
              score,
              value,
              calculatedAt: new Date(),
              appliedPosition,
            }),
          );
          processedPlayers++;
        } catch (err) {
          this.logger.error(
            `Error calculando cotización para jugador ${player.id}`,
            err instanceof Error ? err.stack : String(err),
          );
          errors++;
        }
      }

      await this.quoteRepository.saveMany(quotes);

      this.logger.log(
        `Recálculo completado: ${processedPlayers} jugadores procesados, ${errors} errores, ${Date.now() - startTime} ms`,
      );

      return { processedPlayers, errors, durationMs: Date.now() - startTime };
    } finally {
      this.isRunning = false;
    }
  }
}
