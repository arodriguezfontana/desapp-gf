import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../database/database.module';
import { PLAYER_REPOSITORY } from '../player.constants';
import { PlayerEntity } from '../repositories/entities/player.entity';
import { PlayerMapper } from '../repositories/mappers/player.mapper';
import { TypeOrmPlayerRepository } from '../repositories/typeorm-player.repository';
import { PlayerNotFoundError } from '../domain/player/errors/player-not-found.error';
import { League } from '../domain/player/league';
import { Position } from '../domain/player/position';
import { PlayerService } from './player.service';

describe('PlayerService + TypeOrmPlayerRepository (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let service: PlayerService;
  let dataSource: DataSource;

  const fixtures: PlayerEntity[] = [
    Object.assign(new PlayerEntity(), {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Fixture Uno',
      league: 'Premier League',
      team: 'Fixture FC',
      position: 'GK',
    }),
    Object.assign(new PlayerEntity(), {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Fixture Dos',
      league: 'Premier League',
      team: 'Fixture FC',
      position: 'DF',
    }),
    Object.assign(new PlayerEntity(), {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Fixture Tres',
      league: 'Bundesliga',
      team: 'Otro Equipo',
      position: 'GK',
    }),
  ];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([PlayerEntity]),
      ],
      providers: [
        PlayerService,
        PlayerMapper,
        { provide: PLAYER_REPOSITORY, useClass: TypeOrmPlayerRepository },
      ],
    }).compile();

    service = moduleRef.get(PlayerService);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(PlayerEntity).clear();
    await dataSource.getRepository(PlayerEntity).save(fixtures);
  });

  describe('listPlayers', () => {
    it('combina filtros con AND', async () => {
      const result = await service.listPlayers(
        { league: League.PREMIER_LEAGUE, position: Position.GK },
        { page: 1, pageSize: 10 },
      );

      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('pagina correctamente (LIMIT/OFFSET) y el total no depende de la página', async () => {
      const firstPage = await service.listPlayers({}, { page: 1, pageSize: 2 });
      const secondPage = await service.listPlayers({}, { page: 2, pageSize: 2 });

      expect(firstPage.total).toBe(3);
      expect(firstPage.items).toHaveLength(2);
      expect(secondPage.total).toBe(3);
      expect(secondPage.items).toHaveLength(1);
    });

    it('devuelve una lista vacía cuando ningún jugador cumple los filtros', async () => {
      const result = await service.listPlayers(
        { team: 'Equipo Inexistente' },
        { page: 1, pageSize: 10 },
      );

      expect(result).toEqual({ items: [], total: 0 });
    });

    it('el filtro de equipo hace match parcial, insensible a mayúsculas/minúsculas', async () => {
      const result = await service.listPlayers(
        { team: 'fixture' },
        { page: 1, pageSize: 10 },
      );

      expect(result.total).toBe(2);
      expect(result.items.map((p) => p.id).sort()).toEqual(
        [
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
        ].sort(),
      );
    });
  });

  describe('getPlayerById', () => {
    it('devuelve el jugador cuando el id existe', async () => {
      const player = await service.getPlayerById(
        '11111111-1111-1111-1111-111111111111',
      );
      expect(player.name).toBe('Fixture Uno');
    });

    it('lanza PlayerNotFoundError cuando el id no existe', async () => {
      await expect(
        service.getPlayerById('99999999-9999-9999-9999-999999999999'),
      ).rejects.toThrow(PlayerNotFoundError);
    });
  });

  describe('Métricas de rendimiento y baja lógica (006-whoscored-catalog-sync)', () => {
    const metricsFixtures: PlayerEntity[] = [
      Object.assign(new PlayerEntity(), {
        id: '44444444-4444-4444-4444-444444444444',
        externalId: 'ws-44444444',
        name: 'Fixture Con Métricas',
        league: 'Serie A',
        team: 'Equipo Metricas',
        position: 'FW',
        passesCompleted: 10.5,
        shots: 2.1,
        interceptions: 0.4,
        rating: 6.9,
      }),
      Object.assign(new PlayerEntity(), {
        id: '55555555-5555-5555-5555-555555555555',
        externalId: 'ws-55555555',
        name: 'Fixture Sin Métricas',
        league: 'Serie A',
        team: 'Equipo Metricas',
        position: 'MF',
      }),
      Object.assign(new PlayerEntity(), {
        id: '66666666-6666-6666-6666-666666666666',
        externalId: 'ws-66666666',
        name: 'Fixture Dado De Baja',
        league: 'Serie A',
        team: 'Equipo Metricas',
        position: 'GK',
        removedAt: new Date(),
      }),
    ];

    beforeEach(async () => {
      await dataSource.getRepository(PlayerEntity).clear();
      await dataSource.getRepository(PlayerEntity).save(metricsFixtures);
    });

    it('expone las 4 métricas con valor cuando están disponibles', async () => {
      const player = await service.getPlayerById(
        '44444444-4444-4444-4444-444444444444',
      );
      expect(player.passesCompleted).toBe(10.5);
      expect(player.shots).toBe(2.1);
      expect(player.interceptions).toBe(0.4);
      expect(player.rating).toBe(6.9);
    });

    it('expone las 4 métricas en null cuando no hay valor disponible', async () => {
      const player = await service.getPlayerById(
        '55555555-5555-5555-5555-555555555555',
      );
      expect(player.passesCompleted).toBeNull();
      expect(player.shots).toBeNull();
      expect(player.interceptions).toBeNull();
      expect(player.rating).toBeNull();
    });

    it('findPage excluye a los jugadores dados de baja (removedAt) del listado y del total', async () => {
      const result = await service.listPlayers(
        { team: 'Equipo Metricas' },
        { page: 1, pageSize: 10 },
      );

      expect(result.total).toBe(2);
      expect(result.items.map((p) => p.id).sort()).toEqual(
        [
          '44444444-4444-4444-4444-444444444444',
          '55555555-5555-5555-5555-555555555555',
        ].sort(),
      );
    });

    it('getPlayerById lanza PlayerNotFoundError para un jugador dado de baja (FR-016)', async () => {
      await expect(
        service.getPlayerById('66666666-6666-6666-6666-666666666666'),
      ).rejects.toThrow(PlayerNotFoundError);
    });
  });
});
