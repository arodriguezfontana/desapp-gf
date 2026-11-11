import { InsufficientHoldingError } from './errors/insufficient-holding.error';
import { TokenHolding } from './token-holding';

/** 030-token-balance-snapshot: el saldo anterior y el posterior se capturan en la misma operación. */
describe('TokenHolding: snapshot de saldo (applyCredit / applyDebit)', () => {
  const holdingWith = (quantity: number) =>
    TokenHolding.restore({ id: 'h-1', userId: 'u-1', playerId: 'p-1', quantity, updatedAt: new Date() });

  describe('applyCredit', () => {
    it('devuelve el holding acreditado y el saldo antes/después', () => {
      const { holding, snapshot } = holdingWith(10).applyCredit(5);

      expect(holding.quantity).toBe(15);
      expect(snapshot).toEqual({ before: 10, after: 15 });
    });

    it('sobre una tenencia vacía el saldo anterior es 0', () => {
      const { holding, snapshot } = TokenHolding.createEmpty('u-1', 'p-1').applyCredit(3);

      expect(holding.quantity).toBe(3);
      expect(snapshot).toEqual({ before: 0, after: 3 });
    });

    it.each([0, -1, 1.5])('rechaza la cantidad %p', (quantity) => {
      expect(() => holdingWith(10).applyCredit(quantity)).toThrow(InsufficientHoldingError);
    });
  });

  describe('applyDebit', () => {
    it('devuelve el holding debitado y el saldo antes/después', () => {
      const { holding, snapshot } = holdingWith(10).applyDebit(4);

      expect(holding.quantity).toBe(6);
      expect(snapshot).toEqual({ before: 10, after: 6 });
    });

    it('un débito que deja la tenencia en 0 es válido (saldo posterior 0)', () => {
      const { snapshot } = holdingWith(10).applyDebit(10);

      expect(snapshot).toEqual({ before: 10, after: 0 });
    });

    it('un débito mayor al saldo lanza InsufficientHoldingError (nunca un saldo negativo)', () => {
      expect(() => holdingWith(10).applyDebit(11)).toThrow(InsufficientHoldingError);
    });

    it.each([0, -1, 1.5])('rechaza la cantidad %p', (quantity) => {
      expect(() => holdingWith(10).applyDebit(quantity)).toThrow(InsufficientHoldingError);
    });
  });

  describe('credit / debit siguen siendo el mismo cálculo', () => {
    it('credit(q) devuelve el mismo holding que applyCredit(q).holding', () => {
      const holding = holdingWith(7);

      expect(holding.credit(5).quantity).toBe(holding.applyCredit(5).holding.quantity);
    });

    it('debit(q) devuelve el mismo holding que applyDebit(q).holding', () => {
      const holding = holdingWith(7);

      expect(holding.debit(5).quantity).toBe(holding.applyDebit(5).holding.quantity);
    });
  });

  it('la instancia original no muta', () => {
    const original = holdingWith(10);

    original.applyCredit(5);
    original.applyDebit(3);

    expect(original.quantity).toBe(10);
  });
});
