import { forwardRef, Module } from '@nestjs/common';
import { RuntimeModule } from '../runtime/runtime.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

import {
  JWT_EXPIRES_IN,
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  USER_REPOSITORY,
} from './auth.constants';
import { AuthController } from '../../controllers/auth/auth.controller';
import { AuthService } from '../../services/auth/auth.service';
import { AdminSeedService } from '../../services/auth/admin-seed.service';
import { SuperuserSeedService } from '../../services/auth/superuser-seed.service';
import { UserEntity } from '../../repositories/auth/entities/user.entity';
import { UserMapper } from '../../repositories/auth/mappers/user.mapper';
import { TypeOrmUserRepository } from '../../repositories/auth/typeorm-user.repository';
import { BcryptPasswordHasher } from '../../adapters/auth/bcrypt-password-hasher';
import { JwtTokenIssuer } from '../../adapters/auth/jwt-token-issuer';
import { JwtAuthGuard } from '../../guards/auth/jwt-auth.guard';
import { QuotationModule } from '../quotation/quotation.module';
import { PlayerModule } from '../player/player.module';
import { OrdersModule } from '../orders/orders.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [
    RuntimeModule,
    TypeOrmModule.forFeature([UserEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: JWT_EXPIRES_IN },
      }),
    }),
    // Provisioning de las dos estrategias por defecto al alta/seed
    // (019-per-user-valuation-strategies, research.md D3).
    forwardRef(() => QuotationModule),
    // SuperuserSeedService (020-order-matching-engine, research.md D3) necesita
    // PLAYER_REPOSITORY, ORDER_REPOSITORY y TOKEN_HOLDING_REPOSITORY.
    forwardRef(() => PlayerModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => PortfolioModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminSeedService,
    SuperuserSeedService,
    UserMapper,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  // AuthService se exporta para que ApiKeyModule resuelva el User emisor (spec 008, R2).
  exports: [AuthService, USER_REPOSITORY, PASSWORD_HASHER, TOKEN_ISSUER],
})
export class AuthModule {}
