import { Inject, Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../adapters/runtime/clock';
import { IdGenerator } from '../../adapters/runtime/id-generator';
import { CLOCK, ID_GENERATOR } from '../../modules/runtime/runtime.constants';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PASSWORD_HASHER } from '../../modules/auth/auth.constants';

import { UserRepository } from '../../repositories/auth/user.repository';
import { PasswordHasher } from '../../adapters/auth/password-hasher';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { Player } from '../../domain/player/player';
import { OrderRepository } from '../../repositories/orders/order.repository';
import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import { PlayerQuoteRepository } from '../../repositories/quotation/player-quote.repository';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import { PriceAlertRepository } from '../../repositories/alerts/price-alert.repository';

import { Email } from '../../domain/auth/email';
import { User } from '../../domain/auth/user';
import { UserRole } from '../../domain/auth/user-role';
import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/order-side';
import { OrderStatus } from '../../domain/orders/order-status';
import { TokenHolding } from '../../domain/portfolio/token-holding';
import { TokenTransaction } from '../../domain/orders/token-transaction';
import { TokenTransactionType } from '../../domain/orders/token-transaction-type';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { QuoteRecalculatedEvent, QUOTE_RECALCULATED_EVENT } from '../../domain/alerts/events/quote-recalculated.event';
import { PriceAlert } from '../../domain/alerts/price-alert';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import { QuotationService } from '../quotation/quotation.service';
import { StrategyProvisioningService } from '../quotation/strategy-provisioning.service';
import { roundToTwoDecimals } from '../../shared/numbers/round2';
import { SimulationResultDto, SimulatedQuoteDto } from '../../controllers/admin/dto/simulation-result.dto';
import {
  ADMIN_ORDER_PLANS,
  BOT_INITIAL_HOLDING,
  buildDateHelper,
  buildTradePlans,
  DEFAULT_BOTS,
  DEMO_ALERT_ABOVE_FACTOR,
  DEMO_ALERT_BELOW_FACTOR,
  FALLBACK_REFERENCE_PRICE,
  MARKET_BOOK_LEVELS,
  MAX_SIMULATED_PLAYERS,
  MIN_REFERENCE_PRICE,
  QUOTE_HISTORY_STEPS,
} from './simulation-plans';

@Injectable()
export class MarketSimulationService {
  private readonly logger = new Logger(MarketSimulationService.name);

