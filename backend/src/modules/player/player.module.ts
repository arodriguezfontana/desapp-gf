import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyModule } from '../api-key/api-key.module';
import { TeamCrosswalkModule } from '../competition/team-crosswalk.module';
import { QuotationModule } from '../quotation/quotation.module';
import { OrdersModule } from '../orders/orders.module';
import { ApiKeyGuard } from '../../guards/api-key/api-key.guard';
import { PlayerController } from '../../controllers/player/player.controller';
import { PlayerEntity } from '../../repositories/player/entities/player.entity';
import { PlayerMapper } from '../../repositories/player/mappers/player.mapper';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { PlayerService } from '../../services/player/player.service';
import { PlayerEnrichmentService } from '../../services/player/player-enrichment.service';
import { ParseDatePipe } from '../../controllers/player/pipes/parse-date.pipe';

@Module({
  imports: [
    ApiKeyModule,
    TypeOrmModule.forFeature([PlayerEntity]),
    TeamCrosswalkModule,
    forwardRef(() => QuotationModule),
    forwardRef(() => OrdersModule),
  ],
  controllers: [PlayerController],
  providers: [
    PlayerService,
    PlayerEnrichmentService,
    PlayerMapper,
    ApiKeyGuard,
    ParseDatePipe,
    PlayerRepository,
  ],
  exports: [PlayerRepository],
})
export class PlayerModule {}
