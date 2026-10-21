/**
 * Representa un nivel consolidado de oferta o demanda en el mercado para un precio específico.
 * (024-player-order-book, spec FR-006, data-model.md)
 */
export interface PriceLevel {
  /** Precio unitario positivo de la postura monetaria, con precisión a 2 decimales. */
  readonly price: number;
  /** Cantidad total acumulada de tokens disponibles en este nivel (integer mayor a 0). */
  readonly totalQuantity: number;
}

/**
 * Agregado de dominio que modela la instantánea del libro de órdenes de un jugador
 * en un momento determinado (Order Book Level 2, 024-player-order-book).
 *
 * Mantiene la oferta (asks) y demanda (bids) consolidada por nivel de precio,
 * ordenadas de forma canónica (bids DESC, asks ASC) y sin exponer identidades
 * de compradores ni vendedores (spec FR-007, FR-008).
 */
export class OrderBook {
  constructor(
    private readonly _playerId: string,
    private readonly _bids: readonly PriceLevel[],
    private readonly _asks: readonly PriceLevel[],
  ) {}

  /**
   * Crea una instancia de libro vacío para un jugador sin órdenes activas.
   */
  static empty(playerId: string): OrderBook {
    return new OrderBook(playerId, Object.freeze([]), Object.freeze([]));
  }

  /**
   * Construye el libro de órdenes asegurando el ordenamiento canónico de mercado:
   * - Bids (compras): mayor precio primero (DESC).
   * - Asks (ventas): menor precio primero (ASC).
   */
  static create(playerId: string, bids: PriceLevel[], asks: PriceLevel[]): OrderBook {
    const sortedBids = [...bids].sort((a, b) => b.price - a.price);
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price);
    return new OrderBook(playerId, Object.freeze(sortedBids), Object.freeze(sortedAsks));
  }

  get playerId(): string {
    return this._playerId;
  }

  get bids(): readonly PriceLevel[] {
    return this._bids;
  }

  get asks(): readonly PriceLevel[] {
    return this._asks;
  }

  get totalBidVolume(): number {
    return this._bids.reduce((acc, level) => acc + level.totalQuantity, 0);
  }

  get totalAskVolume(): number {
    return this._asks.reduce((acc, level) => acc + level.totalQuantity, 0);
  }
}