  constructor(
    private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly players: PlayerRepository,
    private readonly orders: OrderRepository,
    private readonly holdings: TokenHoldingRepository,
    private readonly tokenTransactions: TokenTransactionRepository,
    private readonly playerQuotes: PlayerQuoteRepository,
    private readonly strategies: ValuationStrategyRepository,
    private readonly priceAlerts: PriceAlertRepository,
    private readonly quotation: QuotationService,
    private readonly strategyProvisioning: StrategyProvisioningService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async simulate(targetEmail?: string): Promise<SimulationResultDto> {
    const adminEmailStr = targetEmail ?? this.config.get<string>('ADMIN_EMAIL') ?? 'admin@desapp.com';
    this.logger.log(`Iniciando simulación de mercado para ${adminEmailStr}...`);

    const admin = await this.ensureAdminUser(adminEmailStr);
    const bots = await this.ensureBots();
    const activePlayers = await this.players.findAllActive();

    if (activePlayers.length === 0) {
      return {
        success: false,
        message: 'No hay jugadores activos en el catálogo para simular operaciones.',
        adminEmail: adminEmailStr,
        holdingsCreated: 0,
        transactionsCreated: 0,
        ordersCreated: 0,
        marketOrdersCreated: 0,
        quotesCreated: 0,
        playersInvolved: [],
        quotes: [],
        alertsCreated: 0,
      };
    }

    const simPlayers = activePlayers.slice(0, Math.min(MAX_SIMULATED_PLAYERS, activePlayers.length));
    const refPrices = await this.buildRefPrices(admin.id, activePlayers);
    const alertsCreated = await this.ensureDemoAlerts(admin.id, simPlayers, refPrices);

    const tDate = buildDateHelper(this.clock.now());

    const { transactionsCount, holdingsCount, adminOrdersCount, marketOrdersCount } =
      await this.seedMarketActivityIfNeeded(admin, bots, simPlayers, refPrices, tDate);

    const { quotesCount, quotesSummary } = await this.seedQuotes(admin.id, activePlayers, refPrices, tDate);

    this.logger.log(
      `Simulación completada con éxito: ${holdingsCount} holdings, ${transactionsCount} transacciones, ${adminOrdersCount} órdenes admin, ${marketOrdersCount} órdenes de mercado, ${quotesCount} cotizaciones.`,
    );

    return {
      success: true,
      message: 'Simulación de mercado ejecutada exitosamente. Actividad y volumen de datos cargados.',
      adminEmail: adminEmailStr,
      holdingsCreated: holdingsCount,
      transactionsCreated: transactionsCount,
      ordersCreated: adminOrdersCount,
      marketOrdersCreated: marketOrdersCount,
      quotesCreated: quotesCount,
      playersInvolved: simPlayers.map((p) => p.name),
      quotes: quotesSummary,
      alertsCreated,
    };
  }

  private async buildRefPrices(adminId: string, players: Player[]): Promise<Map<string, number>> {
    const entries = await Promise.all(
      players.map(async (player): Promise<[string, number]> => {
        try {
          const val = await this.quotation.valuate(adminId, player.id);
          return [player.id, Math.max(MIN_REFERENCE_PRICE, roundToTwoDecimals(val.value))];
        } catch {
          return [player.id, FALLBACK_REFERENCE_PRICE];
        }
      }),
    );
    return new Map(entries);
  }

  private async seedMarketActivityIfNeeded(
    admin: User,
    bots: User[],
    simPlayers: Player[],
    refPrices: Map<string, number>,
    tDate: (daysAgo: number) => Date,
  ): Promise<{ transactionsCount: number; holdingsCount: number; adminOrdersCount: number; marketOrdersCount: number }> {
    const alreadySimulated = (await this.tokenTransactions.findByUserId(admin.id)).length > 0;
    if (alreadySimulated) {
      return { transactionsCount: 0, holdingsCount: 0, adminOrdersCount: 0, marketOrdersCount: 0 };
    }

    const { transactionsCount, holdingsCount } = await this.seedTransactionsAndHoldings(admin, bots, simPlayers, refPrices, tDate);
    const adminOrdersCount = await this.seedAdminOrders(admin.id, simPlayers, refPrices, tDate);
    const marketOrdersCount = await this.seedMarketBook(bots, simPlayers, refPrices, tDate);

    return { transactionsCount, holdingsCount, adminOrdersCount, marketOrdersCount };
  }

  private async seedTransactionsAndHoldings(
    admin: User,
    bots: User[],
    simPlayers: Player[],
    refPrices: Map<string, number>,
    tDate: (daysAgo: number) => Date,
  ): Promise<{ transactionsCount: number; holdingsCount: number }> {
    const txPlans = buildTradePlans(simPlayers.length);

    const adminHoldingsQty = new Map<string, number>();
    const ordersToSave: Order[] = [];
    const transactionsToSave: TokenTransaction[] = [];
    let transactionsCount = 0;

    for (const plan of txPlans) {
      const player = simPlayers[plan.playerIdx];
      const bot = bots[plan.botIdx % bots.length];
      const price = roundToTwoDecimals((refPrices.get(player.id) ?? FALLBACK_REFERENCE_PRICE) * plan.priceFactor);
      const createdAt = tDate(plan.daysAgo);
      const orderId = this.ids.generate();
      const counterpartOrderId = this.ids.generate();
      const adminSide = plan.type === TokenTransactionType.CREDIT ? OrderSide.BUY : OrderSide.SELL;

      ordersToSave.push(Order.seed({ id: orderId, userId: admin.id, playerId: player.id, side: adminSide, quantity: plan.quantity, remainingQuantity: 0, price, createdAt, status: OrderStatus.COMPLETED }));
      ordersToSave.push(Order.seed({ id: counterpartOrderId, userId: bot.id, playerId: player.id, side: adminSide === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY, quantity: plan.quantity, remainingQuantity: 0, price, createdAt, status: OrderStatus.COMPLETED }));

      transactionsToSave.push(TokenTransaction.create({ id: this.ids.generate(), userId: admin.id, type: plan.type, playerId: player.id, quantity: plan.quantity, price, orderId, counterpartOrderId, createdAt }));
      transactionsCount++;

      const botTxType = plan.type === TokenTransactionType.CREDIT ? TokenTransactionType.DEBIT : TokenTransactionType.CREDIT;
      transactionsToSave.push(TokenTransaction.create({ id: this.ids.generate(), userId: bot.id, type: botTxType, playerId: player.id, quantity: plan.quantity, price, orderId: counterpartOrderId, counterpartOrderId: orderId, createdAt }));

      const current = adminHoldingsQty.get(player.id) ?? 0;
      adminHoldingsQty.set(player.id, Math.max(0, plan.type === TokenTransactionType.CREDIT ? current + plan.quantity : current - plan.quantity));
    }

    // Las transacciones referencian a las órdenes (FK): primero las órdenes.
    await Promise.all(ordersToSave.map((order) => this.orders.save(order)));
    await Promise.all(transactionsToSave.map((tx) => this.tokenTransactions.save(tx)));

    const holdingsToSave = [...adminHoldingsQty.entries()].filter(([, quantity]) => quantity > 0);
    await Promise.all(
      holdingsToSave.map(([playerId, quantity]) => this.saveHoldingQuantity(admin.id, playerId, quantity)),
    );

    return { transactionsCount, holdingsCount: holdingsToSave.length };
  }

  private async seedAdminOrders(
    adminId: string,
    simPlayers: Player[],
    refPrices: Map<string, number>,
    tDate: (daysAgo: number) => Date,
  ): Promise<number> {
    const orders = ADMIN_ORDER_PLANS.map((plan) => {
      const player = plan.playerIdx < 0 ? simPlayers.at(plan.playerIdx)! : simPlayers[plan.playerIdx];
      const referencePrice = refPrices.get(player.id) ?? FALLBACK_REFERENCE_PRICE;
      return Order.seed({
        id: this.ids.generate(),
        userId: adminId,
        playerId: player.id,
        side: plan.side,
        quantity: plan.quantity,
        remainingQuantity: plan.remainingQuantity,
        price: roundToTwoDecimals(referencePrice * plan.priceFactor),
        createdAt: tDate(plan.daysAgo),
        status: plan.status,
      });
    });
    await Promise.all(orders.map((order) => this.orders.save(order)));
    return orders.length;
  }

  private async seedMarketBook(
    bots: User[],
    simPlayers: Player[],
    refPrices: Map<string, number>,
    tDate: (daysAgo: number) => Date,
  ): Promise<number> {
    const holdings = simPlayers.flatMap((player) => bots.map((bot) => ({ botId: bot.id, playerId: player.id })));
    const orders = simPlayers.flatMap((player) => {
      const base = refPrices.get(player.id) ?? FALLBACK_REFERENCE_PRICE;
      return MARKET_BOOK_LEVELS.map((level) =>
        Order.seed({
          id: this.ids.generate(),
          userId: bots[level.botIdx].id,
          playerId: player.id,
          side: level.side,
          quantity: level.quantity,
          remainingQuantity: level.quantity,
          price: roundToTwoDecimals(base * level.priceFactor),
          createdAt: tDate(level.daysAgo),
          status: OrderStatus.PENDING,
        }),
      );
    });

    await Promise.all(
      holdings.map(({ botId, playerId }) => this.saveHoldingQuantity(botId, playerId, BOT_INITIAL_HOLDING)),
    );
    await Promise.all(orders.map((order) => this.orders.save(order)));
    return orders.length;
  }

  private async seedQuotes(
    adminId: string,
    activePlayers: Player[],
    refPrices: Map<string, number>,
    tDate: (daysAgo: number) => Date,
  ): Promise<{ quotesCount: number; quotesSummary: SimulatedQuoteDto[] }> {
    await this.playerQuotes.deleteAllByUserId(adminId);

    const adminStrategies = await this.strategies.findByUserId(adminId);
    const selectedStrategy = adminStrategies.find((s) => s.isSelected) ?? adminStrategies[0];
    const strategyId = selectedStrategy ? selectedStrategy.id : this.ids.generate();

    const quotesToSave: PlayerQuote[] = [];
    const quotesSummary: SimulatedQuoteDto[] = [];
    const latestQuoteByPlayer: PlayerQuote[] = [];

    for (const player of activePlayers) {
      const currentPrice = refPrices.get(player.id) ?? FALLBACK_REFERENCE_PRICE;
      let latestQuote: PlayerQuote | null = null;
      for (const step of QUOTE_HISTORY_STEPS) {
        const quoteValue = roundToTwoDecimals(currentPrice * step.factor);
        const quote = PlayerQuote.create({ id: this.ids.generate(), userId: adminId, playerId: player.id, strategyId, weightSnapshot: { rating: 1.0, goals: 1.0 }, factorEscalaSnapshot: 1.0, score: roundToTwoDecimals(quoteValue / 10), value: quoteValue, calculatedAt: tDate(step.daysAgo), appliedPosition: player.position });
        quotesToSave.push(quote);
        latestQuote = quote;
      }
      quotesSummary.push({ playerId: player.id, playerName: player.name, value: latestQuote!.value });
      latestQuoteByPlayer.push(latestQuote!);
    }
    await this.playerQuotes.saveMany(quotesToSave);

    await Promise.all(
      latestQuoteByPlayer.map((quote) =>
        this.eventEmitter.emitAsync(
          QUOTE_RECALCULATED_EVENT,
          new QuoteRecalculatedEvent(quote.userId, quote.playerId, quote.value, quote.calculatedAt),
        ),
      ),
    );

    return { quotesCount: quotesToSave.length, quotesSummary };
  }

  /**
   * Siembra, solo la primera vez, dos `PriceAlert` de demo del admin: una
   * `PRICE_BELOW` y una `PRICE_ABOVE`, sobre dos jugadores distintos de los
   * que tienen actividad de mercado simulada. Los umbrales se calculan a
   * partir de `refPrices` con margen suficiente para que la cotización que
   * genera el paso 9 (≈0.99 × precio de referencia) las cumpla, de forma
   * que el recálculo simulado dispare el flujo real de alertas.
   */
  private async ensureDemoAlerts(
    adminId: string,
    simPlayers: Player[],
    refPrices: Map<string, number>,
  ): Promise<number> {
    const existing = await this.priceAlerts.findAllByUserId(adminId);
    if (existing.length > 0 || simPlayers.length === 0) {
      return 0;
    }

    const now = this.clock.now();
    const belowPlayer = simPlayers[0];
    const belowPrice = refPrices.get(belowPlayer.id) ?? FALLBACK_REFERENCE_PRICE;
    const alertsToCreate: PriceAlert[] = [
      PriceAlert.create({
        id: this.ids.generate(),
        userId: adminId,
        playerId: belowPlayer.id,
        condition: AlertCondition.PRICE_BELOW,
        targetValue: roundToTwoDecimals(belowPrice * DEMO_ALERT_BELOW_FACTOR),
        createdAt: now,
      }),
    ];

    if (simPlayers.length > 1) {
      const abovePlayer = simPlayers[1];
      const abovePrice = refPrices.get(abovePlayer.id) ?? FALLBACK_REFERENCE_PRICE;
      alertsToCreate.push(
        PriceAlert.create({
          id: this.ids.generate(),
          userId: adminId,
          playerId: abovePlayer.id,
          condition: AlertCondition.PRICE_ABOVE,
          targetValue: roundToTwoDecimals(abovePrice * DEMO_ALERT_ABOVE_FACTOR),
          createdAt: now,
        }),
      );
    }

    await Promise.all(alertsToCreate.map((alert) => this.priceAlerts.save(alert)));
    return alertsToCreate.length;
  }

  /** Fija la cantidad de un holding (idempotente): reutiliza el existente o abre uno nuevo. */
  private async saveHoldingQuantity(userId: string, playerId: string, quantity: number): Promise<void> {
    const existing = await this.holdings.findByUserAndPlayer(userId, playerId);
    const holding = existing ?? TokenHolding.createEmpty(userId, playerId);
    await this.holdings.save(holding.withQuantity(quantity));
  }

  private async ensureAdminUser(emailStr: string): Promise<User> {
    const email = Email.create(emailStr);
    let admin = await this.users.findByEmail(email);

    if (!admin) {
      const rawPassword = this.config.get<string>('ADMIN_PASSWORD') ?? 'Abrilrz1!';
      const hash = await this.hasher.hash(rawPassword);
      admin = User.register(this.ids.generate(), email, hash, this.clock.now(), UserRole.ADMIN, 'admin');
      await this.users.save(admin);
      await this.strategyProvisioning.provisionDefaultStrategiesFor(admin.id);
    }

    return admin;
  }

  private async ensureBots(): Promise<User[]> {
    const botPassword = this.config.get<string>('BOT_PASSWORD') ?? 'BotSecurePass123!';
    const botPasswordHash = await this.hasher.hash(botPassword);

    return Promise.all(
      DEFAULT_BOTS.map(async (cfg) => {
        const email = Email.create(cfg.email);
        let bot = await this.users.findByEmail(email);
        if (!bot) {
          bot = User.register(this.ids.generate(), email, botPasswordHash, this.clock.now(), UserRole.USER, cfg.username);
          await this.users.save(bot);
          await this.strategyProvisioning.provisionDefaultStrategiesFor(bot.id);
        }
        return bot;
      }),
    );
  }
}

