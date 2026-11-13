import { forwardRef, Module } from '@nestjs/common';
import { RuntimeModule } from '../runtime/runtime.module';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { PlayerModule } from '../player/player.module';
import { OrdersModule } from '../orders/orders.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { QuotationModule } from '../quotation/quotation.module';
import { AlertsModule } from '../alerts/alerts.module';
import { SimulationController } from '../../controllers/simulation/simulation.controller';
import { MarketSimulationService } from '../../services/simulation/market-simulation.service';
import { AdminAccessGuard } from '../../guards/auth/admin-access.guard';

@Module({
  imports: [
    RuntimeModule,
    forwardRef(() => AuthModule),
    forwardRef(() => ApiKeyModule),
    forwardRef(() => PlayerModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => PortfolioModule),
    forwardRef(() => QuotationModule),
    forwardRef(() => AlertsModule),
  ],
  controllers: [SimulationController],
  providers: [MarketSimulationService, AdminAccessGuard],
  exports: [MarketSimulationService],
})
export class SimulationModule {}

