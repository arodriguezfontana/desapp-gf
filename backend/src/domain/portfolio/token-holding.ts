import { randomUUID } from 'node:crypto';
import { InsufficientHoldingError } from './errors/insufficient-holding.error';

/**
 * Saldo de una tenencia justo antes y justo después de aplicar un movimiento
 * (030-token-balance-snapshot). Se captura en la misma operación que cambia el saldo; no se
 * recalcula después a partir del historial.
 */
export interface MovementSnapshot {
  before: number;
  after: number;
}

/**
 * Entidad de dominio TokenHolding (020-order-matching-engine, data-model.md —
 * construye desde cero la infraestructura de 017-buy-tokens, ver research.md D7).
 * Cantidad de tokens que un usuario posee de un jugador determinado. Existe
 * como maximo un TokenHolding por par (userId, playerId): un credito/debito
 * es un upsert sobre esa fila, nunca una fila nueva. `id` es un identificador
 * surrogate propio (data-model.md); la identidad de negocio real es
 * (userId, playerId).
 */
export class TokenHolding {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _playerId: string,
    private readonly _quantity: number,
    private readonly _updatedAt: Date,
  ) {}

  /** Holding inicial en 0 (bootstrap de un par (userId, playerId) nuevo). */
  static createEmpty(userId: string, playerId: string): TokenHolding {
    return new TokenHolding(randomUUID(), userId, playerId, 0, new Date());
  }

  /** Reconstruye un holding ya persistido. */
  static restore(props: {
    id: string;
    userId: string;
    playerId: string;
    quantity: number;
    updatedAt: Date;
  }): TokenHolding {
    if (props.quantity < 0) {
      throw new InsufficientHoldingError();
    }
    return new TokenHolding(props.id, props.userId, props.playerId, props.quantity, props.updatedAt);
  }

  /**
   * Devuelve una nueva instancia con `quantity` fijada en un valor absoluto
   * (siembra idempotente de datos de simulacion), conservando la identidad.
   * @throws InsufficientHoldingError si `quantity` es negativa o no entera.
   */
  withQuantity(quantity: number): TokenHolding {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new InsufficientHoldingError();
    }
    return new TokenHolding(this._id, this._userId, this._playerId, quantity, new Date());
  }

  /**
   * Regla de venta (spec FR-010): los tokens ya comprometidos en ordenes SELL
   * pendientes no se pueden volver a ofrecer. `holding` es `null` si el usuario
   * nunca tuvo tokens de ese jugador.
   * @throws InsufficientHoldingError si `quantity + pendingSellQuantity` supera lo que posee.
   */
  static assertCanSell(holding: TokenHolding | null, quantity: number, pendingSellQuantity: number): void {
    if ((holding?.quantity ?? 0) < quantity + pendingSellQuantity) {
      throw new InsufficientHoldingError();
    }
  }

  /** Devuelve una nueva instancia con `quantity` incrementada. */
  credit(quantity: number): TokenHolding {
    return this.applyCredit(quantity).holding;
  }

  /**
   * Igual que `credit`, pero devuelve además el saldo antes y después del movimiento
   * (030-token-balance-snapshot): ambos valores salen de la misma operación que cambia el saldo.
   */
  applyCredit(quantity: number): { holding: TokenHolding; snapshot: MovementSnapshot } {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InsufficientHoldingError();
    }
    const holding = new TokenHolding(this._id, this._userId, this._playerId, this._quantity + quantity, new Date());
    return { holding, snapshot: { before: this._quantity, after: holding.quantity } };
  }

  /**
   * Devuelve una nueva instancia con `quantity` decrementada.
   * @throws InsufficientHoldingError si el resultado quedaría negativo —
   * invariante de ultimo recurso del dominio (Principio VI); en el flujo
   * normal esto ya se validó antes de llegar acá (spec FR-010).
   */
  debit(quantity: number): TokenHolding {
    return this.applyDebit(quantity).holding;
  }

  /**
   * Igual que `debit`, pero devuelve además el saldo antes y después del movimiento
   * (030-token-balance-snapshot).
   * @throws InsufficientHoldingError si el resultado quedaría negativo.
   */
  applyDebit(quantity: number): { holding: TokenHolding; snapshot: MovementSnapshot } {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InsufficientHoldingError();
    }
    const next = this._quantity - quantity;
    if (next < 0) {
      throw new InsufficientHoldingError();
    }
    const holding = new TokenHolding(this._id, this._userId, this._playerId, next, new Date());
    return { holding, snapshot: { before: this._quantity, after: next } };
  }

  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get playerId(): string {
    return this._playerId;
  }

  get quantity(): number {
    return this._quantity;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
