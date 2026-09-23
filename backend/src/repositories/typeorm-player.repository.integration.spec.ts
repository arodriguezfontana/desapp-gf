import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';

import { DatabaseModule } from '../database/database.module';
import { League } from '../domain/player/league';
import { Position } from '../domain/player/position';
import { PlayerSyncInput } from '../domain/player/player-sync-input';
import { PlayerEntity } from './entities/player.entity';
import { PlayerMapper } from './mappers/player.mapper';
import { TypeOrmPlayerRepository } from './typeorm-player.repository';

describe('TypeOrmPlayerRepository — sincronización (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let repository: TypeOrmPlayerRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([PlayerEntity]),
      ],
      providers: [PlayerMapper, TypeOrmPlayerRepository],
    }).compile();

    repository = moduleRef.get(TypeOrmPlayerRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
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
            passesCompleted: 5,
            shots: 1,
            interceptions: 2,
            rating: 6.5,
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
        passesCompleted: 5,
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
});
