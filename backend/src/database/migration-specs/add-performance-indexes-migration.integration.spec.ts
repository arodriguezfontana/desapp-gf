import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { PlayerEntity } from '../../repositories/player/entities/player.entity';
import { PlayerQuoteEntity } from '../../repositories/quotation/entities/player-quote.entity';
import { DatabaseModule } from '../database.module';
import { AddPerformanceIndexes1793200000000 } from '../migrations/1793200000000-AddPerformanceIndexes';

describe('AddPerformanceIndexes (migration, spec 031 US5)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  const migration = new AddPerformanceIndexes1793200000000();

  const runWith = async (step: 'up' | 'down') => {
    const queryRunner = dataSource.createQueryRunner();
    try {
      await migration[step](queryRunner);
    } finally {
      await queryRunner.release();
    }
  };

  const indexExists = async (indexName: string): Promise<boolean> => {
    const rows = await dataSource.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
      [indexName],
    );
    return rows.length > 0;
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([PlayerEntity, PlayerQuoteEntity]),
      ],
    }).compile();
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await runWith('up');
    await moduleRef.close();
  });

  it('up crea los índices compuestos en players y player_quotes', async () => {
    await runWith('down');
    expect(await indexExists('idx_players_removed_league_position')).toBe(false);
    expect(await indexExists('idx_player_quotes_user_player_calc_desc')).toBe(false);

    await runWith('up');

    expect(await indexExists('idx_players_removed_league_position')).toBe(true);
    expect(await indexExists('idx_player_quotes_user_player_calc_desc')).toBe(true);
  });

  it('es idempotente: ejecutar up dos veces no arroja errores', async () => {
    await expect(runWith('up')).resolves.toBeUndefined();
    await expect(runWith('up')).resolves.toBeUndefined();

    expect(await indexExists('idx_players_removed_league_position')).toBe(true);
    expect(await indexExists('idx_player_quotes_user_player_calc_desc')).toBe(true);
  });

  it('down elimina ambos índices sin afectar la integridad de las tablas', async () => {
    await runWith('down');

    expect(await indexExists('idx_players_removed_league_position')).toBe(false);
    expect(await indexExists('idx_player_quotes_user_player_calc_desc')).toBe(false);

    // Restaurar para pruebas posteriores
    await runWith('up');
    expect(await indexExists('idx_players_removed_league_position')).toBe(true);
    expect(await indexExists('idx_player_quotes_user_player_calc_desc')).toBe(true);
  });
});
