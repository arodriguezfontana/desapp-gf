import { PriceAlert } from '../../domain/alerts/price-alert';

/**
 * Puerto de dominio para la persistencia de PriceAlert (025-player-price-alerts).
 * Recibe y devuelve objetos de dominio; el Service nunca ve la entidad de
 * TypeORM. Token: PRICE_ALERT_REPOSITORY.
 */
export interface PriceAlertRepository {
  save(alert: PriceAlert): Promise<PriceAlert>;
  findById(id: string): Promise<PriceAlert | null>;

  /** Alertas ACTIVE del usuario sobre ese jugador, evaluadas en cada recálculo (spec FR-011). */
  findActiveByUserIdAndPlayerId(userId: string, playerId: string): Promise<PriceAlert[]>;

  /** Todas las alertas propias del usuario (activas y canceladas), para su listado (spec FR-005). */
  findAllByUserId(userId: string): Promise<PriceAlert[]>;
}
