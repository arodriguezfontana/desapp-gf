import * as request from 'supertest';
import { createTestApp, TestContext } from './test-app';
import { WHOSCORED_ADAPTER } from '../src/modules/player-sync/player-sync.constants';
import { FOOTBALL_DATA_ADAPTER } from '../src/modules/competition/football-data-sync.constants';

/**
 * 027-health-check. `GET /health` verifica solo la base de datos (ping con timeout
 * de 3000 ms), es público y su cuerpo nunca filtra información sensible.
 * La "caída" de la base se simula haciendo que `DataSource.query` falle o no
 * resuelva nunca; la base real es la efímera de Testcontainers.
 */
describe('Health check (e2e, spec 027)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();
  let querySpy: jest.SpyInstance | undefined;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  afterEach(() => {
    querySpy?.mockRestore();
    querySpy = undefined;
  });

  const breakDatabase = (error: Error = new Error('boom')) => {
    querySpy = jest.spyOn(ctx.dataSource, 'query').mockRejectedValue(error);
  };

  describe('US1: 200 con la base sana, 503 con la base caída', () => {
    it('200 y status "ok" cuando la base de datos responde', async () => {
      const res = await request(server()).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('503 y status "error" cuando la base de datos rechaza la consulta', async () => {
      breakDatabase();

      const res = await request(server()).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
    });

    it('se recupera sin reiniciar: tras volver la base, la siguiente consulta es 200', async () => {
      breakDatabase();
      expect((await request(server()).get('/health')).status).toBe(503);

      querySpy?.mockRestore();
      querySpy = undefined;

      const res = await request(server()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('503 en menos de 5 s cuando la base no responde nunca (timeout)', async () => {
      querySpy = jest
        .spyOn(ctx.dataSource, 'query')
        .mockImplementation(() => new Promise(() => undefined));

      const startedAt = Date.now();
      const res = await request(server()).get('/health');
      const elapsedMs = Date.now() - startedAt;

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
      expect(elapsedMs).toBeLessThan(5000);
    }, 15_000);
  });

  describe('US2: estado individual por componente, sin información sensible', () => {
    it('base sana: database figura "up" en info y en details', async () => {
      const res = await request(server()).get('/health');

      expect(res.body.info.database.status).toBe('up');
      expect(res.body.details.database.status).toBe('up');
      expect(res.body.error).toEqual({});
    });

    it('base caída: database figura "down" en error y en details', async () => {
      breakDatabase();

      const res = await request(server()).get('/health');

      expect(res.body.error.database.status).toBe('down');
      expect(res.body.details.database.status).toBe('down');
      expect(res.body.info).toEqual({});
    });

    it('no filtra el error original ni datos de conexión en el cuerpo', async () => {
      breakDatabase(new Error('postgres://user:secret@db:5432/app boom'));

      const res = await request(server()).get('/health');
      const serialized = JSON.stringify(res.body);

      expect(res.status).toBe(503);
      expect(serialized).not.toContain('secret');
      expect(serialized).not.toContain('postgres://');
      expect(serialized).not.toContain('boom');
      expect(serialized).not.toContain('stack');
    });

    it('el timeout informa un mensaje fijo y nada más', async () => {
      querySpy = jest
        .spyOn(ctx.dataSource, 'query')
        .mockImplementation(() => new Promise(() => undefined));

      const res = await request(server()).get('/health');

      expect(res.body.details.database).toEqual({
        status: 'down',
        message: 'timeout of 3000ms exceeded',
      });
    }, 15_000);

    it('solo verifica database', async () => {
      const res = await request(server()).get('/health');

      expect(Object.keys(res.body.details)).toEqual(['database']);
    });
  });

  describe('US3: acceso sin autenticación', () => {
    it('base sana, sin Authorization: 200 (no 401)', async () => {
      const res = await request(server()).get('/health');

      expect(res.status).toBe(200);
    });

    it('base caída, sin Authorization: 503 (no 401)', async () => {
      breakDatabase();

      const res = await request(server()).get('/health');

      expect(res.status).toBe(503);
    });

    it('la exención se limita al health check: /auth/me sin token sigue dando 401', async () => {
      const res = await request(server()).get('/auth/me');

      expect(res.status).toBe(401);
    });
  });
});

describe('Health check con proveedores externos caídos (e2e, spec 027, US4)', () => {
  let ctx: TestContext;
  const whoScored = {
    fetchLeagueTeams: jest.fn().mockRejectedValue(new Error('proveedor caído')),
    fetchTeamRoster: jest.fn().mockRejectedValue(new Error('proveedor caído')),
  };
  const footballData = {
    fetchStandings: jest.fn().mockRejectedValue(new Error('proveedor caído')),
    fetchMatches: jest.fn().mockRejectedValue(new Error('proveedor caído')),
  };

  beforeAll(async () => {
    ctx = await createTestApp([
      { token: WHOSCORED_ADAPTER, useValue: whoScored },
      { token: FOOTBALL_DATA_ADAPTER, useValue: footballData },
    ]);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('sigue respondiendo 200 "ok", no invoca a los proveedores y no los lista', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Object.keys(res.body.details)).toEqual(['database']);
    expect(whoScored.fetchLeagueTeams).not.toHaveBeenCalled();
    expect(whoScored.fetchTeamRoster).not.toHaveBeenCalled();
    expect(footballData.fetchStandings).not.toHaveBeenCalled();
    expect(footballData.fetchMatches).not.toHaveBeenCalled();
  });
});
