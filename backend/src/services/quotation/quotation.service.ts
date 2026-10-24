import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { calculatePlayerValue } from '../../domain/quotation/calculate-player-value';
import { QuoteRecalculatedEvent, QUOTE_RECALCULATED_EVENT } from '../../domain/alerts/events/quote-recalculated.event';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { Position } from '../../domain/player/enums/position';
import { StrategyNotFoundError } from '../../domain/quotation/errors/strategy-not-found.error';
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
  recalculated: Array<{ userId: string; playerId: string; value: number; score: number }>;
  skipped: Array<{ userId: string; playerId: string; reason: string }>;
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
 * recálculo manual de cotizaciones (019-per-user-valuation-strategies,
 * reemplaza el modelo de estrategia única de sistema de
 * 012-valuation-strategies).
 *
 * El lock de recálculo es en memoria a nivel sistema: solo puede haber un
 * recálculo global corriendo a la vez (409 si ya hay uno en curso).
 */
@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);
  private recalculationInProgress = false;

  constructor(
    @Inject(VALUATION_STRATEGY_REPOSITORY)
    private readonly strategyRepository: ValuationStrategyRepository,
    @Inject(PLAYER_QUOTE_REPOSITORY)
    private readonly quoteRepository: PlayerQuoteRepository,
    @Inject(PLAYER_REPOSITORY)
    private readonly playerRepository: PlayerRepository,
    private readonly eventEmitter: EventEmitter2,
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

  private processUserPlayers(
    userId: string,
    strategy: ValuationStrategy,
    players: Awaited<ReturnType<PlayerRepository['findAllActive']>>,
    quotes: PlayerQuote[],
    recalculated: RecalculateResult['recalculated'],
    skipped: RecalculateResult['skipped'],
  ): void {
    for (const player of players) {
      try {
        const { score, value, appliedPosition, weightsUsed } = calculatePlayerValue(player, strategy);
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
        recalculated.push({ userId, playerId: player.id, value, score });
      } catch (err) {
        this.logger.error(
          `Error calculando cotización para jugador ${player.id} (usuario ${userId})`,
          err instanceof Error ? err.stack : String(err),
        );
        skipped.push({
          userId,
          playerId: player.id,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
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
   * Recalcula y persiste cotizaciones para cada combinación (usuario, jugador)
   * del sistema, usando la estrategia seleccionada de cada usuario en ese
   * momento. Solo el admin puede dispararlo (AdminApiKeyGuard en el controller).
   * Lock a nivel sistema (409 si ya hay un recálculo global en curso). Las
   * combinaciones que fallan se saltean; la respuesta indica qué se procesó y
   * qué se salteó.
   */
  async recalculateAll(): Promise<RecalculateResult> {
    if (this.recalculationInProgress) {
      throw new RecalculationInProgressError();
    }
    this.recalculationInProgress = true;

    try {
      const userIds = await this.strategyRepository.findAllUserIds();
      const players = await this.playerRepository.findAllActive();

      const quotes: PlayerQuote[] = [];
      const recalculated: RecalculateResult['recalculated'] = [];
      const skipped: RecalculateResult['skipped'] = [];

      for (const userId of userIds) {
        const strategies = await this.strategyRepository.findByUserId(userId);
        const strategy = strategies.find((s) => s.isSelected);
        if (!strategy) {
          skipped.push(...players.map((p) => ({
            userId,
            playerId: p.id,
            reason: 'Sin estrategia seleccionada',
          })));
          continue;
        }
        this.processUserPlayers(userId, strategy, players, quotes, recalculated, skipped);
      }

      await this.quoteRepository.saveMany(quotes);

      // Emite quote.recalculated una vez por cada PlayerQuote efectivamente
      // persistida (nunca por las salteadas en `skipped`), para que el
      // módulo de alertas evalúe sus alertas activas sin que este Service
      // lo conozca (025-player-price-alerts, spec FR-011, FR-021).
      // emitAsync (no emit): espera a que los listeners async (evaluación de
      // alertas, persistencia de notificación, envío de mail) terminen antes
      // de resolver, para que la notificación ya esté visible al terminar
      // este mismo recálculo (spec SC-003). No afecta la independencia entre
      // los listeners de alert.triggered entre sí (FR-021): cada uno sigue
      // corriendo su propia lógica sin conocer al otro, solo se espera a que
      // ambos conjuntos de listeners terminen antes de responder.
      for (const quote of quotes) {
        await this.eventEmitter.emitAsync(
          QUOTE_RECALCULATED_EVENT,
          new QuoteRecalculatedEvent(quote.userId, quote.playerId, quote.value, quote.calculatedAt),
        );
      }

      this.logger.log(
        `Recálculo global completado: ${recalculated.length} procesados, ${skipped.length} salteados`,
      );

      return { recalculated, skipped };
    } finally {
      this.recalculationInProgress = false;
    }
  }
}
