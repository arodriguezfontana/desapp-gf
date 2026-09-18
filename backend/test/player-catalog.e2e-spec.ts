import * as request from 'supertest';
import { ApiKeyEntity } from '../src/repositories/entities/api-key.entity';
import { UserEntity } from '../src/repositories/entities/user.entity';
import { createTestApp, TestContext } from './test-app';

const LEAGUES = [
  'Premier League',
  'Bundesliga',
  'La Liga',
  'Serie A',
  'Ligue 1',
];
const POSITIONS = ['GK', 'DF', 'MF', 'FW'];

describe('Catálogo de Jugadores (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  const registerLoginAndIssueApiKey = async (email: string) => {
    await request(server())
      .post('/auth/register')
      .send({ email, password: 'Abcd1234!' });
    const login = await request(server())
      .post('/auth/login')
      .send({ email, password: 'Abcd1234!' });
    const token = login.body.accessToken as string;
    const issued = await request(server())
      .post('/auth/api-key')
      .set('Authorization', `Bearer ${token}`);
    return { token, apiKey: issued.body.apiKey as string };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.dataSource.getRepository(ApiKeyEntity).clear();
    await ctx.dataSource.getRepository(UserEntity).clear();
  });

  describe('GET /players', () => {
    it('200: sin filtros, devuelve la página 1 (10 jugadores) y el total del catálogo (20)', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('lista@mail.com');

      const res = await request(server())
        .get('/players')
        .set('x-api-key', apiKey);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(20);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(10);
      expect(res.body.items).toHaveLength(10);
    });

    it.each(LEAGUES.flatMap((league) => POSITIONS.map((position) => [league, position])))(
      '200: la combinación liga=%s + posición=%s tiene exactamente 1 resultado',
      async (league, position) => {
        const { apiKey } = await registerLoginAndIssueApiKey(
          `combo-${league}-${position}@mail.com`.replace(/\s+/g, '-'),
        );

        const res = await request(server())
          .get('/players')
          .query({ league, position })
          .set('x-api-key', apiKey);

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);
        expect(res.body.items[0].league).toBe(league);
        expect(res.body.items[0].position).toBe(position);
      },
    );

    it('200: un filtro sin coincidencias devuelve items vacío y total 0 (no un error)', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('vacio@mail.com');

      const res = await request(server())
        .get('/players')
        .query({ team: 'Equipo Que No Existe' })
        .set('x-api-key', apiKey);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('200: acepta league, team y position combinados (AND) sin rechazarlos por whitelist', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('combinado3@mail.com');

      const res = await request(server())
        .get('/players')
        .query({
          league: 'Premier League',
          team: 'Northbridge FC',
          position: 'GK',
        })
        .set('x-api-key', apiKey);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].league).toBe('Premier League');
      expect(res.body.items[0].team).toBe('Northbridge FC');
      expect(res.body.items[0].position).toBe('GK');
    });

    it('200: pagina con page/pageSize explícitos', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('paginado@mail.com');

      const res = await request(server())
        .get('/players')
        .query({ page: 2, pageSize: 5 })
        .set('x-api-key', apiKey);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(20);
      expect(res.body.page).toBe(2);
      expect(res.body.pageSize).toBe(5);
      expect(res.body.items).toHaveLength(5);
    });

    it('400: pageSize por encima del máximo permitido (50), con mensaje en español', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('rango1@mail.com');
      const res = await request(server())
        .get('/players')
        .query({ pageSize: 51 })
        .set('x-api-key', apiKey);
      expect(res.status).toBe(400);
      expect(res.body.message).toEqual([
        "El campo 'pageSize' debe ser menor o igual a 50.",
      ]);
    });

    it('400: page menor a 1', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('rango2@mail.com');
      const res = await request(server())
        .get('/players')
        .query({ page: 0 })
        .set('x-api-key', apiKey);
      expect(res.status).toBe(400);
    });

    it('400: posición fuera del enum soportado', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('rango3@mail.com');
      const res = await request(server())
        .get('/players')
        .query({ position: 'XX' })
        .set('x-api-key', apiKey);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /players/:id', () => {
    it('200: devuelve el detalle de un jugador existente del catálogo, con los mismos datos que en el listado', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('detalle@mail.com');

      const listRes = await request(server())
        .get('/players')
        .set('x-api-key', apiKey);
      const fromList = listRes.body.items[0];

      const detailRes = await request(server())
        .get(`/players/${fromList.id}`)
        .set('x-api-key', apiKey);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body).toEqual(fromList);
    });

    it('404: id bien formado pero inexistente', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('detalle404@mail.com');

      const res = await request(server())
        .get('/players/00000000-0000-0000-0000-000000000000')
        .set('x-api-key', apiKey);

      expect(res.status).toBe(404);
    });

    it('404: id con formato inválido (no distinguible de uno inexistente)', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('detalle400@mail.com');

      const res = await request(server())
        .get('/players/no-es-un-uuid')
        .set('x-api-key', apiKey);

      expect(res.status).toBe(404);
    });
  });

  describe('ApiKeyGuard — rechazos contra ambos endpoints (User Story 3)', () => {
    const endpoints = async (): Promise<{ path: string }[]> => {
      const { apiKey } = await registerLoginAndIssueApiKey(
        `us3-seed-${Date.now()}@mail.com`,
      );
      const list = await request(server())
        .get('/players')
        .set('x-api-key', apiKey);
      const id = list.body.items[0].id as string;
      return [{ path: '/players' }, { path: `/players/${id}` }];
    };

    it('401 sin header x-api-key, sin exponer datos del catálogo', async () => {
      for (const { path } of await endpoints()) {
        const res = await request(server()).get(path);
        expect(res.status).toBe(401);
        expect(res.body.items).toBeUndefined();
        expect(res.body.name).toBeUndefined();
      }
    });

    it('401 con una ApiKey inexistente/adulterada', async () => {
      for (const { path } of await endpoints()) {
        const res = await request(server())
          .get(path)
          .set('x-api-key', 'pmk_no-existe-esta-clave');
        expect(res.status).toBe(401);
      }
    });

    it('401 con una ApiKey que fue revocada (reemplazada por una emisión posterior)', async () => {
      const paths = await endpoints();
      const email = `us3-revocada-${Date.now()}@mail.com`;
      const first = await registerLoginAndIssueApiKey(email);
      // Re-emitir con el mismo usuario invalida la primera (feature 002-api-key-issuance).
      const second = await request(server())
        .post('/auth/api-key')
        .set('Authorization', `Bearer ${first.token}`);
      expect(second.status).toBe(201);

      for (const { path } of paths) {
        const res = await request(server())
          .get(path)
          .set('x-api-key', first.apiKey);
        expect(res.status).toBe(401);
      }
    });

    it('401 con sólo un JWT válido (sin x-api-key): un JWT no alcanza como alternativa', async () => {
      const paths = await endpoints();
      const { token } = await registerLoginAndIssueApiKey(
        `us3-jwt-${Date.now()}@mail.com`,
      );

      for (const { path } of paths) {
        const res = await request(server())
          .get(path)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
      }
    });
  });
});
