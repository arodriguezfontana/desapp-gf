import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { USER_REPOSITORY, PASSWORD_HASHER } from '../../modules/auth/auth.constants';
import { PLAYER_REPOSITORY } from '../../modules/player/player.constants';
import { ORDER_REPOSITORY, TOKEN_TRANSACTION_REPOSITORY } from '../../modules/orders/orders.constants';
import { TOKEN_HOLDING_REPOSITORY } from '../../modules/portfolio/portfolio.constants';
import { PLAYER_QUOTE_REPOSITORY, VALUATION_STRATEGY_REPOSITORY } from '../../modules/quotation/quotation.constants';

import { UserRepository } from '../../repositories/auth/user.repository';
import { PasswordHasher } from '../../adapters/auth/password-hasher';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { OrderRepository } from '../../repositories/orders/order.repository';
import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import { PlayerQuoteRepository } from '../../repositories/quotation/player-quote.repository';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';

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
import { QuotationService } from '../quotation/quotation.service';
import { UserStrategyProvisioningService } from '../auth/user-strategy-provisioning.service';
import { roundToTwoDecimals } from '../../shared/numbers/round2';
import { SimulationResultDto } from '../../controllers/admin/dto/simulation-result.dto';

interface BotConfig {
  email: string;
  username: string;
}

