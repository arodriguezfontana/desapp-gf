import { TokenHolding } from './token-holding';
import { InsufficientHoldingError } from './errors/insufficient-holding.error';

describe('TokenHolding', () => {
  describe('withQuantity', () => {
    it('fija la cantidad absoluta conservando la identidad', () => {
      const original = TokenHolding.restore({ id: 'h-1', userId: 'user-1', playerId: 'player-1', quantity: 10, updatedAt: new Date() });
      const updated = original.withQuantity(250);
      expect(updated.quantity).toBe(250);
      expect(updated.id).toBe('h-1');
      expect(updated.userId).toBe('user-1');
      expect(updated.playerId).toBe('player-1');
      expect(original.quantity).toBe(10);
    });

    it('permite fijar la cantidad en 0', () => {
      expect(TokenHolding.createEmpty('user-1', 'player-1').withQuantity(0).quantity).toBe(0);
    });

    it('rechaza una cantidad negativa o no entera', () => {
      const holding = TokenHolding.createEmpty('user-1', 'player-1');
      expect(() => holding.withQuantity(-1)).toThrow(InsufficientHoldingError);
      expect(() => holding.withQuantity(1.5)).toThrow(InsufficientHoldingError);
    });
  });

  describe('assertCanSell', () => {
    const holdingOf = (quantity: number) =>
      TokenHolding.restore({ id: 'h-1', userId: 'user-1', playerId: 'player-1', quantity, updatedAt: new Date() });

    it('permite vender exactamente lo que se posee', () => {
      expect(() => TokenHolding.assertCanSell(holdingOf(5), 5, 0)).not.toThrow();
    });

    it('descuenta lo ya comprometido en ordenes SELL pendientes', () => {
      expect(() => TokenHolding.assertCanSell(holdingOf(5), 3, 2)).not.toThrow();
      expect(() => TokenHolding.assertCanSell(holdingOf(5), 4, 2)).toThrow(InsufficientHoldingError);
    });

    it('rechaza vender mas de lo que se posee', () => {
      expect(() => TokenHolding.assertCanSell(holdingOf(5), 6, 0)).toThrow(InsufficientHoldingError);
    });

    it('rechaza vender si nunca hubo holding', () => {
      expect(() => TokenHolding.assertCanSell(null, 1, 0)).toThrow(InsufficientHoldingError);
    });
  });

  it('createEmpty nace en 0', () => {
    const holding = TokenHolding.createEmpty('user-1', 'player-1');
    expect(holding.quantity).toBe(0);
    expect(holding.userId).toBe('user-1');
    expect(holding.playerId).toBe('player-1');
  });

  describe('credit', () => {
    it('incrementa la cantidad', () => {
      const holding = TokenHolding.createEmpty('user-1', 'player-1').credit(100);
      expect(holding.quantity).toBe(100);
    });

    it('acumula varios creditos', () => {
      const holding = TokenHolding.createEmpty('user-1', 'player-1').credit(100).credit(5);
      expect(holding.quantity).toBe(105);
    });

    it('rechaza acreditar una cantidad <= 0', () => {
      const holding = TokenHolding.createEmpty('user-1', 'player-1');
      expect(() => holding.credit(0)).toThrow(InsufficientHoldingError);
      expect(() => holding.credit(-1)).toThrow(InsufficientHoldingError);
    });
  });

  describe('debit', () => {
    it('decrementa la cantidad', () => {
      const holding = TokenHolding.createEmpty('user-1', 'player-1').credit(100).debit(30);
      expect(holding.quantity).toBe(70);
    });

    it('permite debitar exactamente toda la cantidad disponible (llega a 0)', () => {
      const holding = TokenHolding.createEmpty('user-1', 'player-1').credit(10).debit(10);
      expect(holding.quantity).toBe(0);
    });

    it('rechaza debitar mas de lo disponible (InsufficientHoldingError)', () => {
      const holding = TokenHolding.createEmpty('user-1', 'player-1').credit(10);
      expect(() => holding.debit(11)).toThrow(InsufficientHoldingError);
    });

    it('rechaza debitar una cantidad <= 0', () => {
      const holding = TokenHolding.createEmpty('user-1', 'player-1').credit(10);
      expect(() => holding.debit(0)).toThrow(InsufficientHoldingError);
      expect(() => holding.debit(-1)).toThrow(InsufficientHoldingError);
    });
  });

  describe('restore', () => {
    it('reconstruye un holding persistido', () => {
      const updatedAt = new Date('2026-10-16T12:00:00.000Z');
      const holding = TokenHolding.restore({
        id: 'holding-1',
        userId: 'user-1',
        playerId: 'player-1',
        quantity: 42,
        updatedAt,
      });
      expect(holding.id).toBe('holding-1');
      expect(holding.quantity).toBe(42);
      expect(holding.updatedAt).toBe(updatedAt);
    });

    it('rechaza reconstruir con cantidad negativa', () => {
      expect(() =>
        TokenHolding.restore({
          id: 'holding-1',
          userId: 'user-1',
          playerId: 'player-1',
          quantity: -1,
          updatedAt: new Date(),
        }),
      ).toThrow(InsufficientHoldingError);
    });
  });
});
