import { InsufficientHoldingError } from '../portfolio/errors/insufficient-holding.error';
import { TokenHolding } from '../portfolio/token-holding';
import { Fill } from './match-order';
import { settleFills, settleFillsAudited } from './settle-fills';

/** 030-token-balance-snapshot: `settleFillsAudited` devuelve, además de las tenencias, el saldo antes/después de cada movimiento. */
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

describe('settleFillsAudited', () => {
  it('un fill: el comprador pasa de 10 a 15 y el vendedor de 10 a 5', () => {
    const holdings = new Map([
      ['buyer', holdingOf('buyer', 10)],
      ['seller', holdingOf('seller', 10)],
    ]);

    const { snapshots } = settleFillsAudited([fillOf('buyer', 'seller', 5)], holdings);

    expect(snapshots).toEqual([{ buyer: { before: 10, after: 15 }, seller: { before: 10, after: 5 } }]);
  });

  it('un comprador sin tenencia previa (holding vacío) parte de 0', () => {
    const holdings = new Map([
      ['buyer', TokenHolding.createEmpty('buyer', 'player-1')],
      ['seller', holdingOf('seller', 10)],
    ]);

    const { snapshots } = settleFillsAudited([fillOf('buyer', 'seller', 3)], holdings);

    expect(snapshots[0].buyer).toEqual({ before: 0, after: 3 });
  });

  it('varios fills sobre la misma tenencia encadenan: el segundo parte del saldo que dejó el primero', () => {
    const holdings = new Map([
      ['buyer', holdingOf('buyer', 0)],
      ['seller-a', holdingOf('seller-a', 10)],
      ['seller-b', holdingOf('seller-b', 10)],
    ]);

    const { snapshots, holdings: settled } = settleFillsAudited(
      [fillOf('buyer', 'seller-a', 4), fillOf('buyer', 'seller-b', 6)],
      holdings,
    );

    expect(snapshots[0].buyer).toEqual({ before: 0, after: 4 });
    expect(snapshots[1].buyer).toEqual({ before: 4, after: 10 });
    expect(settled.get('buyer')?.quantity).toBe(10);
  });

  it('auto-cruce: el débito parte del saldo ya acreditado y el saldo neto no cambia', () => {
    const holdings = new Map([['same', holdingOf('same', 10)]]);

    const { snapshots, holdings: settled } = settleFillsAudited([fillOf('same', 'same', 4)], holdings);

    expect(snapshots).toEqual([{ buyer: { before: 10, after: 14 }, seller: { before: 14, after: 10 } }]);
    expect(settled.get('same')?.quantity).toBe(10);
  });

  it('las tenencias devueltas son las mismas que las de settleFills', () => {
    const build = () =>
      new Map([
        ['buyer', holdingOf('buyer', 1)],
        ['seller', holdingOf('seller', 9)],
      ]);
    const fills = [fillOf('buyer', 'seller', 4), fillOf('buyer', 'seller', 2)];

    const audited = settleFillsAudited(fills, build()).holdings;
    const plain = settleFills(fills, build());

    expect(audited.get('buyer')?.quantity).toBe(plain.get('buyer')?.quantity);
    expect(audited.get('seller')?.quantity).toBe(plain.get('seller')?.quantity);
  });

  it('sin fills devuelve las tenencias recibidas y ningún snapshot', () => {
    const holdings = new Map([['buyer', holdingOf('buyer', 3)]]);

    const result = settleFillsAudited([], holdings);

    expect(result.snapshots).toEqual([]);
    expect(result.holdings.get('buyer')?.quantity).toBe(3);
  });

  it('un débito que dejaría un saldo negativo lanza InsufficientHoldingError', () => {
    const holdings = new Map([
      ['buyer', holdingOf('buyer', 0)],
      ['seller', holdingOf('seller', 1)],
    ]);

    expect(() => settleFillsAudited([fillOf('buyer', 'seller', 2)], holdings)).toThrow(InsufficientHoldingError);
  });

  it('no muta las tenencias recibidas', () => {
    const buyer = holdingOf('buyer', 1);
    const seller = holdingOf('seller', 9);

    settleFillsAudited([fillOf('buyer', 'seller', 4)], new Map([['buyer', buyer], ['seller', seller]]));

    expect(buyer.quantity).toBe(1);
    expect(seller.quantity).toBe(9);
  });
});
