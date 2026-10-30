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
import { TypeOrmOrderRepository } from '../../repositories/orders/typeorm-order.repository';
import { TypeOrmTokenTransactionRepository } from '../../repositories/orders/typeorm-token-transaction.repository';
import { TypeOrmTransactionManager } from '../../repositories/shared/typeorm-transaction-manager';
import { OrdersService } from '../../services/orders/orders.service';

import { ORDER_REPOSITORY, TOKEN_TRANSACTION_REPOSITORY, TRANSACTION_MANAGER } from './orders.constants';

/**
 * 020-order-matching-engine. `forwardRef` hacia `PlayerModule`/`QuotationModule`/
 * `PortfolioModule` porque esos modulos (via `AuthModule`) terminan
 * necesitando referenciar este mismo modulo de forma indirecta
 * (`SuperuserSeedService` vive en `AuthModule` y necesita `ORDER_REPOSITORY`/
 * `TOKEN_HOLDING_REPOSITORY`) — mismo patron de ciclos ya resuelto en el
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
    { provide: ORDER_REPOSITORY, useClass: TypeOrmOrderRepository },
    { provide: TOKEN_TRANSACTION_REPOSITORY, useClass: TypeOrmTokenTransactionRepository },
    { provide: TRANSACTION_MANAGER, useClass: TypeOrmTransactionManager },
  ],
  exports: [OrdersService, ORDER_REPOSITORY, TOKEN_TRANSACTION_REPOSITORY],
})
export class OrdersModule {}
