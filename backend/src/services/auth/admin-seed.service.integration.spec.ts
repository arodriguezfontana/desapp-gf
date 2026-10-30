import { ConfigModule } from '@nestjs/config';
import { RuntimeModule } from '../../modules/runtime/runtime.module';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';
import { BcryptPasswordHasher } from '../../adapters/auth/bcrypt-password-hasher';
import { PASSWORD_HASHER } from '../../modules/auth/auth.constants';
import { UserEntity } from '../../repositories/auth/entities/user.entity';
import { UserMapper } from '../../repositories/auth/mappers/user.mapper';
import { UserRepository } from '../../repositories/auth/user.repository';
import { ValuationStrategyEntity } from '../../repositories/quotation/entities/valuation-strategy.entity';
import { ValuationStrategyMapper } from '../../repositories/quotation/valuation-strategy.mapper';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import { UserStrategyProvisioningService } from '../quotation/user-strategy-provisioning.service';
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
        RuntimeModule,
        DatabaseModule,
        TypeOrmModule.forFeature([UserEntity, ValuationStrategyEntity]),
      ],
      providers: [
        AdminSeedService,
        UserMapper,
        ValuationStrategyMapper,
        UserStrategyProvisioningService,
        UserRepository,
        { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
        ValuationStrategyRepository,
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
    await dataSource.getRepository(ValuationStrategyEntity).clear();
    await dataSource.getRepository(UserEntity).clear();
    process.env.ADMIN_EMAIL = EMAIL;
    process.env.ADMIN_PASSWORD = PASSWORD;
  });

  const rowsFor = () =>
    dataSource.getRepository(UserEntity).find({ where: { email: EMAIL } });

  const strategiesFor = (userId: string) =>
    dataSource.getRepository(ValuationStrategyEntity).find({ where: { userId } });

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

  it('crea las dos estrategias propias del admin seedeado (019-per-user-valuation-strategies)', async () => {
    await service.run();

    const [admin] = await rowsFor();
    const strategies = await strategiesFor(admin.id);

    expect(strategies).toHaveLength(2);
    expect(strategies.map((s) => s.name).sort()).toEqual(['Impacto táctico', 'Performance general']);
    expect(strategies.filter((s) => s.isSelected)).toHaveLength(1);
  });

  it('no promueve a admin una cuenta existente con rol user', async () => {
    await dataSource.getRepository(UserEntity).insert({
      email: EMAIL,
      passwordHash: 'hash-existente',
      role: 'user',
      username: 'test-user',
    });

    await service.run();

    const [row] = await rowsFor();
    expect(row.role).toBe('user');
    expect(row.passwordHash).toBe('hash-existente');
  });
});
