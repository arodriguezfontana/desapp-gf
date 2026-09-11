import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
