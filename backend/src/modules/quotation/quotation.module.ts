import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyModule } from '../api-key/api-key.module';
import { PlayerModule } from '../player/player.module';
import { AdminApiKeyGuard } from '../../guards/api-key/admin-api-key.guard';
import { ApiKeyGuard } from '../../guards/api-key/api-key.guard';
import { QuotationController } from '../../controllers/quotation/quotation.controller';
import { ValuationStrategyEntity } from '../../repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../repositories/quotation/entities/player-quote.entity';
import { ValuationStrategyMapper } from '../../repositories/quotation/valuation-strategy.mapper';
import { PlayerQuoteMapper } from '../../repositories/quotation/player-quote.mapper';
import { TypeOrmValuationStrategyRepository } from '../../repositories/quotation/typeorm-valuation-strategy.repository';
import { TypeOrmPlayerQuoteRepository } from '../../repositories/quotation/typeorm-player-quote.repository';
import { QuotationService } from '../../services/quotation/quotation.service';
import { QuotationJob } from '../../services/quotation/quotation.job';
import {
  VALUATION_STRATEGY_REPOSITORY,
  PLAYER_QUOTE_REPOSITORY,
} from './quotation.constants';

@Module({
  imports: [
    PlayerModule,
    ApiKeyModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ValuationStrategyEntity, PlayerQuoteEntity]),
  ],
  controllers: [QuotationController],
  providers: [
    QuotationService,
    QuotationJob,
    AdminApiKeyGuard,
    ApiKeyGuard,
    ValuationStrategyMapper,
    PlayerQuoteMapper,
    { provide: VALUATION_STRATEGY_REPOSITORY, useClass: TypeOrmValuationStrategyRepository },
    { provide: PLAYER_QUOTE_REPOSITORY, useClass: TypeOrmPlayerQuoteRepository },
  ],
})
export class QuotationModule {}
