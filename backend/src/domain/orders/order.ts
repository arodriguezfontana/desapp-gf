import { OrderSide } from './order-side';
import { OrderStatus } from './order-status';
import { InvalidOrderQuantityError } from './errors/invalid-order-quantity.error';
import { OrderOverfillError } from './errors/order-overfill.error';
import { OrderNotCancellableError } from './errors/order-not-cancellable.error';

/**
 * Entidad de dominio Order (020-order-matching-engine, data-model.md). Sin
 * decoradores de TypeORM ni conocimiento de HTTP o base de datos (constitucion,
 * Principio I). `price` se calcula una unica vez al crearse (nunca lo indica
 * quien publica la orden) y es inmutable (spec DD-003): no existe ningun
 * metodo que lo modifique.
 */
export class Order {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _playerId: string,
    private readonly _side: OrderSide,
    private readonly _quantity: number,
    private readonly _remainingQuantity: number,
    private readonly _price: number,
    private readonly _createdAt: Date,
    private readonly _status?: OrderStatus,
  ) {}

  /** Crea una Order nueva: `remainingQuantity = quantity`, status PENDING (derivado). */
  static create(props: {
    id: string;
    userId: string;
    playerId: string;
    side: OrderSide;
    quantity: number;
    price: number;
    createdAt: Date;
  }): Order {
    Order.assertValidQuantity(props.quantity);
    return new Order(
      props.id,
      props.userId,
      props.playerId,
      props.side,
      props.quantity,
      props.quantity,
      props.price,
      props.createdAt,
    );
  }

  /** Reconstruye una Order ya persistida, con su `remainingQuantity` y `status` actual. */
  static restore(props: {
    id: string;
    userId: string;
    playerId: string;
    side: OrderSide;
    quantity: number;
    remainingQuantity: number;
    price: number;
    createdAt: Date;
    status?: OrderStatus;
  }): Order {
    Order.assertValidQuantity(props.quantity);
    if (props.remainingQuantity < 0 || props.remainingQuantity > props.quantity) {
      throw new OrderOverfillError();
    }
    return new Order(
      props.id,
      props.userId,
      props.playerId,
      props.side,
      props.quantity,
      props.remainingQuantity,
      props.price,
      props.createdAt,
      props.status,
    );
  }

  private static assertValidQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InvalidOrderQuantityError();
    }
  }

  /**
   * Indica si la orden se encuentra en un estado que permite su cancelación
   * (PENDING o PARTIALLY_FILLED).
   */
  get isCancellable(): boolean {
    return this.status === OrderStatus.PENDING || this.status === OrderStatus.PARTIALLY_FILLED;
  }

  /**
   * Cancela la orden retirando el remanente del mercado.
   * Lanza `OrderNotCancellableError` si ya está COMPLETED o CANCELLED.
   */
  cancel(): Order {
    if (!this.isCancellable) {
      throw new OrderNotCancellableError(this.status);
    }
    return new Order(
      this._id,
      this._userId,
      this._playerId,
      this._side,
      this._quantity,
      this._remainingQuantity,
      this._price,
      this._createdAt,
      OrderStatus.CANCELLED,
    );
  }

  /**
   * Ejecuta un fill de `quantity` sobre esta orden: devuelve una nueva
   * instancia con `remainingQuantity` decrementado. Invariante de ultimo
   * recurso (Principio VI): nunca fillea mas de lo pendiente ni sobre ordenes canceladas.
   */
  fill(quantity: number): Order {
    if (this.status === OrderStatus.CANCELLED) {
      throw new OrderNotCancellableError(this.status);
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > this._remainingQuantity) {
      throw new OrderOverfillError();
    }
    return new Order(
      this._id,
      this._userId,
      this._playerId,
      this._side,
      this._quantity,
      this._remainingQuantity - quantity,
      this._price,
      this._createdAt,
    );
  }

  /**
   * `true` si `other` es del lado opuesto, mismo jugador, precio cruzado
   * (precio_BUY >= precio_SELL, ambos en centavos) y todavia tiene cantidad
   * pendiente. Órdenes canceladas quedan automáticamente excluidas.
   */
  isCompatibleWith(other: Order): boolean {
    if (this.status === OrderStatus.CANCELLED || other.status === OrderStatus.CANCELLED) {
      return false;
    }
    if (other.remainingQuantity <= 0) return false;
    if (this._playerId !== other.playerId) return false;
    if (this._side === other.side) return false;
    const buyPrice = this._side === OrderSide.BUY ? this._price : other.price;
    const sellPrice = this._side === OrderSide.SELL ? this._price : other.price;
    return Math.round(buyPrice * 100) >= Math.round(sellPrice * 100);
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

  get side(): OrderSide {
    return this._side;
  }

  get quantity(): number {
    return this._quantity;
  }

  get remainingQuantity(): number {
    return this._remainingQuantity;
  }

  get price(): number {
    return this._price;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get status(): OrderStatus {
    if (this._status === OrderStatus.CANCELLED) {
      return OrderStatus.CANCELLED;
    }
    if (this._remainingQuantity <= 0) {
      return OrderStatus.COMPLETED;
    }
    if (this._remainingQuantity < this._quantity) {
      return OrderStatus.PARTIALLY_FILLED;
    }
    return OrderStatus.PENDING;
  }
}
