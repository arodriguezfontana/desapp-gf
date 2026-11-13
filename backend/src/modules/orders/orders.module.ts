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
import { PersistenceModule } from '../persistence/persistence.module';
import { OrdersService } from '../../services/orders/orders.service';


/**
 * 020-order-matching-engine. `forwardRef` hacia `PlayerModule`/`QuotationModule`/`PortfolioModule`:
 * son ciclos reales de lectura entre estos modulos (p. ej. el portafolio lee los asientos de este
 * modulo y este lee las tenencias del portafolio). `TransactionManager` llega por `PersistenceModule`
 * y el seed del superusuario vive en `SeedModule`, un modulo hoja que ya no obliga a `AuthModule`
 * a importar este modulo.
 */
@Module({
  imports: [
    RuntimeModule,
    PersistenceModule,
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
  ],
  exports: [OrdersService, OrderRepository, TokenTransactionRepository],
})
export class OrdersModule {}
