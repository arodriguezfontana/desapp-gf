import { TokenTransactionType } from './enums/token-transaction-type';
import { Fill } from './match-order';
import { TokenTransaction } from './token-transaction';

/** 030-token-balance-snapshot: el asiento guarda el saldo anterior y posterior de la tenencia. */
describe('TokenTransaction: saldo anterior y posterior', () => {
  const base = {
    id: 'tx-1',
    userId: 'u-1',
    type: TokenTransactionType.CREDIT,
    playerId: 'p-1',
    quantity: 5,
    price: 10,
    orderId: 'o-1' as string | null,
    counterpartOrderId: 'o-2' as string | null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    balanceBefore: 10,
    balanceAfter: 15,
  };

  it('create expone los saldos recibidos', () => {
    const tx = TokenTransaction.create(base);

    expect(tx.balanceBefore).toBe(10);
    expect(tx.balanceAfter).toBe(15);
  });

  it('un saldo 0 es un valor válido y no se confunde con "sin dato"', () => {
    const tx = TokenTransaction.create({ ...base, balanceBefore: 0, balanceAfter: 5 });

    expect(tx.balanceBefore).toBe(0);
  });

  it('orderId y counterpartOrderId aceptan null (asiento de emisión)', () => {
    const tx = TokenTransaction.create({ ...base, orderId: null, counterpartOrderId: null });

    expect(tx.orderId).toBeNull();
    expect(tx.counterpartOrderId).toBeNull();
  });

  it('isEmission es true sólo cuando no hay orden', () => {
    expect(TokenTransaction.create({ ...base, orderId: null, counterpartOrderId: null }).isEmission).toBe(true);
    expect(TokenTransaction.create(base).isEmission).toBe(false);
  });

  it('es inmutable: no expone ningún método de edición', () => {
    const tx = TokenTransaction.create(base) as unknown as Record<string, unknown>;

    for (const name of ['setBalanceBefore', 'setBalanceAfter', 'update', 'setQuantity']) {
      expect(tx[name]).toBeUndefined();
    }
  });
});

describe('TokenTransaction.pairFromFill con snapshot de saldo', () => {
  const fill: Fill = {
    buyOrderId: 'buy-1',
    sellOrderId: 'sell-1',
    buyerUserId: 'buyer',
    sellerUserId: 'seller',
    quantity: 5,
    price: 12.5,
  };
  const createdAt = new Date('2026-10-26T10:00:00Z');
  const snapshot = { buyer: { before: 10, after: 15 }, seller: { before: 10, after: 5 } };
  const ids = () => {
    let n = 0;
    return () => `id-${++n}`;
  };

  it('el CREDIT del comprador lleva el saldo del comprador y el DEBIT del vendedor el del vendedor', () => {
    const [credit, debit] = TokenTransaction.pairFromFill(fill, 'player-1', createdAt, ids(), snapshot);

    expect([credit.balanceBefore, credit.balanceAfter]).toEqual([10, 15]);
    expect([debit.balanceBefore, debit.balanceAfter]).toEqual([10, 5]);
  });

  it('en cada asiento el saldo posterior es el anterior más (CREDIT) o menos (DEBIT) la cantidad', () => {
    const [credit, debit] = TokenTransaction.pairFromFill(fill, 'player-1', createdAt, ids(), snapshot);

    expect(credit.balanceAfter).toBe((credit.balanceBefore as number) + credit.quantity);
    expect(debit.balanceAfter).toBe((debit.balanceBefore as number) - debit.quantity);
  });

  it('cada asiento lleva ambos saldos como números (nunca nulos)', () => {
    const entries = TokenTransaction.pairFromFill(fill, 'player-1', createdAt, ids(), snapshot);

    for (const entry of entries) {
      expect(typeof entry.balanceBefore).toBe('number');
      expect(typeof entry.balanceAfter).toBe('number');
    }
  });
});
