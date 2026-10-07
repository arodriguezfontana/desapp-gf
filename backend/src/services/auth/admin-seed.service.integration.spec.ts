import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';
import { BcryptPasswordHasher } from '../../adapters/auth/bcrypt-password-hasher';
import { PASSWORD_HASHER, USER_REPOSITORY } from '../../modules/auth/auth.constants';
import { UserEntity } from '../../repositories/auth/entities/user.entity';
import { UserMapper } from '../../repositories/auth/mappers/user.mapper';
import { TypeOrmUserRepository } from '../../repositories/auth/typeorm-user.repository';
import { AdminSeedService } from './admin-seed.service';

describe('AdminSeedService.run (integración contra Postgres real)', () => {
  const EMAIL = 'seed-admin@mail.com';
  const PASSWORD = 'Admin1234!';
  let moduleRef: TestingModule;
  let service: AdminSeedService;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([UserEntity]),
      ],
      providers: [
        AdminSeedService,
        UserMapper,
        { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
        { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
      ],
    }).compile();

    service = moduleRef.get(AdminSeedService);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(UserEntity).clear();
    process.env.ADMIN_EMAIL = EMAIL;
    process.env.ADMIN_PASSWORD = PASSWORD;
  });

  const rowsFor = () =>
    dataSource.getRepository(UserEntity).find({ where: { email: EMAIL } });

  it('arrancar dos veces con las mismas variables deja una sola cuenta admin', async () => {
    await service.run();
    await service.run();

    const rows = await rowsFor();
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('admin');
  });

  it('no resetea la contraseña de un admin existente en arranques posteriores', async () => {
    await service.run();
    const repo = dataSource.getRepository(UserEntity);
    const [before] = await rowsFor();
    await repo.update({ id: before.id }, { passwordHash: 'hash-cambiado-a-mano' });

    await service.run();

    const [after] = await rowsFor();
    expect(after.passwordHash).toBe('hash-cambiado-a-mano');
  });

  it('con arranques concurrentes deja exactamente una cuenta y no lanza', async () => {
    await expect(
      Promise.all([service.run(), service.run(), service.run()]),
    ).resolves.toBeDefined();

    expect(await rowsFor()).toHaveLength(1);
  });

  it('no promueve a admin una cuenta existente con rol user', async () => {
    await dataSource.getRepository(UserEntity).insert({
      email: EMAIL,
      passwordHash: 'hash-existente',
      role: 'user',
    });

    await service.run();

    const [row] = await rowsFor();
    expect(row.role).toBe('user');
    expect(row.passwordHash).toBe('hash-existente');
  });
});
