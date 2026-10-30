import { OrderSide } from './order-side';
import { OrderStatus } from './order-status';
import { InvalidOrderQuantityError } from './errors/invalid-order-quantity.error';
import { InconsistentOrderStatusError } from './errors/inconsistent-order-status.error';
import { OrderOverfillError } from './errors/order-overfill.error';
import { OrderNotCancellableError } from './errors/order-not-cancellable.error';

/**
 * Entidad de dominio Order (020-order-matching-engine, data-model.md). Sin
 * decoradores de TypeORM ni conocimiento de HTTP o base de datos (constitucion,
 * Principio I). `price` se calcula una unica vez al crearse (nunca lo indica
 * quien publica la orden) y es inmutable (spec DD-003): no existe ningun
 * metodo que lo modifique.
 */
/** Estado completo de una Order; `cancelled` es lo unico del estado que se almacena (el resto se deriva). */
interface OrderState {
  readonly id: string;
  readonly userId: string;
  readonly playerId: string;
  readonly side: OrderSide;
  readonly quantity: number;
  readonly remainingQuantity: number;
  readonly price: number;
  readonly createdAt: Date;
  readonly cancelled: boolean;
}

export class Order {
  private constructor(private readonly state: OrderState) {}

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
    return new Order({
      id: props.id,
      userId: props.userId,
      playerId: props.playerId,
      side: props.side,
      quantity: props.quantity,
      remainingQuantity: props.quantity,
      price: props.price,
      createdAt: props.createdAt,
      cancelled: false,
    });
  }

  /**
   * Reconstruye una Order ya persistida, con su `remainingQuantity` y `status` actual.
   * Solo `CANCELLED` se almacena; cualquier otro `status` se deriva de la cantidad
   * pendiente, y si se informa debe coincidir con el derivado.
   * @throws InconsistentOrderStatusError si `status` contradice `remainingQuantity`.
   */
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
    const cancelled = props.status === OrderStatus.CANCELLED;
    if (props.status !== undefined && !cancelled) {
      Order.assertStatusMatchesRemaining(props.status, props.quantity, props.remainingQuantity);
    }
    return new Order({
      id: props.id,
      userId: props.userId,
      playerId: props.playerId,
      side: props.side,
      quantity: props.quantity,
      remainingQuantity: props.remainingQuantity,
      price: props.price,
      createdAt: props.createdAt,
      cancelled,
    });
  }

  /**
   * Crea una Order historica o de simulacion ya en un estado intermedio o
   * final (parcial, completada, cancelada) y con fecha pasada, sin ejecutar el
   * matching. Es para sembrar datos de demo, no para ordenes reales (esas
   * nacen con `create`); valida los mismos invariantes que `restore`.
   */
  static seed(props: Parameters<typeof Order.restore>[0]): Order {
    return Order.restore(props);
  }

  /** Un estado distinto de CANCELLED debe coincidir con el que se deriva de la cantidad pendiente. */
  private static assertStatusMatchesRemaining(status: OrderStatus, quantity: number, remainingQuantity: number): void {
    if (status !== Order.deriveStatus(quantity, remainingQuantity)) {
      throw new InconsistentOrderStatusError();
    }
  }

  private static deriveStatus(quantity: number, remainingQuantity: number): OrderStatus {
    if (remainingQuantity <= 0) {
      return OrderStatus.COMPLETED;
    }
    return remainingQuantity < quantity ? OrderStatus.PARTIALLY_FILLED : OrderStatus.PENDING;
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
    return new Order({ ...this.state, cancelled: true });
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
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > this.state.remainingQuantity) {
      throw new OrderOverfillError();
    }
    return new Order({ ...this.state, remainingQuantity: this.state.remainingQuantity - quantity });
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
    if (this.state.playerId !== other.playerId) return false;
    if (this.state.side === other.side) return false;
    const buyPrice = this.state.side === OrderSide.BUY ? this.state.price : other.price;
    const sellPrice = this.state.side === OrderSide.SELL ? this.state.price : other.price;
    return Math.round(buyPrice * 100) >= Math.round(sellPrice * 100);
  }

  get id(): string {
    return this.state.id;
  }

  get userId(): string {
    return this.state.userId;
  }

  get playerId(): string {
    return this.state.playerId;
  }

  get side(): OrderSide {
    return this.state.side;
  }

  get quantity(): number {
    return this.state.quantity;
  }

  get remainingQuantity(): number {
    return this.state.remainingQuantity;
  }

  get price(): number {
    return this.state.price;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get status(): OrderStatus {
    return this.state.cancelled ? OrderStatus.CANCELLED : Order.deriveStatus(this.state.quantity, this.state.remainingQuantity);
  }
}
