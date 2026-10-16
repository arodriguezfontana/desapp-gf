import { TokenHolding } from './token-holding';
import { InsufficientHoldingError } from './errors/insufficient-holding.error';

describe('TokenHolding', () => {
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
