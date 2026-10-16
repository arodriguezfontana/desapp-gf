import { OrderSide } from './order-side';
import { OrderStatus } from './order-status';
import { InvalidOrderQuantityError } from './errors/invalid-order-quantity.error';
import { OrderOverfillError } from './errors/order-overfill.error';

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

  /** Reconstruye una Order ya persistida, con su `remainingQuantity` actual. */
  static restore(props: {
    id: string;
    userId: string;
    playerId: string;
    side: OrderSide;
    quantity: number;
    remainingQuantity: number;
    price: number;
    createdAt: Date;
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
    );
  }

  private static assertValidQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InvalidOrderQuantityError();
    }
  }

  /**
   * Ejecuta un fill de `quantity` sobre esta orden: devuelve una nueva
   * instancia con `remainingQuantity` decrementado. Invariante de ultimo
   * recurso (Principio VI): nunca fillea mas de lo pendiente.
   */
  fill(quantity: number): Order {
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
   * `true` solo si `other` es del lado opuesto, mismo jugador, mismo precio
   * exacto (ambos ya redondeados a 2 decimales) y todavia tiene cantidad
   * pendiente (data-model.md). Unico criterio de compatibilidad del motor de
   * matching (spec DD-001, FR-011).
   */
  isCompatibleWith(other: Order): boolean {
    return (
      other.remainingQuantity > 0 &&
      this._playerId === other.playerId &&
      this._side !== other.side &&
      Order.sameCents(this._price, other.price)
    );
  }

  /** Compara precios al centavo para evitar falsos negativos por imprecision de punto flotante. */
  private static sameCents(a: number, b: number): boolean {
    return Math.round(a * 100) === Math.round(b * 100);
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

  /** Derivado siempre de `remainingQuantity` vs `quantity` (data-model.md). */
  get status(): OrderStatus {
    if (this._remainingQuantity <= 0) {
      return OrderStatus.COMPLETED;
    }
    if (this._remainingQuantity < this._quantity) {
      return OrderStatus.PARTIALLY_FILLED;
    }
    return OrderStatus.PENDING;
  }
}
