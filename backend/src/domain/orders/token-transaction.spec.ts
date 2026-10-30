import { Fill } from './match-order';
import { TokenTransaction } from './token-transaction';
import { TokenTransactionType } from './token-transaction-type';

describe('TokenTransaction.pairFromFill', () => {
  const fill: Fill = {
    buyOrderId: 'buy-1',
    sellOrderId: 'sell-1',
    buyerUserId: 'buyer',
    sellerUserId: 'seller',
    quantity: 3,
    price: 12.5,
  };
  const createdAt = new Date('2026-10-26T10:00:00Z');

  const sequentialIds = () => {
    let n = 0;
    return () => `id-${++n}`;
  };

  it('genera un CREDIT para el comprador y un DEBIT para el vendedor', () => {
    const [credit, debit] = TokenTransaction.pairFromFill(fill, 'player-1', createdAt, sequentialIds());

    expect(credit.type).toBe(TokenTransactionType.CREDIT);
    expect(credit.userId).toBe('buyer');
    expect(credit.orderId).toBe('buy-1');
    expect(credit.counterpartOrderId).toBe('sell-1');

    expect(debit.type).toBe(TokenTransactionType.DEBIT);
    expect(debit.userId).toBe('seller');
    expect(debit.orderId).toBe('sell-1');
    expect(debit.counterpartOrderId).toBe('buy-1');
  });

  it('ambos asientos comparten jugador, cantidad, precio y timestamp', () => {
    const entries = TokenTransaction.pairFromFill(fill, 'player-1', createdAt, sequentialIds());

    for (const entry of entries) {
      expect(entry.playerId).toBe('player-1');
      expect(entry.quantity).toBe(3);
      expect(entry.price).toBe(12.5);
      expect(entry.createdAt).toBe(createdAt);
    }
  });

  it('usa un id distinto para cada asiento', () => {
    const [credit, debit] = TokenTransaction.pairFromFill(fill, 'player-1', createdAt, sequentialIds());
    expect(credit.id).toBe('id-1');
    expect(debit.id).toBe('id-2');
  });
});
