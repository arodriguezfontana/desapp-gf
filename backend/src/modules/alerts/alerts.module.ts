import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerModule } from '../player/player.module';
import { AlertsController } from '../../controllers/alerts/alerts.controller';
import { PriceAlertEntity } from '../../repositories/alerts/entities/price-alert.entity';
import { PriceAlertMapper } from '../../repositories/alerts/price-alert.mapper';
import { TypeOrmPriceAlertRepository } from '../../repositories/alerts/typeorm-price-alert.repository';
import { AlertsService } from '../../services/alerts/alerts.service';
import { QuoteRecalculatedListener } from '../../services/alerts/quote-recalculated.listener';
import { PRICE_ALERT_REPOSITORY } from './alerts.constants';

/**
 * Módulo de alertas de precio (025-player-price-alerts). El listener de
 * quote.recalculated vive acá: evalúa alertas y emite alert.triggered sin
 * conocer el módulo de notificaciones (spec FR-021).
 */
@Module({
  imports: [forwardRef(() => PlayerModule), TypeOrmModule.forFeature([PriceAlertEntity])],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    PriceAlertMapper,
    QuoteRecalculatedListener,
    { provide: PRICE_ALERT_REPOSITORY, useClass: TypeOrmPriceAlertRepository },
  ],
  exports: [PRICE_ALERT_REPOSITORY],
})
export class AlertsModule {}
