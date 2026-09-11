import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../../database/database.module';
import {
  JWT_EXPIRES_IN_SECONDS,
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  USER_REPOSITORY,
} from '../auth.constants';
import { BcryptPasswordHasher } from '../adapters/bcrypt-password-hasher';
import { JwtTokenIssuer } from '../adapters/jwt-token-issuer';
import { InvalidCredentialsError } from '../domain/errors/invalid-credentials.error';
import { UserEntity } from '../repository/entities/user.entity';
import { UserMapper } from '../repository/mappers/user.mapper';
import { TypeOrmUserRepository } from '../repository/typeorm-user.repository';
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
        DatabaseModule,
        TypeOrmModule.forFeature([UserEntity]),
        JwtModule.register({ secret: 'integration-secret' }),
      ],
      providers: [
        AuthService,
        UserMapper,
        { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
        { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
        { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
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
