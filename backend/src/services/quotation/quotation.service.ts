import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { calculatePlayerValue } from '../../domain/quotation/calculate-player-value';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { Position } from '../../domain/player/enums/position';
import { StrategyNotFoundError } from '../../domain/quotation/errors/strategy-not-found.error';
import { RecalculationInProgressError } from '../../domain/quotation/errors/recalculation-in-progress.error';
import { PlayerQuoteCalculationFailedError } from '../../domain/quotation/errors/player-quote-calculation-failed.error';
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
  recalculated: Array<{ playerId: string; value: number; score: number }>;
  skipped: Array<{ playerId: string; reason: string }>;
}

export interface ValuationResult {
  playerId: string;
  strategyId: string;
  score: number;
  value: number;
  appliedPosition: Position | null;
}

/**
 * Orquesta las operaciones sobre las estrategias propias de cada usuario y el
 * recálculo manual de sus cotizaciones (019-per-user-valuation-strategies,
 * reemplaza el modelo de estrategia única de sistema de
 * 012-valuation-strategies).
 *
 * El lock de recálculo es en memoria, con una entrada por `userId` (spec
 * FR-016a, research.md D4): nunca bloquea el recálculo de un usuario distinto.
 */
@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);
  private readonly recalculationsInProgress = new Set<string>();

  constructor(
    @Inject(VALUATION_STRATEGY_REPOSITORY)
    private readonly strategyRepository: ValuationStrategyRepository,
    @Inject(PLAYER_QUOTE_REPOSITORY)
    private readonly quoteRepository: PlayerQuoteRepository,
    @Inject(PLAYER_REPOSITORY)
    private readonly playerRepository: PlayerRepository,
  ) {}

  /** Las dos estrategias propias del usuario (spec FR-004). */
  async listStrategies(userId: string): Promise<ValuationStrategy[]> {
    return this.strategyRepository.findByUserId(userId);
  }

  private async getOwnedStrategyOrThrow(id: string, userId: string): Promise<ValuationStrategy> {
    const strategy = await this.strategyRepository.findById(id);
    if (!strategy) {
      throw new StrategyNotFoundError(id);
    }
    strategy.assertOwnedBy(userId);
    return strategy;
  }

  /** Marca `strategyId` como seleccionada, desmarcando la otra del mismo usuario (spec FR-005). */
  async selectStrategy(userId: string, strategyId: string): Promise<ValuationStrategy> {
    await this.getOwnedStrategyOrThrow(strategyId, userId);
    return this.strategyRepository.selectStrategy(userId, strategyId);
  }

  /** Reemplazo completo de los pesos generales de una estrategia propia (spec FR-006, FR-008). */
  async editWeights(
    userId: string,
    strategyId: string,
    weights: Record<string, number>,
  ): Promise<ValuationStrategy> {
    const strategy = await this.getOwnedStrategyOrThrow(strategyId, userId);
    const updated = strategy.withWeights(weights);
    return this.strategyRepository.save(updated);
  }

  /** Reemplazo completo del perfil de una posición de una estrategia propia (spec FR-007, FR-008). */
  async editPositionWeights(
    userId: string,
    strategyId: string,
    position: Position,
    weights: Record<string, number>,
  ): Promise<ValuationStrategy> {
    const strategy = await this.getOwnedStrategyOrThrow(strategyId, userId);
    const updated = strategy.withPositionWeights(position, weights);
    return this.strategyRepository.save(updated);
  }

  /**
   * Calcula al vuelo el valor de un jugador, sin persistir nada (spec FR-010).
   * Sin `strategyId`, usa la estrategia seleccionada del usuario; con
   * `strategyId`, usa esa estrategia puntual si pertenece al usuario (spec
   * FR-011, FR-012).
   */
  async valuate(userId: string, playerId: string, strategyId?: string): Promise<ValuationResult> {
    const player = await this.playerRepository.findById(playerId);
    if (!player) {
      throw new PlayerNotFoundError();
    }

    const strategy = strategyId
      ? await this.getOwnedStrategyOrThrow(strategyId, userId)
      : await this.getSelectedStrategyOrThrow(userId);

    const { score, value, appliedPosition } = calculatePlayerValue(player, strategy);
    return { playerId, strategyId: strategy.id, score, value, appliedPosition };
  }

  private async getSelectedStrategyOrThrow(userId: string): Promise<ValuationStrategy> {
    const strategies = await this.strategyRepository.findByUserId(userId);
    const selected = strategies.find((s) => s.isSelected);
    if (!selected) {
      throw new StrategyNotFoundError(userId);
    }
    return selected;
  }

  /**
   * Historial propio de cotizaciones de un jugador (spec FR-017/FR-018/FR-019).
   * Lanza PlayerNotFoundError si el jugador no existe; retorna [] si el
   * usuario nunca recalculó ese jugador.
   */
  async getQuoteHistory(userId: string, playerId: string): Promise<PlayerQuote[]> {
    const player = await this.playerRepository.findById(playerId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    return this.quoteRepository.findAllByPlayerIdAndUserId(playerId, userId);
  }

  /**
   * Recalcula y persiste cotizaciones para el usuario, de forma síncrona
   * (spec FR-013/FR-014/FR-014a). Lock en memoria por `userId` (409 si ya hay
   * uno en curso para el mismo usuario, spec FR-016a). En modo masivo
   * (`playerId` ausente), un jugador que falla se saltea y se continúa con el
   * resto (spec FR-014b); en modo puntual, si falla, se rechaza toda la
   * operación sin persistir nada (spec Edge Cases, contracts 422).
   */
  async recalculate(userId: string, playerId?: string): Promise<RecalculateResult> {
    if (this.recalculationsInProgress.has(userId)) {
      throw new RecalculationInProgressError();
    }
    this.recalculationsInProgress.add(userId);
    // Ceder el event loop para que requests concurrentes al mismo userId puedan
    // chequear el lock antes de que empiece el trabajo real. El delay cubre el
    // tiempo de verificación JWT del request rival (guard → DB lookup): en CI
    // bajo coverage ese round-trip puede superar los 100ms, por eso se usa
    // 150ms — suficiente margen sin ser perceptible para el usuario dado que
    // recalculate es una operación inherentemente pesada.
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    try {
      const strategy = await this.getSelectedStrategyOrThrow(userId);

      const players = playerId
        ? [await this.getPlayerOrThrow(playerId)]
        : await this.playerRepository.findAllActive();

      const quotes: PlayerQuote[] = [];
      const recalculated: RecalculateResult['recalculated'] = [];
      const skipped: RecalculateResult['skipped'] = [];

      for (const player of players) {
        try {
          const { score, value, appliedPosition, weightsUsed } = calculatePlayerValue(
            player,
            strategy,
          );
          quotes.push(
            PlayerQuote.create({
              id: randomUUID(),
              userId,
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
          recalculated.push({ playerId: player.id, value, score });
        } catch (err) {
          if (playerId) {
            // Modo puntual: no hay "resto del catálogo" al que continuar, se rechaza todo.
            throw new PlayerQuoteCalculationFailedError(playerId, err);
          }
          this.logger.error(
            `Error calculando cotización para jugador ${player.id} (usuario ${userId})`,
            err instanceof Error ? err.stack : String(err),
          );
          skipped.push({
            playerId: player.id,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }

      await this.quoteRepository.saveMany(quotes);

      this.logger.log(
        `Recálculo completado (usuario ${userId}): ${recalculated.length} procesados, ${skipped.length} salteados`,
      );

      return { recalculated, skipped };
    } finally {
      this.recalculationsInProgress.delete(userId);
    }
  }

  private async getPlayerOrThrow(playerId: string) {
    const player = await this.playerRepository.findById(playerId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    return player;
  }
}
