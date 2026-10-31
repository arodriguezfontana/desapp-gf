import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { PlayerModule } from './modules/player/player.module';
import { PlayerSyncModule } from './modules/player-sync/player-sync.module';
import { FootballDataSyncModule } from './modules/competition/football-data-sync.module';
import { TeamCrosswalkModule } from './modules/competition/team-crosswalk.module';
import { TeamCrosswalkSyncModule } from './modules/competition/team-crosswalk-sync.module';
import { QuotationModule } from './modules/quotation/quotation.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { OrdersModule } from './modules/orders/orders.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    ApiKeyModule,
    PlayerModule,
    PlayerSyncModule,
    FootballDataSyncModule,
    TeamCrosswalkModule,
    TeamCrosswalkSyncModule,
    QuotationModule,
    PortfolioModule,
    OrdersModule,
    SimulationModule,
    AlertsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
