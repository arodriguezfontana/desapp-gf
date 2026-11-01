import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';
import { League } from '../../domain/player/enums/league';
import { Position } from '../../domain/player/enums/position';
import { PlayerSyncInput } from '../../domain/sync/player-sync-input';
import { PlayerQuoteEntity } from '../quotation/entities/player-quote.entity';
import { ValuationStrategyEntity } from '../quotation/entities/valuation-strategy.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { PlayerEntity } from './entities/player.entity';
import { PlayerMapper } from './mappers/player.mapper';
import { PlayerRepository } from './player.repository';

describe('PlayerRepository — sincronización (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let repository: PlayerRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([PlayerEntity, PlayerQuoteEntity, ValuationStrategyEntity, UserEntity]),
      ],
      providers: [PlayerMapper, PlayerRepository],
    }).compile();

    repository = moduleRef.get(PlayerRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM "player_quotes"');
    await dataSource.getRepository(PlayerEntity).clear();
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "player_quotes"');
    await dataSource.getRepository(PlayerEntity).clear();
  });

  const input = (
    externalId: string,
    name: string,
    metrics: PlayerSyncInput['metrics'] = null,
  ): PlayerSyncInput => ({ externalId, name, position: Position.MF, metrics });

  describe('findActiveExternalIdsByTeam', () => {
    it('devuelve sólo los externalId vigentes (removedAt IS NULL) de ese equipo', async () => {
      await repository.applyTeamRosterSync(
        League.SERIE_A,
        'Equipo Test',
        [input('ws-1', 'Jugador Uno'), input('ws-2', 'Jugador Dos')],
        [],
      );
      // Da de baja a ws-1 en una segunda corrida que sólo trae a ws-2.
      await repository.applyTeamRosterSync(
        League.SERIE_A,
        'Equipo Test',
        [input('ws-2', 'Jugador Dos')],
        ['ws-1'],
      );

      const active = await repository.findActiveExternalIdsByTeam(
        League.SERIE_A,
        'Equipo Test',
      );

      expect(active).toEqual(['ws-2']);
    });
  });

  describe('applyTeamRosterSync', () => {
    it('inserta jugadores nuevos por externalId', async () => {
      await repository.applyTeamRosterSync(
        League.LA_LIGA,
        'Equipo Nuevo',
        [
          input('ws-10', 'Nuevo Uno', {
            matchesPlayed: 20,
            passesCompleted: 5,
            shots: 1,
            interceptions: 2,
            rating: 6.5,
            goals: 4,
            assists: 2,
            keyPasses: 10,
            dribbles: 3,
            totalTackles: 7,
            yellowCards: 1,
            redCards: 0,
          }),
        ],
        [],
      );

      const page = await dataSource.getRepository(PlayerEntity).find({
        where: { team: 'Equipo Nuevo' },
      });
      expect(page).toHaveLength(1);
      expect(page[0]).toMatchObject({
        externalId: 'ws-10',
        name: 'Nuevo Uno',
        matchesPlayed: 20,
        passesCompleted: 5,
        goals: 4,
        assists: 2,
        keyPasses: 10,
        dribbles: 3,
        totalTackles: 7,
        yellowCards: 1,
        redCards: 0,
        removedAt: null,
      });
    });

    it('reactiva (removedAt = NULL) a un jugador previamente dado de baja cuyo externalId vuelve a aparecer', async () => {
      await repository.applyTeamRosterSync(
        League.BUNDESLIGA,
        'Equipo Vaivén',
        [input('ws-20', 'Jugador Vaivén')],
        [],
      );
      await repository.applyTeamRosterSync(
        League.BUNDESLIGA,
        'Equipo Vaivén',
        [],
        ['ws-20'],
      );
      const afterRemoval = await dataSource
        .getRepository(PlayerEntity)
        .findOneOrFail({ where: { externalId: 'ws-20' } });
      expect(afterRemoval.removedAt).not.toBeNull();
      const idBeforeReturn = afterRemoval.id;

      await repository.applyTeamRosterSync(
        League.BUNDESLIGA,
        'Equipo Vaivén',
        [input('ws-20', 'Jugador Vaivén')],
        [],
      );

      const afterReturn = await dataSource
        .getRepository(PlayerEntity)
        .findOneOrFail({ where: { externalId: 'ws-20' } });
      expect(afterReturn.removedAt).toBeNull();
      // El id interno se mantiene estable entre sincronizaciones (no se crea
      // una fila nueva): el upsert por externalId reactiva la misma fila.
      expect(afterReturn.id).toBe(idBeforeReturn);
    });

    it('da de baja lógica (no borra) a los jugadores ausentes del plantel entrante', async () => {
      await repository.applyTeamRosterSync(
        League.PREMIER_LEAGUE,
        'Equipo Baja',
        [input('ws-30', 'Se Queda'), input('ws-31', 'Se Va')],
        [],
      );

      await repository.applyTeamRosterSync(
        League.PREMIER_LEAGUE,
        'Equipo Baja',
        [input('ws-30', 'Se Queda')],
        ['ws-31'],
      );

      const removed = await dataSource
        .getRepository(PlayerEntity)
        .findOneOrFail({ where: { externalId: 'ws-31' } });
      expect(removed.removedAt).not.toBeNull();

      const stillPresent = await dataSource
        .getRepository(PlayerEntity)
        .count({ where: { externalId: 'ws-31' } });
      expect(stillPresent).toBe(1); // sigue existiendo la fila, sólo dada de baja

      const active = await dataSource
        .getRepository(PlayerEntity)
        .find({ where: { team: 'Equipo Baja', removedAt: IsNull() } });
      expect(active.map((p) => p.externalId)).toEqual(['ws-30']);
    });

    it('todo el upsert de un equipo ocurre en una única transacción atómica', async () => {
      // Dos jugadores nuevos en la misma llamada: si la transacción no fuera
      // atómica, una corrida parcial dejaría sólo uno persistido.
      await repository.applyTeamRosterSync(
        League.LIGUE_1,
        'Equipo Atómico',
        [input('ws-40', 'Atómico Uno'), input('ws-41', 'Atómico Dos')],
        [],
      );

      const count = await dataSource
        .getRepository(PlayerEntity)
        .count({ where: { team: 'Equipo Atómico' } });
      expect(count).toBe(2);
    });
  });

  describe('findRanking', () => {
    let strategyId: string;
    let otherStrategyId: string;
    let userId: string;

    const createUser = async (): Promise<string> => {
      const id = randomUUID();
      await dataSource.getRepository(UserEntity).insert({
        id,
        email: `${id}@test.local`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
        username: 'test-user',
      });
      return id;
    };

    const createStrategy = async (name: string, isSelected = true): Promise<string> => {
      const id = randomUUID();
      await dataSource.query(
        `INSERT INTO "valuation_strategies" ("id", "user_id", "name", "weights", "factor_escala", "is_selected")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, userId, name, JSON.stringify({ rating: 1 }), '99.0000', isSelected],
      );
      return id;
    };

    const createPlayer = async (props: {
      name: string;
      league: League;
      team: string;
      position: Position;
      externalId?: string;
      removedAt?: Date | null;
    }): Promise<PlayerEntity> => {
      return dataSource.getRepository(PlayerEntity).save({
        id: randomUUID(),
        name: props.name,
        league: props.league,
        team: props.team,
        position: props.position,
        externalId: props.externalId ?? `ws-${randomUUID()}`,
        removedAt: props.removedAt ?? null,
        matchesPlayed: 10,
        passesCompleted: 5,
        shots: 2,
        interceptions: 1,
        rating: 7.0,
      });
    };

    const createQuote = async (props: {
      playerId: string;
      strategyId: string;
      value: number;
      score: number;
      calculatedAt: Date;
    }): Promise<string> => {
      const id = randomUUID();
      await dataSource.query(
        `INSERT INTO "player_quotes" ("id", "user_id", "player_id", "strategy_id", "weight_snapshot", "factor_escala_snapshot", "score", "value", "calculated_at")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          userId,
          props.playerId,
          props.strategyId,
          JSON.stringify({ rating: 1 }),
          '99.0000',
          props.score.toFixed(6),
          props.value.toFixed(2),
          props.calculatedAt,
        ],
      );
      return id;
    };

    beforeEach(async () => {
      userId = await createUser();
      strategyId = await createStrategy('Estrategia Principal', true);
      otherStrategyId = await createStrategy('Estrategia Histórica', false);
    });

    afterEach(async () => {
      await dataSource.query('DELETE FROM "player_quotes"');
      if (strategyId && otherStrategyId) {
        await dataSource.query('DELETE FROM "valuation_strategies" WHERE id IN ($1, $2)', [
          strategyId,
          otherStrategyId,
        ]);
      }
      if (userId) {
        await dataSource.query('DELETE FROM "users" WHERE id = $1', [userId]);
      }
      await dataSource.getRepository(PlayerEntity).clear();
    });

    it('ordena descendentemente por valor, con desempate por score desc e id asc', async () => {
      const p1 = await createPlayer({ name: 'Jugador Menor Valor', league: League.LA_LIGA, team: 'Betis', position: Position.MF });
      const p2 = await createPlayer({ name: 'Jugador Mayor Valor', league: League.LA_LIGA, team: 'Real Madrid', position: Position.FW });
      const p3 = await createPlayer({ name: 'Jugador Empate Score Menor', league: League.PREMIER_LEAGUE, team: 'Arsenal', position: Position.DF });
      const p4 = await createPlayer({ name: 'Jugador Empate Score Mayor', league: League.PREMIER_LEAGUE, team: 'Chelsea', position: Position.DF });

      const now = new Date();
      await createQuote({ playerId: p1.id, strategyId, value: 20000000, score: 7.0, calculatedAt: now });
      await createQuote({ playerId: p2.id, strategyId, value: 90000000, score: 8.5, calculatedAt: now });
      // p3 y p4 tienen el mismo valor (50M), pero p4 tiene mayor score (8.0 vs 7.5)
      await createQuote({ playerId: p3.id, strategyId, value: 50000000, score: 7.5, calculatedAt: now });
      await createQuote({ playerId: p4.id, strategyId, value: 50000000, score: 8.0, calculatedAt: now });

      const result = await repository.findRanking(userId, {}, { page: 1, pageSize: 10 });

      expect(result.total).toBe(4);
      expect(result.items.map((i) => i.player.name)).toEqual([
        'Jugador Mayor Valor',
        'Jugador Empate Score Mayor',
        'Jugador Empate Score Menor',
        'Jugador Menor Valor',
      ]);
      expect(result.items[0].valor).toBe(90000000);
      expect(result.items[0].score).toBe(8.5);
      expect(result.items[0].strategyName).toBe('Estrategia Principal');
    });

    it('excluye jugadores sin ninguna cotización', async () => {
      const pWithQuote = await createPlayer({ name: 'Con Cotización', league: League.SERIE_A, team: 'Milan', position: Position.MF });
      await createPlayer({ name: 'Sin Cotización', league: League.SERIE_A, team: 'Inter', position: Position.MF });

      await createQuote({ playerId: pWithQuote.id, strategyId, value: 35000000, score: 7.2, calculatedAt: new Date() });

      const result = await repository.findRanking(userId, {}, { page: 1, pageSize: 10 });

      expect(result.total).toBe(1);
      expect(result.items[0].player.name).toBe('Con Cotización');
    });

    it('excluye jugadores con removedAt no nulo (bajas lógicas)', async () => {
      const activePlayer = await createPlayer({ name: 'Activo', league: League.BUNDESLIGA, team: 'Bayern', position: Position.FW, removedAt: null });
      const removedPlayer = await createPlayer({ name: 'Baja', league: League.BUNDESLIGA, team: 'Dortmund', position: Position.FW, removedAt: new Date() });

      const now = new Date();
      await createQuote({ playerId: activePlayer.id, strategyId, value: 40000000, score: 8.0, calculatedAt: now });
      await createQuote({ playerId: removedPlayer.id, strategyId, value: 60000000, score: 8.9, calculatedAt: now });

      const result = await repository.findRanking(userId, {}, { page: 1, pageSize: 10 });

      expect(result.total).toBe(1);
      expect(result.items[0].player.name).toBe('Activo');
    });

    it('para jugadores con múltiples cotizaciones, usa exclusivamente la más reciente por calculated_at', async () => {
      const player = await createPlayer({ name: 'Evolutivo', league: League.LIGUE_1, team: 'PSG', position: Position.FW });

      const oldDate = new Date('2026-01-01T10:00:00Z');
      const latestDate = new Date('2026-10-01T10:00:00Z');

      // Cotización antigua con estrategia histórica
      await createQuote({ playerId: player.id, strategyId: otherStrategyId, value: 15000000, score: 6.0, calculatedAt: oldDate });
      // Cotización reciente con estrategia principal
      await createQuote({ playerId: player.id, strategyId, value: 75000000, score: 8.7, calculatedAt: latestDate });

      const result = await repository.findRanking(userId, {}, { page: 1, pageSize: 10 });

      expect(result.total).toBe(1);
      expect(result.items[0].valor).toBe(75000000);
      expect(result.items[0].score).toBe(8.7);
      expect(result.items[0].strategyName).toBe('Estrategia Principal');
      expect(result.items[0].calculatedAt).toEqual(latestDate);
    });

    it('filtra correctamente por league, position y team (búsqueda parcial)', async () => {
      const p1 = await createPlayer({ name: 'Pedri', league: League.LA_LIGA, team: 'FC Barcelona', position: Position.MF });
      const p2 = await createPlayer({ name: 'Gavi', league: League.LA_LIGA, team: 'FC Barcelona', position: Position.MF });
      const p3 = await createPlayer({ name: 'Lewandowski', league: League.LA_LIGA, team: 'FC Barcelona', position: Position.FW });
      const p4 = await createPlayer({ name: 'Bellingham', league: League.LA_LIGA, team: 'Real Madrid', position: Position.MF });
      const p5 = await createPlayer({ name: 'De Bruyne', league: League.PREMIER_LEAGUE, team: 'Manchester City', position: Position.MF });

      const now = new Date();
      await createQuote({ playerId: p1.id, strategyId, value: 80000000, score: 8.6, calculatedAt: now });
      await createQuote({ playerId: p2.id, strategyId, value: 70000000, score: 8.2, calculatedAt: now });
      await createQuote({ playerId: p3.id, strategyId, value: 60000000, score: 8.0, calculatedAt: now });
      await createQuote({ playerId: p4.id, strategyId, value: 95000000, score: 9.0, calculatedAt: now });
      await createQuote({ playerId: p5.id, strategyId, value: 85000000, score: 8.8, calculatedAt: now });

      // Filtro por league y position
      const mfLaLiga = await repository.findRanking(userId, 
        { league: League.LA_LIGA, position: Position.MF },
        { page: 1, pageSize: 10 },
      );
      expect(mfLaLiga.total).toBe(3);
      expect(mfLaLiga.items.map((i) => i.player.name)).toEqual(['Bellingham', 'Pedri', 'Gavi']);

      // Filtro por team (parcial e insensible a mayúsculas)
      const barcaMF = await repository.findRanking(userId, 
        { team: 'barcelona', position: Position.MF },
        { page: 1, pageSize: 10 },
      );
      expect(barcaMF.total).toBe(2);
      expect(barcaMF.items.map((i) => i.player.name)).toEqual(['Pedri', 'Gavi']);
    });

    it('aplica paginación correctamente (page, pageSize y total global)', async () => {
      const now = new Date();
      for (let i = 1; i <= 5; i++) {
        const p = await createPlayer({ name: `Jugador ${i}`, league: League.PREMIER_LEAGUE, team: 'Arsenal', position: Position.MF });
        await createQuote({ playerId: p.id, strategyId, value: i * 10000000, score: 7.0 + i * 0.2, calculatedAt: now });
      }

      // Página 1 (pageSize 2) -> Jugador 5 (50M) y Jugador 4 (40M)
      const page1 = await repository.findRanking(userId, {}, { page: 1, pageSize: 2 });
      expect(page1.total).toBe(5);
      expect(page1.items).toHaveLength(2);
      expect(page1.items[0].player.name).toBe('Jugador 5');
      expect(page1.items[1].player.name).toBe('Jugador 4');

      // Página 2 (pageSize 2) -> Jugador 3 (30M) y Jugador 2 (20M)
      const page2 = await repository.findRanking(userId, {}, { page: 2, pageSize: 2 });
      expect(page2.total).toBe(5);
      expect(page2.items).toHaveLength(2);
      expect(page2.items[0].player.name).toBe('Jugador 3');
      expect(page2.items[1].player.name).toBe('Jugador 2');

      // Página 99 (fuera de rango) -> items vacíos, total 5
      const page99 = await repository.findRanking(userId, {}, { page: 99, pageSize: 2 });
      expect(page99.total).toBe(5);
      expect(page99.items).toEqual([]);
    });

    it('devuelve items vacíos y total 0 ante filtros sin coincidencias o sin cotizaciones', async () => {
      const result = await repository.findRanking(userId, 
        { team: 'Equipo Inexistente' },
        { page: 1, pageSize: 10 },
      );
      expect(result).toEqual({ items: [], total: 0 });
    });
  });
});
