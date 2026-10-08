import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';

/**
 * Puerto de dominio para la persistencia de ValuationStrategy.
 * Recibe y devuelve objetos de dominio; el Service nunca ve la entidad de TypeORM.
 * Token: VALUATION_STRATEGY_REPOSITORY (modules/quotation/quotation.constants.ts).
 */
export interface ValuationStrategyRepository {
  findActive(): Promise<ValuationStrategy | null>;
  findById(id: string): Promise<ValuationStrategy | null>;
  save(strategy: ValuationStrategy): Promise<ValuationStrategy>;
  /**
   * Desactiva todas las estrategias y activa la indicada en una única transacción.
   * Lanza StrategyNotFoundError si el id no existe.
   */
  activateStrategy(id: string): Promise<ValuationStrategy>;
}
