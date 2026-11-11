import { OrderSide } from '../../domain/orders/enums/order-side';
import { resolveOrderOperation } from './order-operation';

describe('resolveOrderOperation', () => {
  it('una orden BUY es una compra de tokens', () => {
    expect(resolveOrderOperation({ body: { side: OrderSide.BUY } })).toBe('TOKENS_BOUGHT');
  });

  it('una orden SELL es una venta de tokens', () => {
    expect(resolveOrderOperation({ body: { side: OrderSide.SELL } })).toBe('TOKENS_SOLD');
  });

  it.each([[{}], [{ side: 'buy' }], [{ side: 42 }], [undefined], [null]])(
    'sin un side válido (%p) devuelve ORDER_PLACED',
    (body) => {
      expect(resolveOrderOperation({ body })).toBe('ORDER_PLACED');
    },
  );

  it('no modifica la request', () => {
    const req = { body: { side: OrderSide.BUY, quantity: 3 } };
    const copy = JSON.parse(JSON.stringify(req));

    resolveOrderOperation(req);

    expect(req).toEqual(copy);
  });
});
