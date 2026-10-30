import { Injectable } from '@nestjs/common';
import { Position } from '../../domain/player/enums/position';
import { StrategyNotFoundError } from '../../domain/quotation/errors/strategy-not-found.error';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';

/**
 * Operaciones sobre las dos estrategias de valuación propias de cada usuario
 * (019-per-user-valuation-strategies, reemplaza el modelo de estrategia única
 * de sistema de 012-valuation-strategies): listar, seleccionar y editar pesos.
 * El cálculo y el recálculo de cotizaciones viven en `QuotationService`, que
 * usa este service para resolver qué estrategia aplicar.
 */
@Injectable()
export class StrategyService {
  constructor(private readonly strategyRepository: ValuationStrategyRepository) {}

  /** Las dos estrategias propias del usuario. */
  async listStrategies(userId: string): Promise<ValuationStrategy[]> {
    return this.strategyRepository.findByUserId(userId);
  }

  /** @throws StrategyNotFoundError si no existe; StrategyOwnershipError si es de otro usuario. */
  async getOwnedStrategyOrThrow(id: string, userId: string): Promise<ValuationStrategy> {
    const strategy = await this.strategyRepository.findById(id);
    if (!strategy) {
      throw new StrategyNotFoundError(id);
    }
    strategy.assertOwnedBy(userId);
    return strategy;
  }

  /** @throws StrategyNotFoundError si el usuario no tiene ninguna estrategia seleccionada. */
  async getSelectedStrategyOrThrow(userId: string): Promise<ValuationStrategy> {
    const strategies = await this.strategyRepository.findByUserId(userId);
    const selected = strategies.find((s) => s.isSelected);
    if (!selected) {
      throw new StrategyNotFoundError(userId);
    }
    return selected;
  }

  /** Marca `strategyId` como seleccionada, desmarcando la otra del mismo usuario */
  async selectStrategy(userId: string, strategyId: string): Promise<ValuationStrategy> {
    await this.getOwnedStrategyOrThrow(strategyId, userId);
    return this.strategyRepository.selectStrategy(userId, strategyId);
  }

  /** Reemplazo completo de los pesos generales de una estrategia propia. */
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
}
