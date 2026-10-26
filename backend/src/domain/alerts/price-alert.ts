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
interface PriceAlertState {
  readonly id: string;
  readonly userId: string;
  readonly playerId: string;
  readonly condition: AlertCondition;
  readonly targetValue: number;
  readonly status: AlertStatus;
  readonly createdAt: Date;
  readonly cancelledAt: Date | null;
}

export class PriceAlert {
  private constructor(private readonly state: PriceAlertState) {}

  static create(props: {
    id: string;
    userId: string;
    playerId: string;
    condition: AlertCondition;
    targetValue: number;
    createdAt: Date;
  }): PriceAlert {
    PriceAlert.assertValid(props.condition, props.targetValue);
    return new PriceAlert({ ...props, status: AlertStatus.ACTIVE, cancelledAt: null });
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
    return new PriceAlert({ ...props });
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
    if (this.state.status !== AlertStatus.ACTIVE) {
      return false;
    }
    return this.state.condition === AlertCondition.PRICE_BELOW
      ? newValue < this.state.targetValue
      : newValue > this.state.targetValue;
  }

  /** Transición ACTIVE → CANCELLED, idempotente (spec FR-006, FR-008). */
  cancel(cancelledAt: Date = new Date()): PriceAlert {
    if (this.state.status === AlertStatus.CANCELLED) {
      return this;
    }
    return new PriceAlert({ ...this.state, status: AlertStatus.CANCELLED, cancelledAt });
  }

  isOwnedBy(userId: string): boolean {
    return this.state.userId === userId;
  }

  get id(): string { return this.state.id; }
  get userId(): string { return this.state.userId; }
  get playerId(): string { return this.state.playerId; }
  get condition(): AlertCondition { return this.state.condition; }
  get targetValue(): number { return this.state.targetValue; }
  get status(): AlertStatus { return this.state.status; }
  get createdAt(): Date { return this.state.createdAt; }
  get cancelledAt(): Date | null { return this.state.cancelledAt; }
}
