import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PlayerModule } from '../player/player.module';
import { QuotationModule } from '../quotation/quotation.module';
import { PortfolioController } from '../../controllers/portfolio/portfolio.controller';
import { TokenHoldingEntity } from '../../repositories/portfolio/entities/token-holding.entity';
import { TokenHoldingMapper } from '../../repositories/portfolio/mappers/token-holding.mapper';
import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import { PortfolioService } from '../../services/portfolio/portfolio.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => PlayerModule),
    forwardRef(() => QuotationModule),
    TypeOrmModule.forFeature([TokenHoldingEntity]),
  ],
  controllers: [PortfolioController],
  providers: [
    PortfolioService,
    TokenHoldingMapper,
    TokenHoldingRepository,
  ],
  exports: [PortfolioService, TokenHoldingRepository],
})
export class PortfolioModule {}
