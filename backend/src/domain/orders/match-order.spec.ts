import { matchOrder } from './match-order';
import { Order } from './order';
import { OrderSide } from './order-side';
import { OrderStatus } from './order-status';

describe('matchOrder', () => {
  const t = (secondsFromEpoch: number) => new Date(secondsFromEpoch * 1000);

  const sell = (id: string, quantity: number, createdAt: Date, price = 12.5, playerId = 'p1') =>
    Order.create({ id, userId: `seller-${id}`, playerId, side: OrderSide.SELL, quantity, price, createdAt });

  const buy = (id: string, quantity: number, createdAt: Date, price = 12.5, playerId = 'p1') =>
    Order.create({ id, userId: `buyer-${id}`, playerId, side: OrderSide.BUY, quantity, price, createdAt });

  it('fillea completo contra una unica candidata exacta (spec Historia 4, escenario 1)', () => {
    const candidate = sell('sell-1', 10, t(1));
    const newOrder = buy('buy-1', 10, t(2));

    const plan = matchOrder(newOrder, [candidate]);

    expect(plan.newOrderFinal.remainingQuantity).toBe(0);
    expect(plan.newOrderFinal.status).toBe(OrderStatus.COMPLETED);
    expect(plan.updatedCandidates).toHaveLength(1);
    expect(plan.updatedCandidates[0].remainingQuantity).toBe(0);
    expect(plan.updatedCandidates[0].status).toBe(OrderStatus.COMPLETED);
    expect(plan.fills).toHaveLength(1);
    expect(plan.fills[0]).toMatchObject({
      buyOrderId: 'buy-1',
      sellOrderId: 'sell-1',
      quantity: 10,
      price: 12.5,
    });
  });

  it('combina varias candidatas FIFO para cubrir toda la cantidad (spec Historia 4, escenario 2)', () => {
    const older = sell('sell-old', 7, t(1));
    const newer = sell('sell-new', 10, t(2));
    const newOrder = buy('buy-1', 10, t(3));

    const plan = matchOrder(newOrder, [older, newer]);

    expect(plan.newOrderFinal.remainingQuantity).toBe(0);
    expect(plan.fills).toHaveLength(2);
    // FIFO: la mas antigua primero, fileada por completo (7); el resto (3) contra la mas nueva.
    expect(plan.fills[0]).toMatchObject({ sellOrderId: 'sell-old', quantity: 7 });
    expect(plan.fills[1]).toMatchObject({ sellOrderId: 'sell-new', quantity: 3 });

    const oldUpdated = plan.updatedCandidates.find((c) => c.id === 'sell-old')!;
    const newUpdated = plan.updatedCandidates.find((c) => c.id === 'sell-new')!;
    expect(oldUpdated.status).toBe(OrderStatus.COMPLETED);
    expect(newUpdated.remainingQuantity).toBe(7);
    expect(newUpdated.status).toBe(OrderStatus.PARTIALLY_FILLED);
  });

  it('cubre solo una parte y deja un remanente pendiente (spec Historia 4, escenario 3)', () => {
    const candidate = sell('sell-1', 6, t(1));
    const newOrder = buy('buy-1', 10, t(2));

    const plan = matchOrder(newOrder, [candidate]);

    expect(plan.fills).toHaveLength(1);
    expect(plan.fills[0].quantity).toBe(6);
    expect(plan.newOrderFinal.remainingQuantity).toBe(4);
    expect(plan.newOrderFinal.status).toBe(OrderStatus.PARTIALLY_FILLED);
    expect(plan.updatedCandidates[0].status).toBe(OrderStatus.COMPLETED);
  });

  it('sin candidatas: ningun fill, la orden nueva queda integramente pendiente (spec Historia 4, escenario 4)', () => {
    const newOrder = buy('buy-1', 10, t(1));

    const plan = matchOrder(newOrder, []);

    expect(plan.fills).toHaveLength(0);
    expect(plan.newOrderFinal.remainingQuantity).toBe(10);
    expect(plan.newOrderFinal.status).toBe(OrderStatus.PENDING);
  });

  it('ignora candidatas cuyo precio_SELL supera el precio_BUY (el comprador no llega al precio del vendedor)', () => {
    const expensiveSell = sell('sell-1', 10, t(1), 12.51);
    const newOrder = buy('buy-1', 10, t(2), 12.5);

    const plan = matchOrder(newOrder, [expensiveSell]);

    expect(plan.fills).toHaveLength(0);
    expect(plan.newOrderFinal.status).toBe(OrderStatus.PENDING);
  });

  it('fillea cuando precio_BUY > precio_SELL y usa el precio de la SELL como precio de ejecución', () => {
    const cheapSell = sell('sell-1', 10, t(1), 10.0);
    const newOrder = buy('buy-1', 10, t(2), 15.0);

    const plan = matchOrder(newOrder, [cheapSell]);

    expect(plan.fills).toHaveLength(1);
    expect(plan.fills[0].quantity).toBe(10);
    expect(plan.fills[0].price).toBe(10.0);
    expect(plan.newOrderFinal.status).toBe(OrderStatus.COMPLETED);
  });

  it('ignora candidatas del mismo lado (defensivo, aunque el caller ya deberia filtrarlas)', () => {
    const sameSide = buy('buy-2', 10, t(1));
    const newOrder = buy('buy-1', 10, t(2));

    const plan = matchOrder(newOrder, [sameSide]);

    expect(plan.fills).toHaveLength(0);
  });

  it('cuando la nueva orden es SELL matchea contra candidatas BUY y asigna buyOrderId/sellOrderId correctamente', () => {
    const buyCandidate = buy('buy-cand', 10, t(1));
    const newSell = sell('sell-new', 10, t(2));

    const plan = matchOrder(newSell, [buyCandidate]);

    expect(plan.fills).toHaveLength(1);
    expect(plan.fills[0].buyOrderId).toBe('buy-cand');
    expect(plan.fills[0].sellOrderId).toBe('sell-new');
    expect(plan.fills[0].buyerUserId).toBe('buyer-buy-cand');
    expect(plan.fills[0].sellerUserId).toBe('seller-sell-new');
    expect(plan.fills[0].price).toBe(12.5);
    expect(plan.newOrderFinal.status).toBe(OrderStatus.COMPLETED);
  });

  it('cuando la nueva SELL supera la cantidad de la candidata BUY, filea parcialmente y deja remanente', () => {
    const smallBuy = buy('buy-small', 4, t(1));
    const newSell = sell('sell-big', 10, t(2));

    const plan = matchOrder(newSell, [smallBuy]);

    expect(plan.fills).toHaveLength(1);
    expect(plan.fills[0].quantity).toBe(4);
    expect(plan.newOrderFinal.remainingQuantity).toBe(6);
    expect(plan.newOrderFinal.status).toBe(OrderStatus.PARTIALLY_FILLED);
    expect(plan.updatedCandidates[0].status).toBe(OrderStatus.COMPLETED);
  });

  it('matchea entre si una orden de un usuario cualquiera y una del superusuario sin tratamiento especial (spec DD-004)', () => {
    const superuserSell = Order.create({
      id: 'sell-super',
      userId: 'superuser-id',
      playerId: 'p1',
      side: OrderSide.SELL,
      quantity: 100,
      price: 12.5,
      createdAt: t(1),
    });
    const regularBuy = buy('buy-1', 10, t(2));

    const plan = matchOrder(regularBuy, [superuserSell]);

    expect(plan.fills).toHaveLength(1);
    expect(plan.fills[0]).toMatchObject({ sellerUserId: 'superuser-id', quantity: 10 });
    expect(plan.newOrderFinal.status).toBe(OrderStatus.COMPLETED);
  });
});
