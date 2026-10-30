import { ConfigModule } from '@nestjs/config';
import { RuntimeModule } from '../../modules/runtime/runtime.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';
import {
  JWT_EXPIRES_IN_SECONDS,
  PASSWORD_HASHER,
  TOKEN_ISSUER,
} from '../../modules/auth/auth.constants';
import { BcryptPasswordHasher } from '../../adapters/auth/bcrypt-password-hasher';
import { JwtTokenIssuer } from '../../adapters/auth/jwt-token-issuer';
import { InvalidCredentialsError } from '../../domain/auth/errors/invalid-credentials.error';
import { UserEntity } from '../../repositories/auth/entities/user.entity';
import { UserMapper } from '../../repositories/auth/mappers/user.mapper';
import { UserRepository } from '../../repositories/auth/user.repository';
import { ValuationStrategyEntity } from '../../repositories/quotation/entities/valuation-strategy.entity';
import { ValuationStrategyMapper } from '../../repositories/quotation/valuation-strategy.mapper';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import { UserStrategyProvisioningService } from '../quotation/user-strategy-provisioning.service';
import { AuthService } from './auth.service';

describe('AuthService.login (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let service: AuthService;
  let dataSource: DataSource;
  let jwt: JwtService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        RuntimeModule,
        DatabaseModule,
        TypeOrmModule.forFeature([UserEntity, ValuationStrategyEntity]),
        JwtModule.register({ secret: 'integration-secret' }),
      ],
      providers: [
        AuthService,
        UserMapper,
        ValuationStrategyMapper,
        UserStrategyProvisioningService,
        UserRepository,
        { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
        { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
        ValuationStrategyRepository,
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    dataSource = moduleRef.get(DataSource);
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(ValuationStrategyEntity).clear();
    await dataSource.getRepository(UserEntity).clear();
    await service.register('ana@mail.com', 'Abcd1234!');
  });

  it('devuelve un JWT válido por 24 h con credenciales correctas', async () => {
    const token = await service.login('ana@mail.com', 'Abcd1234!');
    const decoded = jwt.decode(token) as { sub: string; iat: number; exp: number };

    expect(decoded.exp - decoded.iat).toBe(JWT_EXPIRES_IN_SECONDS);
    expect(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'sub']);
  });

  it('email inexistente y contraseña incorrecta lanzan el mismo error', async () => {
    const e1 = await service
      .login('nadie@mail.com', 'Abcd1234!')
      .catch((e: unknown) => e);
    const e2 = await service
      .login('ana@mail.com', 'Otra9$xyz')
      .catch((e: unknown) => e);

    expect(e1).toBeInstanceOf(InvalidCredentialsError);
    expect(e2).toBeInstanceOf(InvalidCredentialsError);
    expect((e1 as Error).message).toBe((e2 as Error).message);
  });
});
