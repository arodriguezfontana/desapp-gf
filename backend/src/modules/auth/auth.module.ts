import { Module } from '@nestjs/common';
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
import { UserEntity } from '../../repositories/auth/entities/user.entity';
import { UserMapper } from '../../repositories/auth/mappers/user.mapper';
import { TypeOrmUserRepository } from '../../repositories/auth/typeorm-user.repository';
import { BcryptPasswordHasher } from '../../adapters/auth/bcrypt-password-hasher';
import { JwtTokenIssuer } from '../../adapters/auth/jwt-token-issuer';
import { JwtAuthGuard } from '../../guards/auth/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: JWT_EXPIRES_IN },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminSeedService,
    UserMapper,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  // AuthService se exporta para que ApiKeyModule resuelva el User emisor (spec 008, R2).
  exports: [AuthService],
})
export class AuthModule {}
