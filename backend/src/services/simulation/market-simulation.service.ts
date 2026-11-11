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
import { TokenHolding } from '../../domain/portfolio/token-holding';
import { QuoteRecalculatedEvent, QUOTE_RECALCULATED_EVENT } from '../../domain/alerts/events/quote-recalculated.event';
import { QuotationService } from '../quotation/quotation.service';
import { StrategyProvisioningService } from '../quotation/strategy-provisioning.service';
import { roundToTwoDecimals } from '../../shared/numbers/round2';
import { SimulationResultDto, SimulatedQuoteDto } from '../../controllers/simulation/dto/simulation-result.dto';
import {
  buildDateHelper,
  DEFAULT_BOTS,
  FALLBACK_REFERENCE_PRICE,
  MAX_SIMULATED_PLAYERS,
  MIN_REFERENCE_PRICE,
} from './simulation-plans';
import { buildAdminOrders, buildDemoAlerts, buildMarketBook, buildQuoteHistory, buildTradeSeed } from './simulation-seeds';

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
    const { orders, transactions, adminHoldings } = buildTradeSeed({
      adminId: admin.id,
      bots,
      simPlayers,
      refPrices,
      dateAgo: tDate,
      newId: () => this.ids.generate(),
    });

    // Las transacciones referencian a las órdenes (FK): primero las órdenes.
    await Promise.all(orders.map((order) => this.orders.save(order)));
    await Promise.all(transactions.map((tx) => this.tokenTransactions.save(tx)));
    await Promise.all(adminHoldings.map((h) => this.saveHoldingQuantity(h.userId, h.playerId, h.quantity)));

    // Cada operación del admin deja dos asientos (el suyo y el de su bot); se cuenta una por plan.
    return { transactionsCount: transactions.length / 2, holdingsCount: adminHoldings.length };
  }

  private async seedAdminOrders(
    adminId: string,
    simPlayers: Player[],
    refPrices: Map<string, number>,
    tDate: (daysAgo: number) => Date,
  ): Promise<number> {
    const orders = buildAdminOrders({ adminId, simPlayers, refPrices, dateAgo: tDate, newId: () => this.ids.generate() });
    await Promise.all(orders.map((order) => this.orders.save(order)));
    return orders.length;
  }

  private async seedMarketBook(
    bots: User[],
    simPlayers: Player[],
    refPrices: Map<string, number>,
    tDate: (daysAgo: number) => Date,
  ): Promise<number> {
    const { orders, botHoldings } = buildMarketBook({
      bots,
      simPlayers,
      refPrices,
      dateAgo: tDate,
      newId: () => this.ids.generate(),
    });

    await Promise.all(botHoldings.map((h) => this.saveHoldingQuantity(h.userId, h.playerId, h.quantity)));
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

    const { quotes, latest } = buildQuoteHistory({
      adminId,
      activePlayers,
      refPrices,
      strategyId,
      dateAgo: tDate,
      newId: () => this.ids.generate(),
    });
    await this.playerQuotes.saveMany(quotes);

    await Promise.all(
      latest.map((quote) =>
        this.eventEmitter.emitAsync(
          QUOTE_RECALCULATED_EVENT,
          new QuoteRecalculatedEvent(quote.userId, quote.playerId, quote.value, quote.calculatedAt),
        ),
      ),
    );

    const quotesSummary = latest.map((quote, index) => ({
      playerId: quote.playerId,
      playerName: activePlayers[index].name,
      value: quote.value,
    }));
    return { quotesCount: quotes.length, quotesSummary };
  }

  /**
   * Siembra, solo la primera vez, dos `PriceAlert` de demo del admin (ver `buildDemoAlerts`): una
   * `PRICE_BELOW` y una `PRICE_ABOVE` sobre dos jugadores distintos de los que tienen actividad de
   * mercado simulada, para que el recálculo simulado dispare el flujo real de alertas.
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

    const alerts = buildDemoAlerts({
      adminId,
      simPlayers,
      refPrices,
      now: this.clock.now(),
      newId: () => this.ids.generate(),
    });
    await Promise.all(alerts.map((alert) => this.priceAlerts.save(alert)));
    return alerts.length;
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

