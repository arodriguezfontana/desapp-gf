import { MovementSnapshot } from '../portfolio/token-holding';
import { Fill } from './match-order';
import { TokenTransactionType } from './enums/token-transaction-type';

/**
 * Entidad de dominio TokenTransaction (020-order-matching-engine,
 * data-model.md). Es en si misma el asiento de auditoria append-only exigido
 * por la constitucion (Principio V): autor (`userId`), timestamp
 * (`createdAt`) y el detalle del cambio como campos propios (`playerId`,
 * `quantity`, `price`, `orderId`, `counterpartOrderId`). Inmutable tras
 * creacion — deliberadamente sin ningun metodo de edicion ni borrado.
 *
 * 030-token-balance-snapshot: ademas guarda el saldo de la tenencia (usuario,
 * jugador) justo antes y despues del movimiento (`balanceBefore`/`balanceAfter`),
 * capturado al aplicarlo. Son obligatorios en todo asiento (los anteriores a esa feature se
 * completaron con el backfill). Un asiento sin orden (`orderId` nulo) es la
 * emision inicial de tokens: no nace de ninguna orden ni tiene contraparte.
 */
export class TokenTransaction {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _type: TokenTransactionType,
    private readonly _playerId: string,
    private readonly _quantity: number,
    private readonly _price: number,
    private readonly _orderId: string | null,
    private readonly _counterpartOrderId: string | null,
    private readonly _createdAt: Date,
    private readonly _balanceBefore: number,
    private readonly _balanceAfter: number,
  ) {}

  static create(props: {
    id: string;
    userId: string;
    type: TokenTransactionType;
    playerId: string;
    quantity: number;
    price: number;
    orderId: string | null;
    counterpartOrderId: string | null;
    createdAt: Date;
    balanceBefore: number;
    balanceAfter: number;
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
      props.balanceBefore,
      props.balanceAfter,
    );
  }

  /**
   * Asientos de auditoria de un fill (Principio V): CREDIT para el comprador y
   * DEBIT para el vendedor, cada uno apuntando a la orden contraparte.
   * `newId` se inyecta para mantener el dominio sin dependencias de infraestructura.
   * `snapshot` (030-token-balance-snapshot) trae el saldo antes/despues de cada parte, capturado
   * por `settleFillsAudited`.
   */
  static pairFromFill(
    fill: Fill,
    playerId: string,
    createdAt: Date,
    newId: () => string,
    snapshot: { buyer: MovementSnapshot; seller: MovementSnapshot },
  ): TokenTransaction[] {
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
        balanceBefore: snapshot.buyer.before,
        balanceAfter: snapshot.buyer.after,
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
        balanceBefore: snapshot.seller.before,
        balanceAfter: snapshot.seller.after,
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

  get orderId(): string | null {
    return this._orderId;
  }

  get counterpartOrderId(): string | null {
    return this._counterpartOrderId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /** Saldo de la tenencia justo antes del movimiento. */
  get balanceBefore(): number {
    return this._balanceBefore;
  }

  /** Saldo de la tenencia justo despues del movimiento. */
  get balanceAfter(): number {
    return this._balanceAfter;
  }

  /** La emision inicial de tokens no nace de ninguna orden. */
  get isEmission(): boolean {
    return this._orderId === null;
  }
}
