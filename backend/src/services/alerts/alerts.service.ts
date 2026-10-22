import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PriceAlertRepository } from '../../repositories/alerts/price-alert.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import { PriceAlert } from '../../domain/alerts/price-alert';
import { AlertNotFoundError } from '../../domain/alerts/errors/alert-not-found.error';
import { DuplicateAlertError } from '../../domain/alerts/errors/duplicate-alert.error';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';
import { PRICE_ALERT_REPOSITORY } from '../../modules/alerts/alerts.constants';
import { PLAYER_REPOSITORY } from '../../modules/player/player.constants';

/**
 * Orquesta la creación, consulta y cancelación de alertas de precio
 * (025-player-price-alerts, Historias 1 y 2). La evaluación de alertas
 * contra cotizaciones nuevas vive en QuoteRecalculatedListener, no acá.
 */
@Injectable()
export class AlertsService {
  constructor(
    @Inject(PRICE_ALERT_REPOSITORY) private readonly alerts: PriceAlertRepository,
    @Inject(PLAYER_REPOSITORY) private readonly players: PlayerRepository,
  ) {}

  /** Crea una alerta de precio propia sobre un jugador existente (spec FR-001..FR-004). */
  async create(
    userId: string,
    playerId: string,
    condition: AlertCondition,
    targetValue: number,
  ): Promise<PriceAlert> {
    const player = await this.players.findById(playerId);
    if (!player) {
      throw new PlayerNotFoundError();
    }

    const activeAlerts = await this.alerts.findActiveByUserIdAndPlayerId(userId, playerId);
    const isDuplicate = activeAlerts.some(
      (existing) => existing.condition === condition && existing.targetValue === targetValue,
    );
    if (isDuplicate) {
      throw new DuplicateAlertError();
    }

    const alert = PriceAlert.create({
      id: randomUUID(),
      userId,
      playerId,
      condition,
      targetValue,
      createdAt: new Date(),
    });

    return this.alerts.save(alert);
  }

  /** Alertas propias del usuario, activas y canceladas (spec FR-005). */
  async listOwn(userId: string): Promise<PriceAlert[]> {
    return this.alerts.findAllByUserId(userId);
  }

  /** Cancela una alerta propia; 404 si no existe o no pertenece al usuario (spec FR-006, FR-007, FR-008). */
  async cancel(userId: string, alertId: string): Promise<PriceAlert> {
    const alert = await this.getOwnedAlertOrThrow(alertId, userId);
    return this.alerts.save(alert.cancel());
  }

  private async getOwnedAlertOrThrow(alertId: string, userId: string): Promise<PriceAlert> {
    const alert = await this.alerts.findById(alertId);
    if (!alert || !alert.isOwnedBy(userId)) {
      throw new AlertNotFoundError();
    }
    return alert;
  }
}
