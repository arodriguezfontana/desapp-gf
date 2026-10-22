import { AlertCondition } from './alert-condition';
import { InvalidAlertConditionError } from './errors/invalid-alert-condition.error';
import { InvalidAlertThresholdError } from './errors/invalid-alert-threshold.error';

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

/**
 * Alerta de precio de un usuario sobre un jugador puntual
 * (025-player-price-alerts, data-model.md). Compara siempre contra la
 * cotización personal del usuario que la creó (spec FR-010); nunca contra
 * un valor ajeno o de mercado.
 */
export class PriceAlert {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _playerId: string,
    private readonly _condition: AlertCondition,
    private readonly _targetValue: number,
    private readonly _status: AlertStatus,
    private readonly _createdAt: Date,
    private readonly _cancelledAt: Date | null,
  ) {}

  static create(props: {
    id: string;
    userId: string;
    playerId: string;
    condition: AlertCondition;
    targetValue: number;
    createdAt: Date;
  }): PriceAlert {
    PriceAlert.assertValid(props.condition, props.targetValue);
    return new PriceAlert(
      props.id,
      props.userId,
      props.playerId,
      props.condition,
      props.targetValue,
      AlertStatus.ACTIVE,
      props.createdAt,
      null,
    );
  }

  static restore(props: {
    id: string;
    userId: string;
    playerId: string;
    condition: AlertCondition;
    targetValue: number;
    status: AlertStatus;
    createdAt: Date;
    cancelledAt: Date | null;
  }): PriceAlert {
    PriceAlert.assertValid(props.condition, props.targetValue);
    return new PriceAlert(
      props.id,
      props.userId,
      props.playerId,
      props.condition,
      props.targetValue,
      props.status,
      props.createdAt,
      props.cancelledAt,
    );
  }

  private static assertValid(condition: AlertCondition, targetValue: number): void {
    if (!Object.values(AlertCondition).includes(condition)) {
      throw new InvalidAlertConditionError();
    }
    if (typeof targetValue !== 'number' || !Number.isFinite(targetValue) || targetValue <= 0) {
      throw new InvalidAlertThresholdError();
    }
  }

  /** Evalúa si `newValue` cumple la condición de esta alerta, solo si está activa (spec FR-008, FR-009, FR-010). */
  matches(newValue: number): boolean {
    if (this._status !== AlertStatus.ACTIVE) {
      return false;
    }
    return this._condition === AlertCondition.PRICE_BELOW
      ? newValue < this._targetValue
      : newValue > this._targetValue;
  }

  /** Transición ACTIVE → CANCELLED, idempotente (spec FR-006, FR-008). */
  cancel(cancelledAt: Date = new Date()): PriceAlert {
    if (this._status === AlertStatus.CANCELLED) {
      return this;
    }
    return new PriceAlert(
      this._id,
      this._userId,
      this._playerId,
      this._condition,
      this._targetValue,
      AlertStatus.CANCELLED,
      this._createdAt,
      cancelledAt,
    );
  }

  isOwnedBy(userId: string): boolean {
    return this._userId === userId;
  }

  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get playerId(): string { return this._playerId; }
  get condition(): AlertCondition { return this._condition; }
  get targetValue(): number { return this._targetValue; }
  get status(): AlertStatus { return this._status; }
  get createdAt(): Date { return this._createdAt; }
  get cancelledAt(): Date | null { return this._cancelledAt; }
}
