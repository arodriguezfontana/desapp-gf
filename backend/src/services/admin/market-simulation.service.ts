import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';

import { USER_REPOSITORY, PASSWORD_HASHER } from '../../modules/auth/auth.constants';
import { PLAYER_REPOSITORY } from '../../modules/player/player.constants';
import { ORDER_REPOSITORY, TOKEN_TRANSACTION_REPOSITORY } from '../../modules/orders/orders.constants';
import { TOKEN_HOLDING_REPOSITORY } from '../../modules/portfolio/portfolio.constants';
import { PLAYER_QUOTE_REPOSITORY, VALUATION_STRATEGY_REPOSITORY } from '../../modules/quotation/quotation.constants';
import { PRICE_ALERT_REPOSITORY } from '../../modules/alerts/alerts.constants';

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
import { UserStrategyProvisioningService } from '../auth/user-strategy-provisioning.service';
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
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(PLAYER_REPOSITORY) private readonly players: PlayerRepository,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(TOKEN_HOLDING_REPOSITORY) private readonly holdings: TokenHoldingRepository,
    @Inject(TOKEN_TRANSACTION_REPOSITORY) private readonly tokenTransactions: TokenTransactionRepository,
    @Inject(PLAYER_QUOTE_REPOSITORY) private readonly playerQuotes: PlayerQuoteRepository,
    @Inject(VALUATION_STRATEGY_REPOSITORY) private readonly strategies: ValuationStrategyRepository,
    @Inject(PRICE_ALERT_REPOSITORY) private readonly priceAlerts: PriceAlertRepository,
    private readonly quotation: QuotationService,
    private readonly strategyProvisioning: UserStrategyProvisioningService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
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

    const tDate = buildDateHelper();

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
    const refPrices = new Map<string, number>();
    for (const player of players) {
      try {
        const val = await this.quotation.valuate(adminId, player.id);
        refPrices.set(player.id, Math.max(MIN_REFERENCE_PRICE, roundToTwoDecimals(val.value)));
      } catch {
        refPrices.set(player.id, FALLBACK_REFERENCE_PRICE);
      }
    }
    return refPrices;
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
    let transactionsCount = 0;

    for (const plan of txPlans) {
      const player = simPlayers[plan.playerIdx];
      const bot = bots[plan.botIdx % bots.length];
      const price = roundToTwoDecimals((refPrices.get(player.id) ?? FALLBACK_REFERENCE_PRICE) * plan.priceFactor);
      const createdAt = tDate(plan.daysAgo);
      const orderId = randomUUID();
      const counterpartOrderId = randomUUID();
      const adminSide = plan.type === TokenTransactionType.CREDIT ? OrderSide.BUY : OrderSide.SELL;

      await this.orders.save(Order.restore({ id: orderId, userId: admin.id, playerId: player.id, side: adminSide, quantity: plan.quantity, remainingQuantity: 0, price, createdAt, status: OrderStatus.COMPLETED }));
      await this.orders.save(Order.restore({ id: counterpartOrderId, userId: bot.id, playerId: player.id, side: adminSide === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY, quantity: plan.quantity, remainingQuantity: 0, price, createdAt, status: OrderStatus.COMPLETED }));

      await this.tokenTransactions.save(TokenTransaction.create({ id: randomUUID(), userId: admin.id, type: plan.type, playerId: player.id, quantity: plan.quantity, price, orderId, counterpartOrderId, createdAt }));
      transactionsCount++;

      const botTxType = plan.type === TokenTransactionType.CREDIT ? TokenTransactionType.DEBIT : TokenTransactionType.CREDIT;
      await this.tokenTransactions.save(TokenTransaction.create({ id: randomUUID(), userId: bot.id, type: botTxType, playerId: player.id, quantity: plan.quantity, price, orderId: counterpartOrderId, counterpartOrderId: orderId, createdAt }));

      const current = adminHoldingsQty.get(player.id) ?? 0;
      adminHoldingsQty.set(player.id, Math.max(0, plan.type === TokenTransactionType.CREDIT ? current + plan.quantity : current - plan.quantity));
    }

    let holdingsCount = 0;
    for (const [playerId, quantity] of adminHoldingsQty.entries()) {
      if (quantity > 0) {
        await this.saveHoldingQuantity(admin.id, playerId, quantity);
        holdingsCount++;
      }
    }

    return { transactionsCount, holdingsCount };
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
      return Order.restore({
        id: randomUUID(),
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
    for (const o of orders) {
      await this.orders.save(o);
    }
    return orders.length;
  }

  private async seedMarketBook(
    bots: User[],
    simPlayers: Player[],
    refPrices: Map<string, number>,
    tDate: (daysAgo: number) => Date,
  ): Promise<number> {
    let count = 0;
    for (const player of simPlayers) {
      const base = refPrices.get(player.id) ?? FALLBACK_REFERENCE_PRICE;

      for (const bot of bots) {
        await this.saveHoldingQuantity(bot.id, player.id, BOT_INITIAL_HOLDING);
      }

      for (const level of MARKET_BOOK_LEVELS) {
        await this.orders.save(
          Order.restore({
            id: randomUUID(),
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
        count++;
      }
    }
    return count;
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
    const strategyId = selectedStrategy ? selectedStrategy.id : randomUUID();

    const quotesToSave: PlayerQuote[] = [];
    const quotesSummary: SimulatedQuoteDto[] = [];
    const latestQuoteByPlayer: PlayerQuote[] = [];

    for (const player of activePlayers) {
      const currentPrice = refPrices.get(player.id) ?? FALLBACK_REFERENCE_PRICE;
      let latestQuote: PlayerQuote | null = null;
      for (const step of QUOTE_HISTORY_STEPS) {
        const quoteValue = roundToTwoDecimals(currentPrice * step.factor);
        const quote = PlayerQuote.create({ id: randomUUID(), userId: adminId, playerId: player.id, strategyId, weightSnapshot: { rating: 1.0, goals: 1.0 }, factorEscalaSnapshot: 1.0, score: roundToTwoDecimals(quoteValue / 10), value: quoteValue, calculatedAt: tDate(step.daysAgo), appliedPosition: player.position });
        quotesToSave.push(quote);
        latestQuote = quote;
      }
      quotesSummary.push({ playerId: player.id, playerName: player.name, value: latestQuote!.value });
      latestQuoteByPlayer.push(latestQuote!);
    }
    await this.playerQuotes.saveMany(quotesToSave);

    for (const quote of latestQuoteByPlayer) {
      await this.eventEmitter.emitAsync(
        QUOTE_RECALCULATED_EVENT,
        new QuoteRecalculatedEvent(quote.userId, quote.playerId, quote.value, quote.calculatedAt),
      );
    }

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

    const now = new Date();
    const belowPlayer = simPlayers[0];
    const belowPrice = refPrices.get(belowPlayer.id) ?? FALLBACK_REFERENCE_PRICE;
    const alertsToCreate: PriceAlert[] = [
      PriceAlert.create({
        id: randomUUID(),
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
          id: randomUUID(),
          userId: adminId,
          playerId: abovePlayer.id,
          condition: AlertCondition.PRICE_ABOVE,
          targetValue: roundToTwoDecimals(abovePrice * DEMO_ALERT_ABOVE_FACTOR),
          createdAt: now,
        }),
      );
    }

    for (const alert of alertsToCreate) {
      await this.priceAlerts.save(alert);
    }
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
      admin = User.register(randomUUID(), email, hash, new Date(), UserRole.ADMIN, 'admin');
      await this.users.save(admin);
      await this.strategyProvisioning.provisionDefaultStrategiesFor(admin.id);
    }

    return admin;
  }

  private async ensureBots(): Promise<User[]> {
    const bots: User[] = [];
    const botPassword = this.config.get<string>('BOT_PASSWORD') ?? 'BotSecurePass123!';
    const botPasswordHash = await this.hasher.hash(botPassword);

    for (const cfg of DEFAULT_BOTS) {
      const email = Email.create(cfg.email);
      let bot = await this.users.findByEmail(email);
      if (!bot) {
        bot = User.register(randomUUID(), email, botPasswordHash, new Date(), UserRole.USER, cfg.username);
        await this.users.save(bot);
        await this.strategyProvisioning.provisionDefaultStrategiesFor(bot.id);
      }
      bots.push(bot);
    }

    return bots;
  }
}

