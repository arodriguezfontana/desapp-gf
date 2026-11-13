import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';
import { SyncLastSuccessEntity } from './entities/sync-last-success.entity';
import { SyncLastSuccessRepository } from './sync-last-success.repository';

describe('SyncLastSuccessRepository (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let repository: SyncLastSuccessRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([SyncLastSuccessEntity]),
      ],
      providers: [SyncLastSuccessRepository],
    }).compile();

    repository = moduleRef.get(SyncLastSuccessRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM "sync_last_success"');
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "sync_last_success"');
  });

  it('sin filas, findAll devuelve vacío', async () => {
    expect(await repository.findAll()).toEqual([]);
  });

  it('upsert crea la fila de una fuente', async () => {
    const at = new Date('2026-11-13T10:00:00.000Z');

    await repository.upsert('whoscored', at);

    expect(await repository.findAll()).toEqual([{ source: 'whoscored', succeededAt: at }]);
  });

  it('upsert reemplaza la fila de la misma fuente (una fila por fuente)', async () => {
    await repository.upsert('football_data', new Date('2026-11-10T00:00:00.000Z'));
    const later = new Date('2026-11-13T00:00:00.000Z');

    await repository.upsert('football_data', later);

    expect(await repository.findAll()).toEqual([{ source: 'football_data', succeededAt: later }]);
  });

  it('findAll devuelve una fila por fuente', async () => {
    const whoscoredAt = new Date('2026-11-10T00:00:00.000Z');
    const footballAt = new Date('2026-11-12T00:00:00.000Z');
    await repository.upsert('whoscored', whoscoredAt);
    await repository.upsert('football_data', footballAt);

    const rows = await repository.findAll();

    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        { source: 'whoscored', succeededAt: whoscoredAt },
        { source: 'football_data', succeededAt: footballAt },
      ]),
    );
  });
});
