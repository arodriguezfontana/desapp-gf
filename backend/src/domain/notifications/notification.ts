import { AlertCondition } from '../alerts/alert-condition';

/**
 * Aviso generado por el disparo de una PriceAlert puntual
 * (025-player-price-alerts, data-model.md). `condition` y `triggeredValue`
 * se denormalizan desde la alerta al momento del disparo: un cambio futuro
 * en la alerta no afecta notificaciones ya emitidas.
 */
export class Notification {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _alertId: string,
    private readonly _playerId: string,
    private readonly _condition: AlertCondition,
    private readonly _triggeredValue: number,
    private readonly _createdAt: Date,
    private readonly _read: boolean,
  ) {}

  static create(props: {
    id: string;
    userId: string;
    alertId: string;
    playerId: string;
    condition: AlertCondition;
    triggeredValue: number;
    createdAt: Date;
  }): Notification {
    return new Notification(
      props.id,
      props.userId,
      props.alertId,
      props.playerId,
      props.condition,
      props.triggeredValue,
      props.createdAt,
      false,
    );
  }

  static restore(props: {
    id: string;
    userId: string;
    alertId: string;
    playerId: string;
    condition: AlertCondition;
    triggeredValue: number;
    createdAt: Date;
    read: boolean;
  }): Notification {
    return new Notification(
      props.id,
      props.userId,
      props.alertId,
      props.playerId,
      props.condition,
      props.triggeredValue,
      props.createdAt,
      props.read,
    );
  }

  /** Transición unread → read, idempotente (spec FR-016). Sin vuelta a unread. */
  markAsRead(): Notification {
    if (this._read) {
      return this;
    }
    return new Notification(
      this._id,
      this._userId,
      this._alertId,
      this._playerId,
      this._condition,
      this._triggeredValue,
      this._createdAt,
      true,
    );
  }

  isOwnedBy(userId: string): boolean {
    return this._userId === userId;
  }

  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get alertId(): string { return this._alertId; }
  get playerId(): string { return this._playerId; }
  get condition(): AlertCondition { return this._condition; }
  get triggeredValue(): number { return this._triggeredValue; }
  get createdAt(): Date { return this._createdAt; }
  get read(): boolean { return this._read; }
}
