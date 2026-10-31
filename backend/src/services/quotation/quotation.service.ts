import { Inject, Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../adapters/runtime/clock';
import { IdGenerator } from '../../adapters/runtime/id-generator';
import { CLOCK, ID_GENERATOR } from '../../modules/runtime/runtime.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { calculatePlayerValue } from '../../domain/quotation/calculate-player-value';
import { QuoteRecalculatedEvent, QUOTE_RECALCULATED_EVENT } from '../../domain/alerts/events/quote-recalculated.event';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { Position } from '../../domain/player/enums/position';
import { RecalculationInProgressError } from '../../domain/quotation/errors/recalculation-in-progress.error';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import { PlayerQuoteRepository } from '../../repositories/quotation/player-quote.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';
import { StrategyService } from './strategy.service';

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
 * Domingos a las 03:00. Los jobs de sincronización de jugadores y de partidos
 * corren los domingos a las 00:00 (`CronExpression.EVERY_WEEK`); el recálculo
 * va unas horas después para valuar con las métricas ya sincronizadas y no
 * con las de la semana anterior.
 */
export const QUOTATION_RECALCULATION_CRON = '0 3 * * 0';

/**
 * Orquesta el cálculo de cotizaciones: valuación puntual, recálculo global
 * manual (admin) o semanal con `@Cron`, e historial de cotizaciones
 * (019-per-user-valuation-strategies, reemplaza el modelo de estrategia única
 * de sistema de 012-valuation-strategies). Las operaciones sobre las
 * estrategias del usuario viven en `StrategyService`.
 *
 * El lock de recálculo es en memoria a nivel sistema: solo puede haber un
 * recálculo global corriendo a la vez (409 si ya hay uno en curso).
 */
@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);
  private recalculationInProgress = false;

  constructor(
    private readonly strategyRepository: ValuationStrategyRepository,
    private readonly quoteRepository: PlayerQuoteRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly strategies: StrategyService,
  ) {}

  /**
   * Calcula al vuelo el valor de un jugador, sin persistir nada.
   * Sin `strategyId`, usa la estrategia seleccionada del usuario; con
   * `strategyId`, usa esa estrategia puntual si pertenece al usuario.
   */
  async valuate(userId: string, playerId: string, strategyId?: string): Promise<ValuationResult> {
    const player = await this.playerRepository.findById(playerId);
    if (!player) {
      throw new PlayerNotFoundError();
    }

    const strategy = strategyId
      ? await this.strategies.getOwnedStrategyOrThrow(strategyId, userId)
      : await this.strategies.getSelectedStrategyOrThrow(userId);

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
            id: this.ids.generate(),
            userId,
            playerId: player.id,
            strategyId: strategy.id,
            weightSnapshot: weightsUsed,
            factorEscalaSnapshot: strategy.factorEscala,
            score,
            value,
            calculatedAt: this.clock.now(),
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

      const strategiesByUser = await Promise.all(
        userIds.map((userId) => this.strategyRepository.findByUserId(userId)),
      );

      for (const [index, userId] of userIds.entries()) {
        const strategy = strategiesByUser[index].find((s) => s.isSelected);
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
      // módulo de alertas evalúe sus alertas activas sin que este Service lo conozca.
      // emitAsync (no emit): espera a que los listeners async (evaluación de
      // alertas y persistencia de la notificación) terminen antes de resolver,
      // para que la notificación ya esté visible al terminar este mismo recálculo.
      await Promise.all(
        quotes.map((quote) =>
          this.eventEmitter.emitAsync(
            QUOTE_RECALCULATED_EVENT,
            new QuoteRecalculatedEvent(quote.userId, quote.playerId, quote.value, quote.calculatedAt),
          ),
        ),
      );

      this.logger.log(
        `Recálculo global completado: ${recalculated.length} procesados, ${skipped.length} salteados`,
      );

      return { recalculated, skipped };
    } finally {
      this.recalculationInProgress = false;
    }
  }

  /**
   * Recálculo semanal automático. `waitForCompletion: true`: evita
   * que el scheduler dispare una corrida nueva mientras la anterior sigue
   * corriendo. Si el lock ya está tomado (p. ej. un recálculo manual de un
   * administrador), se salta esta ejecución y loguea una advertencia, igual que
   * los crons de sincronización de jugadores y de partidos. Un error inesperado
   * se registra en el log y no se propaga al scheduler.
   */
  @Cron(QUOTATION_RECALCULATION_CRON, { waitForCompletion: true })
  async handleCron(): Promise<void> {
    if (this.recalculationInProgress) {
      this.logger.warn(
        'El @Cron de recálculo de cotizaciones se salta porque ya hay un recálculo en curso (spec 019, FR-016).',
      );
      return;
    }
    try {
      this.logger.log('Iniciando el recálculo semanal de cotizaciones...');
      const result = await this.recalculateAll();
      this.logger.log(
        `Recálculo semanal completado: ${result.recalculated.length} cotizaciones, ${result.skipped.length} salteadas.`,
      );
    } catch (error) {
      this.logger.error(
        'El recálculo semanal de cotizaciones falló con un error inesperado.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
