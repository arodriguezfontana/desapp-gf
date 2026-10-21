import { OrderBook, PriceLevel } from './order-book';

describe('OrderBook (Dominio)', () => {
  const playerId = 'player-123';

  it('crea un libro vacío correctamente con OrderBook.empty', () => {
    const book = OrderBook.empty(playerId);

    expect(book.playerId).toBe(playerId);
    expect(book.bids).toEqual([]);
    expect(book.asks).toEqual([]);
    expect(book.totalBidVolume).toBe(0);
    expect(book.totalAskVolume).toBe(0);
    expect(Object.isFrozen(book.bids)).toBe(true);
    expect(Object.isFrozen(book.asks)).toBe(true);
  });

  it('ordena canónicamente los bids de mayor a menor precio (DESC)', () => {
    const bids: PriceLevel[] = [
      { price: 20.0, totalQuantity: 10 },
      { price: 25.5, totalQuantity: 5 },
      { price: 22.0, totalQuantity: 15 },
    ];
    const asks: PriceLevel[] = [];

    const book = OrderBook.create(playerId, bids, asks);

    expect(book.bids).toEqual([
      { price: 25.5, totalQuantity: 5 },
      { price: 22.0, totalQuantity: 15 },
      { price: 20.0, totalQuantity: 10 },
    ]);
  });

  it('ordena canónicamente los asks de menor a mayor precio (ASC)', () => {
    const bids: PriceLevel[] = [];
    const asks: PriceLevel[] = [
      { price: 30.0, totalQuantity: 8 },
      { price: 27.5, totalQuantity: 12 },
      { price: 35.0, totalQuantity: 4 },
    ];

    const book = OrderBook.create(playerId, bids, asks);

    expect(book.asks).toEqual([
      { price: 27.5, totalQuantity: 12 },
      { price: 30.0, totalQuantity: 8 },
      { price: 35.0, totalQuantity: 4 },
    ]);
  });

  it('calcula correctamente el volumen total de compra y venta', () => {
    const bids: PriceLevel[] = [
      { price: 25.0, totalQuantity: 10 },
      { price: 24.0, totalQuantity: 20 },
    ];
    const asks: PriceLevel[] = [
      { price: 26.0, totalQuantity: 15 },
      { price: 27.0, totalQuantity: 25 },
      { price: 28.0, totalQuantity: 5 },
    ];

    const book = OrderBook.create(playerId, bids, asks);

    expect(book.totalBidVolume).toBe(30);
    expect(book.totalAskVolume).toBe(45);
  });

  it('congela las colecciones internas para garantizar inmutabilidad', () => {
    const bids: PriceLevel[] = [{ price: 20.0, totalQuantity: 10 }];
    const asks: PriceLevel[] = [{ price: 30.0, totalQuantity: 5 }];

    const book = OrderBook.create(playerId, bids, asks);

    expect(Object.isFrozen(book.bids)).toBe(true);
    expect(Object.isFrozen(book.asks)).toBe(true);
  });
});

