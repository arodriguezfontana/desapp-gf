import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { PlayerModule } from '../player/player.module';
import { OrdersModule } from '../orders/orders.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { QuotationModule } from '../quotation/quotation.module';
import { AdminSimulationController } from '../../controllers/admin/admin-simulation.controller';
import { MarketSimulationService } from '../../services/admin/market-simulation.service';
import { AdminAccessGuard } from '../../guards/auth/admin-access.guard';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => ApiKeyModule),
    forwardRef(() => PlayerModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => PortfolioModule),
    forwardRef(() => QuotationModule),
  ],
  controllers: [AdminSimulationController],
  providers: [MarketSimulationService, AdminAccessGuard],
  exports: [MarketSimulationService],
})
export class AdminModule {}

