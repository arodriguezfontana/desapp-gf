import { TokenHolding } from '../portfolio/token-holding';
import { InsufficientHoldingError } from '../portfolio/errors/insufficient-holding.error';
import { Fill } from './match-order';
import { involvedUserIdsInLockOrder, settleFills } from './settle-fills';

const holdingOf = (userId: string, quantity: number) =>
  TokenHolding.restore({ id: `h-${userId}`, userId, playerId: 'player-1', quantity, updatedAt: new Date() });

const fillOf = (buyerUserId: string, sellerUserId: string, quantity: number): Fill => ({
  buyOrderId: 'buy-1',
  sellOrderId: 'sell-1',
  buyerUserId,
  sellerUserId,
  quantity,
  price: 10,
});

describe('involvedUserIdsInLockOrder', () => {
  it('devuelve los usuarios sin repetidos y ordenados ascendentemente', () => {
    const fills = [fillOf('user-c', 'user-a', 1), fillOf('user-b', 'user-a', 1)];
    expect(involvedUserIdsInLockOrder(fills)).toEqual(['user-a', 'user-b', 'user-c']);
  });

  it('devuelve vacio si no hay fills', () => {
    expect(involvedUserIdsInLockOrder([])).toEqual([]);
  });

  it('un auto-match involucra a un unico usuario', () => {
    expect(involvedUserIdsInLockOrder([fillOf('user-a', 'user-a', 1)])).toEqual(['user-a']);
  });
});

describe('settleFills', () => {
  it('acredita al comprador y debita al vendedor', () => {
    const holdings = new Map([
      ['buyer', holdingOf('buyer', 0)],
      ['seller', holdingOf('seller', 10)],
    ]);

    const settled = settleFills([fillOf('buyer', 'seller', 4)], holdings);

    expect(settled.get('buyer')!.quantity).toBe(4);
    expect(settled.get('seller')!.quantity).toBe(6);
  });

  it('acumula varios fills sobre la misma contraparte', () => {
    const holdings = new Map([
      ['buyer', holdingOf('buyer', 0)],
      ['seller', holdingOf('seller', 10)],
    ]);

    const settled = settleFills([fillOf('buyer', 'seller', 3), fillOf('buyer', 'seller', 2)], holdings);

    expect(settled.get('buyer')!.quantity).toBe(5);
    expect(settled.get('seller')!.quantity).toBe(5);
  });

  it('un auto-match deja el saldo neto sin cambio', () => {
    const holdings = new Map([['user-a', holdingOf('user-a', 5)]]);

    const settled = settleFills([fillOf('user-a', 'user-a', 3)], holdings);

    expect(settled.get('user-a')!.quantity).toBe(5);
  });

  it('no muta los holdings recibidos', () => {
    const buyer = holdingOf('buyer', 0);
    const holdings = new Map([
      ['buyer', buyer],
      ['seller', holdingOf('seller', 10)],
    ]);

    settleFills([fillOf('buyer', 'seller', 4)], holdings);

    expect(holdings.get('buyer')).toBe(buyer);
    expect(buyer.quantity).toBe(0);
  });

  it('sin fills devuelve los mismos holdings', () => {
    const holdings = new Map([['user-a', holdingOf('user-a', 5)]]);
    expect(settleFills([], holdings).get('user-a')!.quantity).toBe(5);
  });

  it('lanza InsufficientHoldingError si el vendedor no tiene suficientes tokens', () => {
    const holdings = new Map([
      ['buyer', holdingOf('buyer', 0)],
      ['seller', holdingOf('seller', 1)],
    ]);

    expect(() => settleFills([fillOf('buyer', 'seller', 2)], holdings)).toThrow(InsufficientHoldingError);
  });
});
