import { forwardRef, Module } from '@nestjs/common';
import { RuntimeModule } from '../runtime/runtime.module';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlayerModule } from '../player/player.module';
import { QuotationModule } from '../quotation/quotation.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

import { OrdersController } from '../../controllers/orders/orders.controller';
import { OrderEntity } from '../../repositories/orders/entities/order.entity';
import { TokenTransactionEntity } from '../../repositories/orders/entities/token-transaction.entity';
import { OrderMapper } from '../../repositories/orders/mappers/order.mapper';
import { TokenTransactionMapper } from '../../repositories/orders/mappers/token-transaction.mapper';
import { OrderRepository } from '../../repositories/orders/order.repository';
import { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import { TransactionManager } from '../../repositories/shared/transaction-manager';
import { OrdersService } from '../../services/orders/orders.service';


/**
 * 020-order-matching-engine. `forwardRef` hacia `PlayerModule`/`QuotationModule`/
 * `PortfolioModule` porque esos modulos (via `AuthModule`) terminan
 * necesitando referenciar este mismo modulo de forma indirecta
 * (`SuperuserSeedService` vive en `AuthModule` y necesita `OrderRepository`/
 * `TokenHoldingRepository`) — mismo patron de ciclos ya resuelto en el
 * resto del codebase (p. ej. `AuthModule` <-> `QuotationModule`).
 */
@Module({
  imports: [
    RuntimeModule,
    TypeOrmModule.forFeature([OrderEntity, TokenTransactionEntity]),
    forwardRef(() => PlayerModule),
    forwardRef(() => QuotationModule),
    forwardRef(() => PortfolioModule),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderMapper,
    TokenTransactionMapper,
    OrderRepository,
    TokenTransactionRepository,
    TransactionManager,
  ],
  exports: [OrdersService, OrderRepository, TokenTransactionRepository],
})
export class OrdersModule {}
