import { forwardRef, Module } from '@nestjs/common';
import { RuntimeModule } from '../runtime/runtime.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyModule } from '../api-key/api-key.module';
import { PlayerModule } from '../player/player.module';
import { QuotationController } from '../../controllers/quotation/quotation.controller';
import { UserStrategyController } from '../../controllers/user-strategy/user-strategy.controller';
import { ValuationStrategyEntity } from '../../repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../repositories/quotation/entities/player-quote.entity';
import { ValuationStrategyMapper } from '../../repositories/quotation/valuation-strategy.mapper';
import { PlayerQuoteMapper } from '../../repositories/quotation/player-quote.mapper';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import { PlayerQuoteRepository } from '../../repositories/quotation/player-quote.repository';
import { QuotationService } from '../../services/quotation/quotation.service';
import { UserStrategyProvisioningService } from '../../services/quotation/user-strategy-provisioning.service';

/**
 * Estrategias de valuación propias por usuario y recálculo de cotizaciones
 * (019-per-user-valuation-strategies). El recálculo puede dispararlo un
 * administrador a mano (`POST /quotes/recalculate`) o el `@Cron` semanal de
 * `QuotationService` (019, FR-016); ambos comparten el mismo método y el mismo
 * lock de sistema. `ScheduleModule` registra ese cron.
 */
@Module({
  imports: [
    RuntimeModule,
    forwardRef(() => PlayerModule),
    forwardRef(() => ApiKeyModule),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ValuationStrategyEntity, PlayerQuoteEntity]),
  ],
  controllers: [QuotationController, UserStrategyController],
  providers: [
    QuotationService,
    UserStrategyProvisioningService,
    ValuationStrategyMapper,
    PlayerQuoteMapper,
    ValuationStrategyRepository,
    PlayerQuoteRepository,
  ],
  exports: [
    QuotationService,
    UserStrategyProvisioningService,
    PlayerQuoteRepository,
    ValuationStrategyRepository,
  ],
})
export class QuotationModule {}
