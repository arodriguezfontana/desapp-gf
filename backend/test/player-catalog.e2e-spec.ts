import * as request from 'supertest';
import { ApiKeyEntity } from '../src/repositories/entities/api-key.entity';
import { PlayerEntity } from '../src/repositories/entities/player.entity';
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

/**
 * Filas con forma de "lo que una sincronización exitosa dejaría" — no
 * dependen de ninguna migration de seed (006-whoscored-catalog-sync: la
 * migration `RemoveTestPlayerCatalogSeed` borra el seed ficticio de `004` en
 * cada corrida, así que la tabla `players` arranca vacía en un Testcontainers
 * fresco). Un jugador (Milo Ashworth) lleva las 4 métricas con valor; el
 * resto las deja en `null` (sin valor disponible); `Jugador Dado De Baja`
 * queda con `removedAt` seteado para probar la baja lógica (FR-016).
 */
const REMOVED_PLAYER_ID = '99999999-9999-9999-9999-999999999999';

const PLAYER_FIXTURES: Partial<PlayerEntity>[] = [
  {
    id: '27cba263-43c5-4294-a0d2-69c2b4b03c2b',
    externalId: 'ws-27cba263',
    name: 'Milo Ashworth',
    league: 'Premier League',
    team: 'Northbridge FC',
    position: 'GK',
    passesCompleted: 8.4,
    shots: 3.9,
    interceptions: 0.2,
    rating: 7.31,
  },
  { id: 'e87510fd-cce9-4b09-8503-42d685005e3b', externalId: 'ws-e87510fd', name: 'Callum Whitfield', league: 'Premier League', team: 'Northbridge FC', position: 'DF' },
  { id: 'b95ea36b-10c9-4886-90d4-a6ce2cf5b88d', externalId: 'ws-b95ea36b', name: 'Reece Dalton', league: 'Premier League', team: 'Northbridge FC', position: 'MF' },
  { id: '6e312925-549c-4bac-95d8-d5e8e01bf9db', externalId: 'ws-6e312925', name: 'Tobias Kane', league: 'Premier League', team: 'Northbridge FC', position: 'FW' },
  { id: '2a0c802f-cf70-4d33-9ec7-0dd5f8fca661', externalId: 'ws-2a0c802f', name: 'Jonas Reinhardt', league: 'Bundesliga', team: 'SV Falkenstein', position: 'GK' },
  { id: 'ec51c1d3-b3d8-4066-a16e-18ec0fd1be08', externalId: 'ws-ec51c1d3', name: 'Lukas Brandt', league: 'Bundesliga', team: 'SV Falkenstein', position: 'DF' },
  { id: '0b9426fe-0f1b-4ae6-89cc-4e411c1331b0', externalId: 'ws-0b9426fe', name: 'Finn Achterberg', league: 'Bundesliga', team: 'SV Falkenstein', position: 'MF' },
  { id: 'f0d89d61-b336-4bd3-a0fc-bf042ed34141', externalId: 'ws-f0d89d61', name: 'Matteo Vollmer', league: 'Bundesliga', team: 'SV Falkenstein', position: 'FW' },
  { id: 'd2166dc5-a450-43fb-afd9-88beadf437a8', externalId: 'ws-d2166dc5', name: 'Iker Salazar', league: 'La Liga', team: 'CD Montebravo', position: 'GK' },
  { id: '0a141784-aa3c-46cb-9270-caae33de514f', externalId: 'ws-0a141784', name: 'Adrián Fuentes', league: 'La Liga', team: 'CD Montebravo', position: 'DF' },
  { id: 'f7bb8d08-e928-447e-8057-40cfebedadfb', externalId: 'ws-f7bb8d08', name: 'Nico Barreiro', league: 'La Liga', team: 'CD Montebravo', position: 'MF' },
  { id: 'b0350cb0-1246-4b39-b0f0-7e2faa503f89', externalId: 'ws-b0350cb0', name: 'Diego Marchena', league: 'La Liga', team: 'CD Montebravo', position: 'FW' },
  { id: '0137761f-229a-45bc-be92-0b73a18529bf', externalId: 'ws-0137761f', name: 'Luca Ferraresi', league: 'Serie A', team: 'AC Ponteverde', position: 'GK' },
  { id: '32458233-e436-4b79-870d-d0c626f56ba5', externalId: 'ws-32458233', name: 'Marco Sabbatini', league: 'Serie A', team: 'AC Ponteverde', position: 'DF' },
  { id: '82553e3b-6647-48f1-8a9a-7c20824db88e', externalId: 'ws-82553e3b', name: 'Simone Aldrovandi', league: 'Serie A', team: 'AC Ponteverde', position: 'MF' },
  { id: '136825a5-b613-42a7-baff-5c87e5f0d258', externalId: 'ws-136825a5', name: 'Enzo Ricciarelli', league: 'Serie A', team: 'AC Ponteverde', position: 'FW' },
  { id: '32fddd2b-8f5a-4d0f-abe2-327f0701edcb', externalId: 'ws-32fddd2b', name: 'Hugo Lambert', league: 'Ligue 1', team: 'FC Beaumarais', position: 'GK' },
  { id: 'bb1cf10a-ccf4-437a-b62b-ee5d5053da0d', externalId: 'ws-bb1cf10a', name: 'Théo Marchand', league: 'Ligue 1', team: 'FC Beaumarais', position: 'DF' },
  { id: '8e71257e-b1ed-4887-9463-9ad0c4aab2da', externalId: 'ws-8e71257e', name: 'Nathan Girard', league: 'Ligue 1', team: 'FC Beaumarais', position: 'MF' },
  { id: '269edeec-d849-41e4-99bc-f213da6c58fe', externalId: 'ws-269edeec', name: 'Bastien Rocher', league: 'Ligue 1', team: 'FC Beaumarais', position: 'FW' },
  // Jugador dado de baja (FR-016): no debe aparecer en ningún listado ni total,
  // y su detalle debe responder 404 igual que un id inexistente.
  {
    id: REMOVED_PLAYER_ID,
    externalId: 'ws-removed-1',
    name: 'Jugador Dado De Baja',
    league: 'Premier League',
    team: 'Ex Equipo FC',
    position: 'MF',
    removedAt: new Date(),
  },
];

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
    // La migration de seed ficticio de `004` corre y se borra en el mismo
    // boot (RemoveTestPlayerCatalogSeed, 006-whoscored-catalog-sync): la
    // tabla `players` arranca vacía. Estos tests siembran sus propias filas
    // directamente, con la misma forma que dejaría una sincronización
    // exitosa (research.md §2 de 004-player-catalog ya establecía este
    // criterio para los tests de integración; acá se extiende al e2e).
    await ctx.dataSource.getRepository(PlayerEntity).save(PLAYER_FIXTURES);
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

    it('200: expone las 4 métricas de rendimiento, con valor o null (006-whoscored-catalog-sync)', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('metricas@mail.com');

      const conValor = await request(server())
        .get('/players')
        .query({ team: 'Northbridge FC', position: 'GK' })
        .set('x-api-key', apiKey);
      expect(conValor.body.items[0]).toMatchObject({
        passesCompleted: 8.4,
        shots: 3.9,
        interceptions: 0.2,
        rating: 7.31,
      });

      const sinValor = await request(server())
        .get('/players')
        .query({ team: 'Northbridge FC', position: 'DF' })
        .set('x-api-key', apiKey);
      expect(sinValor.body.items[0]).toMatchObject({
        passesCompleted: null,
        shots: null,
        interceptions: null,
        rating: null,
      });
    });

    it('200: un jugador dado de baja no aparece en el listado ni cuenta en el total', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('baja-listado@mail.com');

      const res = await request(server())
        .get('/players')
        .query({ team: 'Ex Equipo FC' })
        .set('x-api-key', apiKey);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
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

    it('404: id de un jugador dado de baja (removedAt seteado) — FR-016', async () => {
      const { apiKey } = await registerLoginAndIssueApiKey('detalle-baja@mail.com');

      const res = await request(server())
        .get(`/players/${REMOVED_PLAYER_ID}`)
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
