import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../../src/repositories/player/entities/player.entity';
import { ValuationStrategyEntity } from '../../src/repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../src/repositories/quotation/entities/player-quote.entity';
import { createTestApp, TestContext } from '../test-app';

describe('GET /players/ranking (e2e, spec 016 + 019-per-user-valuation-strategies)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  let userToken: string;
  let userId: string;
  let strategyA: ValuationStrategyEntity;
  let strategyB: ValuationStrategyEntity;

  const registerAndLogin = async (email: string) => {
    const register = await request(server()).post('/auth/register').send({ email, password: 'Password123!', username: 'test-user' });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Password123!' });
    return { token: login.body.accessToken as string, userId: register.body.id as string };
  };

  const createPlayer = async (props: {
    name: string;
    league: string;
    team: string;
    position: string;
    externalId?: string;
    removedAt?: Date | null;
  }): Promise<PlayerEntity> => {
    return ctx.dataSource.getRepository(PlayerEntity).save({
      id: randomUUID(),
      externalId: props.externalId ?? `ext-${randomUUID()}`,
      name: props.name,
      league: props.league,
      team: props.team,
      position: props.position,
      matchesPlayed: 20,
      passesCompleted: 30.5,
      shots: 3.2,
      interceptions: 1.1,
      rating: 7.5,
      goals: 8,
      assists: 4,
      keyPasses: 15,
      dribbles: 12,
      totalTackles: 9,
      yellowCards: 2,
      redCards: 0,
      removedAt: props.removedAt ?? null,
    });
  };

  const createQuote = async (props: {
    playerId: string;
    strategyId: string;
    value: number;
    score: number;
    calculatedAt: Date;
  }): Promise<PlayerQuoteEntity> => {
    return ctx.dataSource.getRepository(PlayerQuoteEntity).save({
      id: randomUUID(),
      userId,
      playerId: props.playerId,
      strategyId: props.strategyId,
      weightSnapshot: { rating: 1 },
      factorEscalaSnapshot: '99.0000',
      score: props.score.toFixed(6),
      value: props.value.toFixed(2),
      calculatedAt: props.calculatedAt,
      appliedPosition: null,
    });
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    const auth = await registerAndLogin('ranking-e2e@mail.com');
    userToken = auth.token;
    userId = auth.userId;

    const stratRepo = ctx.dataSource.getRepository(ValuationStrategyEntity);
    // El alta ya provisionó automáticamente las dos estrategias default del
    // usuario (019-per-user-valuation-strategies, FR-001); se reemplazan por
    // las de este fixture para controlar exactamente los pesos del test.
    await stratRepo.delete({ userId });
    strategyA = await stratRepo.save({
      id: randomUUID(),
      userId,
      name: 'Estrategia Clásica',
      weights: { rating: 1 },
      factorEscala: '99.0000',
      isSelected: true,
      positionWeights: null,
    });

    strategyB = await stratRepo.save({
      id: randomUUID(),
      userId,
      name: 'Estrategia Moderna',
      weights: { goals: 1 },
      factorEscala: '99.0000',
      isSelected: false,
      positionWeights: null,
    });
  });

  afterAll(async () => {
    await ctx.dataSource.query('DELETE FROM "player_quotes"');
    if (strategyA && strategyB) {
      await ctx.dataSource.query('DELETE FROM "valuation_strategies" WHERE id IN ($1, $2)', [
        strategyA.id,
        strategyB.id,
      ]);
    }
    // DELETE, no .clear() (TRUNCATE): price_alerts/notifications tienen FK
    // hacia players (025-player-price-alerts) y TRUNCATE rechaza cualquier
    // tabla referenciada por una FK aunque esa tabla ya esté vacía.
    await ctx.dataSource.query('DELETE FROM "players"');
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.dataSource.query('DELETE FROM "player_quotes"');
    await ctx.dataSource.query('DELETE FROM "players"');
  });

  describe('US1: Consultar mi ranking general ordenado por valor (MVP)', () => {
    it('devuelve jugadores ordenados descendentemente por valor, con rank correlativo y campos de cotización', async () => {
      const p1 = await createPlayer({ name: 'Lionel Messi', league: 'La Liga', team: 'FC Barcelona', position: 'FW' });
      const p2 = await createPlayer({ name: 'Cristiano Ronaldo', league: 'La Liga', team: 'Real Madrid', position: 'FW' });
      const p3 = await createPlayer({ name: 'Neymar Jr', league: 'Ligue 1', team: 'Paris Saint-Germain', position: 'FW' });

      const now = new Date();
      await createQuote({ playerId: p1.id, strategyId: strategyA.id, value: 500.0, score: 0.95, calculatedAt: now });
      await createQuote({ playerId: p2.id, strategyId: strategyA.id, value: 450.0, score: 0.92, calculatedAt: now });
      await createQuote({ playerId: p3.id, strategyId: strategyA.id, value: 300.0, score: 0.88, calculatedAt: now });

      const res = await request(server())
        .get('/players/ranking')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.total).toBe(3);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(10);
      expect(res.body.items).toHaveLength(3);

      expect(res.body.items[0]).toMatchObject({
        rank: 1,
        id: p1.id,
        name: 'Lionel Messi',
        team: 'FC Barcelona',
        valor: 500.0,
        score: 0.95,
        strategyName: 'Estrategia Clásica',
        goals: 8,
      });

      expect(res.body.items[1]).toMatchObject({
        rank: 2,
        id: p2.id,
        name: 'Cristiano Ronaldo',
        valor: 450.0,
        score: 0.92,
      });

      expect(res.body.items[2]).toMatchObject({
        rank: 3,
        id: p3.id,
        name: 'Neymar Jr',
        valor: 300.0,
        score: 0.88,
      });
    });

    it('aplica desempate determinista por score DESC e id ASC ante igual cotización', async () => {
      const p1 = await createPlayer({ name: 'Jugador Score Menor', league: 'Premier League', team: 'Arsenal', position: 'MF' });
      const p2 = await createPlayer({ name: 'Jugador Score Mayor', league: 'Premier League', team: 'Chelsea', position: 'MF' });

      const now = new Date();
      // Mismo valor (400), pero p2 tiene score mayor (0.90 vs 0.80)
      await createQuote({ playerId: p1.id, strategyId: strategyA.id, value: 400.0, score: 0.8, calculatedAt: now });
      await createQuote({ playerId: p2.id, strategyId: strategyA.id, value: 400.0, score: 0.9, calculatedAt: now });

      const res = await request(server())
        .get('/players/ranking')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].name).toBe('Jugador Score Mayor');
      expect(res.body.items[0].rank).toBe(1);
      expect(res.body.items[1].name).toBe('Jugador Score Menor');
      expect(res.body.items[1].rank).toBe(2);
    });
  });

  describe('US2: Paginación y navegación del ranking', () => {
    it('mantiene la continuidad secuencial de rank entre páginas consecutivas', async () => {
      const now = new Date();
      for (let i = 1; i <= 5; i++) {
        const p = await createPlayer({ name: `Jugador ${i}`, league: 'Serie A', team: 'Milan', position: 'MF' });
        await createQuote({ playerId: p.id, strategyId: strategyA.id, value: i * 100, score: 0.5 + i * 0.05, calculatedAt: now });
      }

      // Página 1 (pageSize 2) -> Jugador 5 (500) y Jugador 4 (400) -> ranks 1 y 2
      const page1 = await request(server())
        .get('/players/ranking?page=1&pageSize=2')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(page1.body.total).toBe(5);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.items[0].rank).toBe(1);
      expect(page1.body.items[0].name).toBe('Jugador 5');
      expect(page1.body.items[1].rank).toBe(2);
      expect(page1.body.items[1].name).toBe('Jugador 4');

      // Página 2 (pageSize 2) -> Jugador 3 (300) y Jugador 2 (200) -> ranks 3 y 4
      const page2 = await request(server())
        .get('/players/ranking?page=2&pageSize=2')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(page2.body.total).toBe(5);
      expect(page2.body.items).toHaveLength(2);
      expect(page2.body.items[0].rank).toBe(3);
      expect(page2.body.items[0].name).toBe('Jugador 3');
      expect(page2.body.items[1].rank).toBe(4);
      expect(page2.body.items[1].name).toBe('Jugador 2');
    });

    it('devuelve 200 OK con items: [] cuando la página solicitada está fuera de rango', async () => {
      const p = await createPlayer({ name: 'Solo Uno', league: 'Bundesliga', team: 'Bayern', position: 'FW' });
      await createQuote({ playerId: p.id, strategyId: strategyA.id, value: 200.0, score: 0.75, calculatedAt: new Date() });

      const res = await request(server())
        .get('/players/ranking?page=99&pageSize=10')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(99);
      expect(res.body.pageSize).toBe(10);
      expect(res.body.items).toEqual([]);
    });

    it('rechaza con 400 Bad Request ante parámetros de paginación inválidos', async () => {
      await request(server())
        .get('/players/ranking?page=0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      await request(server())
        .get('/players/ranking?pageSize=0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      await request(server())
        .get('/players/ranking?pageSize=100')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
    });
  });

  describe('US3: Filtrado por liga, equipo y posición', () => {
    it('filtra correctamente por liga y posición asignando rank correlativo dentro del subconjunto', async () => {
      const p1 = await createPlayer({ name: 'Modric', league: 'La Liga', team: 'Real Madrid', position: 'MF' });
      const p2 = await createPlayer({ name: 'Kroos', league: 'La Liga', team: 'Real Madrid', position: 'MF' });
      const p3 = await createPlayer({ name: 'Benzema', league: 'La Liga', team: 'Real Madrid', position: 'FW' });
      const p4 = await createPlayer({ name: 'Casemiro', league: 'Premier League', team: 'Manchester United', position: 'MF' });

      const now = new Date();
      await createQuote({ playerId: p1.id, strategyId: strategyA.id, value: 350.0, score: 0.85, calculatedAt: now });
      await createQuote({ playerId: p2.id, strategyId: strategyA.id, value: 300.0, score: 0.82, calculatedAt: now });
      await createQuote({ playerId: p3.id, strategyId: strategyA.id, value: 400.0, score: 0.88, calculatedAt: now });
      await createQuote({ playerId: p4.id, strategyId: strategyA.id, value: 320.0, score: 0.83, calculatedAt: now });

      const res = await request(server())
        .get('/players/ranking?league=La%20Liga&position=MF')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.total).toBe(2);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].name).toBe('Modric');
      expect(res.body.items[0].rank).toBe(1);
      expect(res.body.items[1].name).toBe('Kroos');
      expect(res.body.items[1].rank).toBe(2);
    });

    it('filtra por coincidencia parcial en nombre de equipo', async () => {
      const p1 = await createPlayer({ name: 'Pedri', league: 'La Liga', team: 'FC Barcelona', position: 'MF' });
      const p2 = await createPlayer({ name: 'Valverde', league: 'La Liga', team: 'Real Madrid', position: 'MF' });

      const now = new Date();
      await createQuote({ playerId: p1.id, strategyId: strategyA.id, value: 400.0, score: 0.87, calculatedAt: now });
      await createQuote({ playerId: p2.id, strategyId: strategyA.id, value: 450.0, score: 0.89, calculatedAt: now });

      const res = await request(server())
        .get('/players/ranking?team=barcelona')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].name).toBe('Pedri');
    });

    it('devuelve 200 OK con items: [] y total: 0 ante búsqueda sin coincidencias', async () => {
      const p = await createPlayer({ name: 'Test', league: 'Serie A', team: 'Roma', position: 'GK' });
      await createQuote({ playerId: p.id, strategyId: strategyA.id, value: 150.0, score: 0.7, calculatedAt: new Date() });

      const res = await request(server())
        .get('/players/ranking?team=EquipoFantasma')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });
    });

    it('rechaza con 400 Bad Request si la liga o posición son inválidas', async () => {
      await request(server())
        .get('/players/ranking?league=LigaInvalida')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      await request(server())
        .get('/players/ranking?position=ARQUERO')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
    });
  });

  describe('US4: Exclusión de no cotizados y resiliencia de estrategias', () => {
    it('excluye a jugadores sin cotizaciones y a jugadores dados de baja', async () => {
      const pWithQuote = await createPlayer({ name: 'Cotizado', league: 'Ligue 1', team: 'Lyon', position: 'FW' });
      await createPlayer({ name: 'Sin Cotizacion', league: 'Ligue 1', team: 'Lyon', position: 'FW' });
      const pRemoved = await createPlayer({ name: 'Dado de Baja', league: 'Ligue 1', team: 'Lyon', position: 'FW', removedAt: new Date() });

      const now = new Date();
      await createQuote({ playerId: pWithQuote.id, strategyId: strategyA.id, value: 250.0, score: 0.8, calculatedAt: now });
      await createQuote({ playerId: pRemoved.id, strategyId: strategyA.id, value: 500.0, score: 0.95, calculatedAt: now });

      const res = await request(server())
        .get('/players/ranking')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].name).toBe('Cotizado');
    });

    it('selecciona el quote más reciente por calculatedAt y reporta su strategyName histórico', async () => {
      const player = await createPlayer({ name: 'Camavinga', league: 'La Liga', team: 'Real Madrid', position: 'MF' });

      const oldDate = new Date('2026-01-01T10:00:00Z');
      const latestDate = new Date('2026-10-01T10:00:00Z');

      // Cotización antigua con estrategia A
      await createQuote({ playerId: player.id, strategyId: strategyA.id, value: 200.0, score: 0.75, calculatedAt: oldDate });
      // Cotización reciente con estrategia B (incluso si estrategia B no está seleccionada hoy)
      await createQuote({ playerId: player.id, strategyId: strategyB.id, value: 450.0, score: 0.91, calculatedAt: latestDate });

      const res = await request(server())
        .get('/players/ranking')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].name).toBe('Camavinga');
      expect(res.body.items[0].valor).toBe(450.0);
      expect(res.body.items[0].score).toBe(0.91);
      expect(res.body.items[0].strategyName).toBe('Estrategia Moderna');
    });
  });

  describe('US5: El ranking es propio de cada usuario (019-per-user-valuation-strategies)', () => {
    it('responde 401 Unauthorized si se omite el JWT', async () => {
      await request(server())
        .get('/players/ranking')
        .expect(401);
    });

    it('responde 401 Unauthorized si el JWT es inválido', async () => {
      await request(server())
        .get('/players/ranking')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);
    });

    it('un usuario que nunca recalculó ve su ranking vacío, aunque otro usuario sí tenga cotizaciones', async () => {
      const p = await createPlayer({ name: 'Solo de A', league: 'La Liga', team: 'Sevilla', position: 'FW' });
      await createQuote({ playerId: p.id, strategyId: strategyA.id, value: 300.0, score: 0.8, calculatedAt: new Date() });

      const other = await registerAndLogin('ranking-e2e-other@mail.com');

      const res = await request(server())
        .get('/players/ranking')
        .set('Authorization', `Bearer ${other.token}`)
        .expect(200);

      expect(res.body.total).toBe(0);
      expect(res.body.items).toEqual([]);
    });
  });
});
