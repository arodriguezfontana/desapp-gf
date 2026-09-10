import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../../database/database.module';
import { PASSWORD_HASHER, TOKEN_ISSUER, USER_REPOSITORY } from '../auth.constants';
import { BcryptPasswordHasher } from '../adapters/bcrypt-password-hasher';
import { EmailAlreadyInUseError } from '../domain/errors/email-already-in-use.error';
import { UserEntity } from '../repository/entities/user.entity';
import { UserMapper } from '../repository/mappers/user.mapper';
import { TypeOrmUserRepository } from '../repository/typeorm-user.repository';
import { AuthService } from './auth.service';

describe('AuthService.register (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let service: AuthService;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([UserEntity]),
      ],
      providers: [
        AuthService,
        UserMapper,
        { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
        { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
        {
          provide: TOKEN_ISSUER,
          useValue: { issue: () => 'x', verify: () => ({ userId: 'x' }) },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(UserEntity).clear();
  });

  it('persiste una cuenta nueva con la contraseña hasheada', async () => {
    const user = await service.register('Nueva@Mail.com', 'Abcd1234!');

    const row = await dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: user.id });
    expect(row.email).toBe('nueva@mail.com');
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row.passwordHash).not.toContain('Abcd1234!');
  });

  it('rechaza el alta si el email ya existe', async () => {
    await service.register('dup@mail.com', 'Abcd1234!');
    await expect(service.register('DUP@mail.com', 'Abcd1234!')).rejects.toThrow(
      EmailAlreadyInUseError,
    );
    expect(
      await dataSource.getRepository(UserEntity).countBy({ email: 'dup@mail.com' }),
    ).toBe(1);
  });

  it('ante altas concurrentes del mismo email, sólo una gana', async () => {
    const results = await Promise.allSettled([
      service.register('race@mail.com', 'Abcd1234!'),
      service.register('race@mail.com', 'Abcd1234!'),
      service.register('race@mail.com', 'Abcd1234!'),
    ]);

    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    expect(
      await dataSource.getRepository(UserEntity).countBy({ email: 'race@mail.com' }),
    ).toBe(1);
  });
});