const DEFAULT_BOTS: BotConfig[] = [
  { email: 'bot_liquidity_1@desapp.com', username: 'LiquidityBot' },
  { email: 'bot_trader_2@desapp.com', username: 'AlphaTraderBot' },
  { email: 'bot_whale_3@desapp.com', username: 'WhaleInvestorBot' },
];

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
    private readonly quotation: QuotationService,
    private readonly strategyProvisioning: UserStrategyProvisioningService,
    private readonly config: ConfigService,
  ) {}

  async simulate(targetEmail?: string): Promise<SimulationResultDto> {
    const adminEmailStr = targetEmail ?? this.config.get<string>('ADMIN_EMAIL') ?? 'abi_admin@ejemplo.com';
    this.logger.log(`Iniciando simulación de mercado para ${adminEmailStr}...`);

    // 1. Resolver usuario admin
    const admin = await this.ensureAdminUser(adminEmailStr);

    // 2. Resolver bots de contraparte para el mercado
    const bots = await this.ensureBots();

    // 3. Obtener jugadores activos del catálogo
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
      };
    }

    const simPlayers = activePlayers.slice(0, Math.min(6, activePlayers.length));
    const playerNames = simPlayers.map((p) => p.name);

    // 4. Calcular precio de referencia para cada jugador
    const refPrices = new Map<string, number>();
    for (const player of simPlayers) {
      try {
        const val = await this.quotation.valuate(admin.id, player.id);
        refPrices.set(player.id, Math.max(5, roundToTwoDecimals(val.value)));
      } catch {
        refPrices.set(player.id, 20.0);
      }
    }

    // 5. Generar transacciones históricas de compra y venta para el admin (y contrapartes)
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const tDate = (daysAgo: number, hoursAgo = 0) => new Date(now - daysAgo * dayMs - hoursAgo * 3600 * 1000);

    let transactionsCount = 0;
    const adminHoldingsQty = new Map<string, number>();

    interface TxPlan {
      playerIdx: number;
      type: TokenTransactionType;
      quantity: number;
      priceFactor: number;
      daysAgo: number;
      botIdx: number;
    }

    const txPlans: TxPlan[] = [
      // Jugador 0
      { playerIdx: 0, type: TokenTransactionType.CREDIT, quantity: 30, priceFactor: 0.9, daysAgo: 13, botIdx: 0 },
      { playerIdx: 0, type: TokenTransactionType.DEBIT, quantity: 10, priceFactor: 1.05, daysAgo: 4, botIdx: 1 },
      { playerIdx: 0, type: TokenTransactionType.CREDIT, quantity: 5, priceFactor: 1.0, daysAgo: 0, botIdx: 2 },
      // Jugador 1
      { playerIdx: 1, type: TokenTransactionType.CREDIT, quantity: 40, priceFactor: 0.85, daysAgo: 11, botIdx: 1 },
      { playerIdx: 1, type: TokenTransactionType.DEBIT, quantity: 10, priceFactor: 1.1, daysAgo: 6, botIdx: 0 },
      // Jugador 2
      { playerIdx: 2, type: TokenTransactionType.CREDIT, quantity: 25, priceFactor: 0.92, daysAgo: 9, botIdx: 0 },
      { playerIdx: 2, type: TokenTransactionType.CREDIT, quantity: 15, priceFactor: 1.02, daysAgo: 3, botIdx: 2 },
      // Jugador 3
      { playerIdx: 3, type: TokenTransactionType.CREDIT, quantity: 35, priceFactor: 0.88, daysAgo: 8, botIdx: 2 },
      { playerIdx: 3, type: TokenTransactionType.DEBIT, quantity: 10, priceFactor: 1.15, daysAgo: 2, botIdx: 1 },
    ];

    if (simPlayers.length > 4) {
      txPlans.push(
        { playerIdx: 4, type: TokenTransactionType.CREDIT, quantity: 20, priceFactor: 0.95, daysAgo: 5, botIdx: 0 },
        { playerIdx: 4, type: TokenTransactionType.CREDIT, quantity: 10, priceFactor: 1.05, daysAgo: 1, botIdx: 1 },
      );
    }
    if (simPlayers.length > 5) {
      txPlans.push(
        { playerIdx: 5, type: TokenTransactionType.CREDIT, quantity: 15, priceFactor: 0.94, daysAgo: 7, botIdx: 2 },
      );
    }

    for (const plan of txPlans) {
      const player = simPlayers[plan.playerIdx];
      const bot = bots[plan.botIdx % bots.length];
      const refPrice = refPrices.get(player.id) ?? 20.0;
      const price = roundToTwoDecimals(refPrice * plan.priceFactor);
      const createdAt = tDate(plan.daysAgo);

      const orderId = randomUUID();
      const counterpartOrderId = randomUUID();

      // Transacción del admin
      const adminTx = TokenTransaction.create({
        id: randomUUID(),
        userId: admin.id,
        type: plan.type,
        playerId: player.id,
        quantity: plan.quantity,
        price,
        orderId,
        counterpartOrderId,
        createdAt,
      });
      await this.tokenTransactions.save(adminTx);
      transactionsCount++;

      // Transacción de contraparte del bot
      const botTxType = plan.type === TokenTransactionType.CREDIT ? TokenTransactionType.DEBIT : TokenTransactionType.CREDIT;
      const botTx = TokenTransaction.create({
        id: randomUUID(),
        userId: bot.id,
        type: botTxType,
        playerId: player.id,
        quantity: plan.quantity,
        price,
        orderId: counterpartOrderId,
        counterpartOrderId: orderId,
        createdAt,
      });
      await this.tokenTransactions.save(botTx);

      // Calcular cantidad acumulada de holdings
      const current = adminHoldingsQty.get(player.id) ?? 0;
      const next = plan.type === TokenTransactionType.CREDIT ? current + plan.quantity : current - plan.quantity;
      adminHoldingsQty.set(player.id, Math.max(0, next));
    }

    // 6. Persistir holdings exactos del admin
    let holdingsCount = 0;
    for (const [playerId, quantity] of adminHoldingsQty.entries()) {
      if (quantity > 0) {
        const existingHolding = await this.holdings.findByUserAndPlayer(admin.id, playerId);
        const holding = existingHolding
          ? TokenHolding.restore({
              id: existingHolding.id,
              userId: admin.id,
              playerId,
              quantity,
              updatedAt: new Date(),
            })
          : TokenHolding.restore({
              id: randomUUID(),
              userId: admin.id,
              playerId,
              quantity,
              updatedAt: new Date(),
            });
        await this.holdings.save(holding);
        holdingsCount++;
      }
    }

    // 7. Generar órdenes del admin ("Mis Órdenes" en los 4 estados)
    let adminOrdersCount = 0;

    // A. Orden PENDING (COMPRA)
    const pBuy = simPlayers[simPlayers.length - 1];
    const pBuyPrice = roundToTwoDecimals((refPrices.get(pBuy.id) ?? 20) * 0.95);
    const orderPending = Order.restore({
      id: randomUUID(),
      userId: admin.id,
      playerId: pBuy.id,
      side: OrderSide.BUY,
      quantity: 15,
      remainingQuantity: 15,
      price: pBuyPrice,
      createdAt: tDate(1),
      status: OrderStatus.PENDING,
    });
    await this.orders.save(orderPending);
    adminOrdersCount++;

    // B. Orden PARTIALLY_FILLED (VENTA)
    const pPart = simPlayers[0];
    const pPartPrice = roundToTwoDecimals((refPrices.get(pPart.id) ?? 20) * 1.12);
    const orderPartial = Order.restore({
      id: randomUUID(),
      userId: admin.id,
      playerId: pPart.id,
      side: OrderSide.SELL,
      quantity: 10,
      remainingQuantity: 5,
      price: pPartPrice,
      createdAt: tDate(2),
      status: OrderStatus.PARTIALLY_FILLED,
    });
    await this.orders.save(orderPartial);
    adminOrdersCount++;

    // C. Orden COMPLETED (COMPRA)
    const pComp = simPlayers[1];
    const pCompPrice = roundToTwoDecimals((refPrices.get(pComp.id) ?? 20) * 0.85);
    const orderCompleted = Order.restore({
      id: randomUUID(),
      userId: admin.id,
      playerId: pComp.id,
      side: OrderSide.BUY,
      quantity: 40,
      remainingQuantity: 0,
      price: pCompPrice,
      createdAt: tDate(11),
      status: OrderStatus.COMPLETED,
    });
    await this.orders.save(orderCompleted);
    adminOrdersCount++;

    // D. Orden CANCELLED (VENTA)
    const pCanc = simPlayers[2];
    const pCancPrice = roundToTwoDecimals((refPrices.get(pCanc.id) ?? 20) * 1.3);
    const orderCancelled = Order.restore({
      id: randomUUID(),
      userId: admin.id,
      playerId: pCanc.id,
      side: OrderSide.SELL,
      quantity: 10,
      remainingQuantity: 10,
      price: pCancPrice,
      createdAt: tDate(7),
      status: OrderStatus.CANCELLED,
    });
    await this.orders.save(orderCancelled);
    adminOrdersCount++;

    // 8. Proveer liquidez de mercado L2 (Bids y Asks activos en Order Book)
    let marketOrdersCount = 0;
    for (const player of simPlayers) {
      const base = refPrices.get(player.id) ?? 20.0;
      const bot1 = bots[0];
      const bot2 = bots[1];
      const bot3 = bots[2];

      // Proveer holdings a los bots para que puedan vender sin inconsistencias
      for (const bot of bots) {
        const existingBotHolding = await this.holdings.findByUserAndPlayer(bot.id, player.id);
        const botHolding = existingBotHolding
          ? TokenHolding.restore({
              id: existingBotHolding.id,
              userId: bot.id,
              playerId: player.id,
              quantity: 250,
              updatedAt: new Date(),
            })
          : TokenHolding.restore({
              id: randomUUID(),
              userId: bot.id,
              playerId: player.id,
              quantity: 250,
              updatedAt: new Date(),
            });
        await this.holdings.save(botHolding);
      }

      // 3 niveles de Bids (BUY)
      const bids = [
        { bot: bot1, qty: 20, price: roundToTwoDecimals(base * 0.98), age: 3 },
        { bot: bot2, qty: 35, price: roundToTwoDecimals(base * 0.95), age: 4 },
        { bot: bot3, qty: 50, price: roundToTwoDecimals(base * 0.91), age: 5 },
      ];
      for (const bid of bids) {
        const o = Order.restore({
          id: randomUUID(),
          userId: bid.bot.id,
          playerId: player.id,
          side: OrderSide.BUY,
          quantity: bid.qty,
          remainingQuantity: bid.qty,
          price: bid.price,
          createdAt: tDate(bid.age),
          status: OrderStatus.PENDING,
        });
        await this.orders.save(o);
        marketOrdersCount++;
      }

      // 3 niveles de Asks (SELL)
      const asks = [
        { bot: bot1, qty: 15, price: roundToTwoDecimals(base * 1.02), age: 2 },
        { bot: bot2, qty: 30, price: roundToTwoDecimals(base * 1.06), age: 3 },
        { bot: bot3, qty: 60, price: roundToTwoDecimals(base * 1.1), age: 4 },
      ];
      for (const ask of asks) {
        const o = Order.restore({
          id: randomUUID(),
          userId: ask.bot.id,
          playerId: player.id,
          side: OrderSide.SELL,
          quantity: ask.qty,
          remainingQuantity: ask.qty,
          price: ask.price,
          createdAt: tDate(ask.age),
          status: OrderStatus.PENDING,
        });
        await this.orders.save(o);
        marketOrdersCount++;
      }
    }

    // 9. Generar cotizaciones históricas del admin para los gráficos de detalle de jugadores
    let quotesCount = 0;
    const adminStrategies = await this.strategies.findByUserId(admin.id);
    const selectedStrategy = adminStrategies.find((s) => s.isSelected) ?? adminStrategies[0];
    const strategyId = selectedStrategy ? selectedStrategy.id : randomUUID();

    const quotesToSave: PlayerQuote[] = [];
    for (const player of simPlayers) {
      const currentPrice = refPrices.get(player.id) ?? 20.0;
      // 5 puntos en el tiempo: 25 días atrás, 20, 15, 10, 5
      const intervals = [
        { daysAgo: 25, factor: 0.82 },
        { daysAgo: 20, factor: 0.87 },
        { daysAgo: 15, factor: 0.91 },
        { daysAgo: 10, factor: 0.96 },
        { daysAgo: 5, factor: 0.99 },
      ];

      for (const step of intervals) {
        const quoteValue = roundToTwoDecimals(currentPrice * step.factor);
        quotesToSave.push(
          PlayerQuote.create({
            id: randomUUID(),
            userId: admin.id,
            playerId: player.id,
            strategyId,
            weightSnapshot: { rating: 1.0, goals: 1.0 },
            factorEscalaSnapshot: 1.0,
            score: roundToTwoDecimals(quoteValue / 10),
            value: quoteValue,
            calculatedAt: tDate(step.daysAgo),
            appliedPosition: player.position,
          }),
        );
        quotesCount++;
      }
    }
    await this.playerQuotes.saveMany(quotesToSave);

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
      playersInvolved: playerNames,
    };
  }

  private async ensureAdminUser(emailStr: string): Promise<User> {
    const email = Email.create(emailStr);
    let admin = await this.users.findByEmail(email);

    if (!admin) {
      const rawPassword = this.config.get<string>('ADMIN_PASSWORD') ?? 'Abrilrz1!';
      const hash = await this.hasher.hash(rawPassword);
      admin = User.register(randomUUID(), email, hash, new Date(), UserRole.ADMIN, 'admin');
      await this.users.save(admin);
    }

    await this.strategyProvisioning.provisionDefaultStrategiesFor(admin.id);
    return admin;
  }

  private async ensureBots(): Promise<User[]> {
    const bots: User[] = [];
    const botPasswordHash = await this.hasher.hash('BotSecurePass123!');

    for (const cfg of DEFAULT_BOTS) {
      const email = Email.create(cfg.email);
      let bot = await this.users.findByEmail(email);
      if (!bot) {
        bot = User.register(randomUUID(), email, botPasswordHash, new Date(), UserRole.USER, cfg.username);
        await this.users.save(bot);
      }
      await this.strategyProvisioning.provisionDefaultStrategiesFor(bot.id);
      bots.push(bot);
    }

    return bots;
  }
}
