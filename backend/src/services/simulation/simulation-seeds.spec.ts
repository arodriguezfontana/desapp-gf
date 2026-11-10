import { User } from '../../domain/auth/user';
import { Email } from '../../domain/auth/email';
import { UserRole } from '../../domain/auth/user-role';
import { Player } from '../../domain/player/player';
import { Position } from '../../domain/player/enums/position';
import { League } from '../../domain/player/enums/league';
import { OrderSide } from '../../domain/orders/enums/order-side';
import { OrderStatus } from '../../domain/orders/enums/order-status';
import { TokenTransactionType } from '../../domain/orders/enums/token-transaction-type';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import {
  ADMIN_ORDER_PLANS,
  BOT_INITIAL_HOLDING,
  buildDateHelper,
  buildTradePlans,
  DEFAULT_BOTS,
  FALLBACK_REFERENCE_PRICE,
  MARKET_BOOK_LEVELS,
  QUOTE_HISTORY_STEPS,
} from './simulation-plans';
import { buildAdminOrders, buildDemoAlerts, buildMarketBook, buildQuoteHistory, buildTradeSeed } from './simulation-seeds';

/** Constructores puros de la siembra de simulación: se prueban sin Nest ni repositorios. */
describe('simulation-seeds', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  const dateAgo = buildDateHelper(now);
  const sequentialIds = () => {
    let n = 0;
    return () => `id-${++n}`;
  };

  const player = (id: string, position = Position.MF) =>
    Player.restore({
      id,
      name: `Player ${id}`,
      team: 'Chelsea',
      position,
      league: League.PREMIER_LEAGUE,
      passesCompleted: null,
      shots: null,
      interceptions: null,
      rating: null,
    });
  const simPlayers = ['p-1', 'p-2', 'p-3', 'p-4'].map((id) => player(id));
  const bots = DEFAULT_BOTS.map((cfg, i) =>
    User.register(`bot-${i}`, Email.create(cfg.email), 'hash', now, UserRole.USER, cfg.username),
  );
  const adminId = 'admin-1';
  const refPrices = new Map(simPlayers.map((p) => [p.id, 20]));

  describe('buildTradeSeed', () => {
    const seed = () => buildTradeSeed({ adminId, bots, simPlayers, refPrices, dateAgo, newId: sequentialIds() });

    it('crea dos órdenes COMPLETED y dos asientos por cada plan de operación', () => {
      const plans = buildTradePlans(simPlayers.length);

      const { orders, transactions } = seed();

      expect(orders).toHaveLength(plans.length * 2);
      expect(transactions).toHaveLength(plans.length * 2);
      expect(orders.every((o) => o.status === OrderStatus.COMPLETED)).toBe(true);
    });

    it('cada asiento del admin y el de su bot son opuestos y se referencian entre sí', () => {
      const { transactions } = seed();

      const [adminTx, botTx] = transactions;

      expect(adminTx.userId).toBe(adminId);
      expect(botTx.type).not.toBe(adminTx.type);
      expect(botTx.orderId).toBe(adminTx.counterpartOrderId);
      expect(botTx.counterpartOrderId).toBe(adminTx.orderId);
    });

    it('todos los asientos traen saldo antes/después coherente y nunca negativo', () => {
      const { transactions } = seed();

      for (const tx of transactions) {
        const delta = tx.type === TokenTransactionType.CREDIT ? tx.quantity : -tx.quantity;
        expect(tx.balanceAfter).toBe(tx.balanceBefore + delta);
        expect(tx.balanceBefore).toBeGreaterThanOrEqual(0);
        expect(tx.balanceAfter).toBeGreaterThanOrEqual(0);
      }
    });

    it('el admin parte de 0 y cada bot de su tenencia inicial', () => {
      const { transactions } = seed();

      const firstAdmin = transactions.find((t) => t.userId === adminId)!;
      const firstBot = transactions.find((t) => t.userId !== adminId)!;

      expect(firstAdmin.balanceBefore).toBe(0);
      expect(firstBot.balanceBefore).toBe(BOT_INITIAL_HOLDING);
    });

    it('devuelve sólo las tenencias finales positivas del admin', () => {
      const { adminHoldings } = seed();

      expect(adminHoldings.length).toBeGreaterThan(0);
      for (const holding of adminHoldings) {
        expect(holding.userId).toBe(adminId);
        expect(holding.quantity).toBeGreaterThan(0);
      }
    });

    it('con un generador determinista da siempre el mismo resultado', () => {
      const ids = (r: ReturnType<typeof seed>) => [...r.orders.map((o) => o.id), ...r.transactions.map((t) => t.id)];

      expect(ids(seed())).toEqual(ids(seed()));
    });
  });

  describe('buildAdminOrders', () => {
    it('crea una orden por cada plan, con el precio de referencia por el factor del plan', () => {
      const orders = buildAdminOrders({ adminId, simPlayers, refPrices, dateAgo, newId: sequentialIds() });

      expect(orders).toHaveLength(ADMIN_ORDER_PLANS.length);
      expect(orders.every((o) => o.userId === adminId)).toBe(true);
    });

    it('usa el precio de fallback cuando no hay precio de referencia del jugador', () => {
      const [first] = buildAdminOrders({ adminId, simPlayers, refPrices: new Map(), dateAgo, newId: sequentialIds() });

      expect(first.price).toBeCloseTo(FALLBACK_REFERENCE_PRICE * ADMIN_ORDER_PLANS[0].priceFactor, 2);
    });
  });

  describe('buildMarketBook', () => {
    const book = () => buildMarketBook({ bots, simPlayers, refPrices, dateAgo, newId: sequentialIds() });

    it('publica los niveles del libro por cada jugador, todos PENDING y con la cantidad completa pendiente', () => {
      const { orders } = book();

      expect(orders).toHaveLength(simPlayers.length * MARKET_BOOK_LEVELS.length);
      expect(orders.every((o) => o.status === OrderStatus.PENDING)).toBe(true);
      expect(orders.every((o) => [OrderSide.BUY, OrderSide.SELL].includes(o.side))).toBe(true);
    });

    it('da a cada bot su tenencia inicial en cada jugador simulado', () => {
      const { botHoldings } = book();

      expect(botHoldings).toHaveLength(bots.length * simPlayers.length);
      expect(botHoldings.every((h) => h.quantity === BOT_INITIAL_HOLDING)).toBe(true);
    });
  });

  describe('buildQuoteHistory', () => {
    it('crea una cotización por paso de historial y jugador, y devuelve la última de cada jugador', () => {
      const { quotes, latest } = buildQuoteHistory({
        adminId,
        activePlayers: simPlayers,
        refPrices,
        strategyId: 'strategy-1',
        dateAgo,
        newId: sequentialIds(),
      });

      expect(quotes).toHaveLength(simPlayers.length * QUOTE_HISTORY_STEPS.length);
      expect(latest).toHaveLength(simPlayers.length);
      expect(latest.map((q) => q.playerId)).toEqual(simPlayers.map((p) => p.id));
      expect(quotes.every((q) => q.userId === adminId)).toBe(true);
    });
  });

  describe('buildDemoAlerts', () => {
    const alerts = (players: Player[]) =>
      buildDemoAlerts({ adminId, simPlayers: players, refPrices, now, newId: sequentialIds() });

    it('con dos o más jugadores crea una PRICE_BELOW sobre el primero y una PRICE_ABOVE sobre el segundo', () => {
      const result = alerts(simPlayers);

      expect(result.map((a) => a.condition)).toEqual([AlertCondition.PRICE_BELOW, AlertCondition.PRICE_ABOVE]);
      expect(result.map((a) => a.playerId)).toEqual(['p-1', 'p-2']);
    });

    it('con un solo jugador crea sólo la PRICE_BELOW', () => {
      expect(alerts([simPlayers[0]])).toHaveLength(1);
    });

    it('sin jugadores no crea ninguna', () => {
      expect(alerts([])).toEqual([]);
    });
  });
});
