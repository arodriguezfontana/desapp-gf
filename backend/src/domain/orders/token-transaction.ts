import { Fill } from './match-order';
import { TokenTransactionType } from './token-transaction-type';

/**
 * Entidad de dominio TokenTransaction (020-order-matching-engine,
 * data-model.md). Es en si misma el asiento de auditoria append-only exigido
 * por la constitucion (Principio V): autor (`userId`), timestamp
 * (`createdAt`) y el detalle del cambio como campos propios (`playerId`,
 * `quantity`, `price`, `orderId`, `counterpartOrderId`). Inmutable tras
 * creacion — deliberadamente sin ningun metodo de edicion ni borrado.
 */
export class TokenTransaction {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _type: TokenTransactionType,
    private readonly _playerId: string,
    private readonly _quantity: number,
    private readonly _price: number,
    private readonly _orderId: string,
    private readonly _counterpartOrderId: string,
    private readonly _createdAt: Date,
  ) {}

  static create(props: {
    id: string;
    userId: string;
    type: TokenTransactionType;
    playerId: string;
    quantity: number;
    price: number;
    orderId: string;
    counterpartOrderId: string;
    createdAt: Date;
  }): TokenTransaction {
    return new TokenTransaction(
      props.id,
      props.userId,
      props.type,
      props.playerId,
      props.quantity,
      props.price,
      props.orderId,
      props.counterpartOrderId,
      props.createdAt,
    );
  }

  /**
   * Asientos de auditoria de un fill (Principio V): CREDIT para el comprador y
   * DEBIT para el vendedor, cada uno apuntando a la orden contraparte.
   * `newId` se inyecta para mantener el dominio sin dependencias de infraestructura.
   */
  static pairFromFill(fill: Fill, playerId: string, createdAt: Date, newId: () => string): TokenTransaction[] {
    return [
      TokenTransaction.create({
        id: newId(),
        userId: fill.buyerUserId,
        type: TokenTransactionType.CREDIT,
        playerId,
        quantity: fill.quantity,
        price: fill.price,
        orderId: fill.buyOrderId,
        counterpartOrderId: fill.sellOrderId,
        createdAt,
      }),
      TokenTransaction.create({
        id: newId(),
        userId: fill.sellerUserId,
        type: TokenTransactionType.DEBIT,
        playerId,
        quantity: fill.quantity,
        price: fill.price,
        orderId: fill.sellOrderId,
        counterpartOrderId: fill.buyOrderId,
        createdAt,
      }),
    ];
  }

  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get type(): TokenTransactionType {
    return this._type;
  }

  get playerId(): string {
    return this._playerId;
  }

  get quantity(): number {
    return this._quantity;
  }

  get price(): number {
    return this._price;
  }

  get orderId(): string {
    return this._orderId;
  }

  get counterpartOrderId(): string {
    return this._counterpartOrderId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}
