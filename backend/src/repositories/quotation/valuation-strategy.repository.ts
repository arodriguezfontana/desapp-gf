import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';

/**
 * Puerto de dominio para la persistencia de ValuationStrategy.
 * Recibe y devuelve objetos de dominio; el Service nunca ve la entidad de TypeORM.
 * Token: VALUATION_STRATEGY_REPOSITORY (modules/quotation/quotation.constants.ts).
 *
 * Toda estrategia pertenece a exactamente un usuario
 * (019-per-user-valuation-strategies, spec FR-001/FR-003): ya no existe el
 * concepto de "estrategia activa de sistema" ni `findActive`/`activateStrategy`
 * globales de 012-valuation-strategies.
 */
export interface ValuationStrategyRepository {
  /** Las dos estrategias propias de `userId`, en el orden en que se crearon. */
  findByUserId(userId: string): Promise<ValuationStrategy[]>;
  findByIdAndUserId(id: string, userId: string): Promise<ValuationStrategy | null>;
  findById(id: string): Promise<ValuationStrategy | null>;
  save(strategy: ValuationStrategy): Promise<ValuationStrategy>;
  saveMany(strategies: ValuationStrategy[]): Promise<ValuationStrategy[]>;
  /**
   * Desmarca la estrategia seleccionada previa del usuario y marca la indicada,
   * en una única transacción. Lanza StrategyNotFoundError si `id` no existe o
   * no pertenece a `userId`.
   */
  selectStrategy(userId: string, id: string): Promise<ValuationStrategy>;
  /** Todos los userIds distintos que tienen al menos una estrategia registrada. */
  findAllUserIds(): Promise<string[]>;
}
