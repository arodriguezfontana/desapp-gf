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
});
