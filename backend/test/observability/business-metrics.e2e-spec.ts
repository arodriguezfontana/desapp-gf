import * as http from 'node:http';
import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp, TestContext } from '../test-app';
import { parsePrometheusText, PromSample, sampleValue } from './helpers/prom-text';
import { UserEntity } from '../../src/repositories/auth/entities/user.entity';
import { WHOSCORED_ADAPTER } from '../../src/modules/player-sync/player-sync.constants';
import { FOOTBALL_DATA_ADAPTER } from '../../src/modules/competition/football-data-sync.constants';
import {
  WhoScoredAdapter,
  WhoScoredLeagueTeams,
  WhoScoredRawPlayer,
  WhoScoredTeamRef,
} from '../../src/adapters/player-sync/whoscored-adapter';
import { FootballDataAdapter } from '../../src/adapters/competition/football-data-adapter';
import { FootballDataSyncService } from '../../src/services/competition/football-data-sync.service';
import { League } from '../../src/domain/player/enums/league';
import { PlayerEntity } from '../../src/repositories/player/entities/player.entity';
import { TokenHoldingEntity } from '../../src/repositories/portfolio/entities/token-holding.entity';
import {
  BUSINESS_METRIC_NAMES,
  BUSINESS_METRICS,
  NOTIFICATION_DELIVERIES,
  OPERATION_OUTCOMES,
  RECALCULATION_OUTCOMES,
  REJECTION_REASONS,
  RUN_TRIGGERS,
  SIDES,
  SYNC_OUTCOMES,
  SYNC_SOURCES,
} from '../../src/shared/observability/metrics/business-metrics';

/** Football-Data de prueba: `failingLeagues` hace fallar esas ligas (o todas con `'ALL'`). Sin HTTP. */
class ControllableFootballDataAdapter implements FootballDataAdapter {
  failingLeagues: string[] | 'ALL' = [];

  private fails(code: string): boolean {
    return this.failingLeagues === 'ALL' || this.failingLeagues.includes(code);
  }

  fetchStandings(code: string) {
    return this.fails(code) ? Promise.reject(new Error('proveedor caído')) : Promise.resolve([]);
  }

  fetchMatches(code: string) {
    return this.fails(code) ? Promise.reject(new Error('proveedor caído')) : Promise.resolve([]);
  }
}

/** WhoScored de prueba: la Premier League tiene `teams`; los equipos de `failingTeams` fallan al pedir el plantel. */
class ControllableWhoScoredAdapter implements WhoScoredAdapter {
  teams: WhoScoredTeamRef[] = [];
  failingTeams: string[] = [];

  fetchLeagueTeams(league: League): Promise<WhoScoredLeagueTeams> {
    const teams = league === League.PREMIER_LEAGUE ? this.teams : [];
    return Promise.resolve({
      tournamentId: 1,
      teams,
      seedPlayerByTeam: new Map(teams.map((t) => [t.externalTeamId, `seed-${t.externalTeamId}`])),
    });
  }

  fetchTeamRoster(team: WhoScoredTeamRef): Promise<WhoScoredRawPlayer[]> {
    return this.failingTeams.includes(team.externalTeamId)
      ? Promise.reject(new Error('plantel caído'))
      : Promise.resolve([]);
  }
}

/**
 * 031-business-metrics. Se usa `createTestApp()` con la base efímera de Testcontainers. Los contadores
 * acumulan durante todo el archivo (el `Registry` es de la instancia de la app, no se reinicia entre
 * tests): las comparaciones son siempre por diferencia contra una lectura previa.
 */
describe('Métricas de negocio en GET /metrics (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  async function scrape(): Promise<{ text: string; samples: PromSample[] }> {
    const res = await request(server()).get('/metrics');
    expect(res.status).toBe(200);
    return { text: res.text, samples: parsePrometheusText(res.text) };
  }

  /** Valor actual (0 si la serie aún no existe). */
  async function valueOf(name: string, labels: Record<string, string> = {}): Promise<number> {
    return sampleValue((await scrape()).samples, name, labels) ?? 0;
  }

  const registerAndLogin = async (email: string, username: string) => {
    await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!', username });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    const token = login.body.accessToken as string;
    const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${token}`);
    return { token, userId: me.body.id as string };
  };

  const insertPlayer = async () => {
    const player = {
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name: 'Jugador Métricas',
      league: 'Premier League',
      team: 'Test FC',
      position: 'FW',
      rating: 7,
    };
    await ctx.dataSource.getRepository(PlayerEntity).save(player);
    return player;
  };

  const creditHolding = async (userId: string, playerId: string, quantity: number) => {
    await ctx.dataSource.getRepository(TokenHoldingEntity).save({
      id: randomUUID(),
      userId,
      playerId,
      quantity,
      updatedAt: new Date(),
    });
  };

  const clean = async () => {
    await ctx.dataSource.query('DELETE FROM "token_transactions"');
    await ctx.dataSource.query('DELETE FROM "orders"');
    await ctx.dataSource.query('DELETE FROM "token_holdings"');
    await ctx.dataSource.query('DELETE FROM "player_quotes"');
    await ctx.dataSource.query('DELETE FROM "valuation_strategies"');
    await ctx.dataSource.query('DELETE FROM "notifications"');
    await ctx.dataSource.query('DELETE FROM "price_alerts"');
    await ctx.dataSource.query('DELETE FROM "users"');
    await ctx.dataSource.query('DELETE FROM "players"');
  };

  const footballData = new ControllableFootballDataAdapter();
  const whoScored = new ControllableWhoScoredAdapter();

  beforeAll(async () => {
    ctx = await createTestApp([
      { token: WHOSCORED_ADAPTER, useValue: whoScored },
      { token: FOOTBALL_DATA_ADAPTER, useValue: footballData },
    ]);
    // Sin la espera de 7 s entre requests de Football-Data: el e2e no tarda 70 s.
    ctx.app.get(FootballDataSyncService).setRequestDelay(0);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await clean();
  });

  describe('US1 — mercado', () => {
    it('una compra que cruza con una venta sube operaciones, tokens y volumen', async () => {
      const player = await insertPlayer();
      const seller = await registerAndLogin('vendedor-m1@mail.com', 'vendedorm1');
      const buyer = await registerAndLogin('comprador-m1@mail.com', 'compradorm1');
      await creditHolding(seller.userId, player.id, 10);

      const sell = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${seller.token}`)
        .send({ side: 'SELL', playerId: player.id, quantity: 3 });
      expect(sell.status).toBe(201);
      const price = Number(sell.body.price);

      const opsBefore = await valueOf('business_operations_total', { operation: 'TOKENS_BOUGHT', outcome: 'success' });
      const tokensBefore = await valueOf('market_tokens_traded_total', { side: 'buy' });
      const volumeBefore = await valueOf('market_volume_credits_total', { side: 'buy' });

      const buy = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ side: 'BUY', playerId: player.id, quantity: 2 });
      expect(buy.status).toBe(201);
      expect(buy.body.fills.length).toBeGreaterThan(0);

      expect(await valueOf('business_operations_total', { operation: 'TOKENS_BOUGHT', outcome: 'success' })).toBe(
        opsBefore + 1,
      );
      expect(await valueOf('market_tokens_traded_total', { side: 'buy' })).toBe(tokensBefore + 2);
      const volumeAfter = await valueOf('market_volume_credits_total', { side: 'buy' });
      expect(volumeAfter - volumeBefore).toBeCloseTo(2 * price, 2);
    });

    it('una venta sin tokens sube rechazos con el motivo correcto y no los contadores de éxito', async () => {
      const player = await insertPlayer();
      const seller = await registerAndLogin('vendedor-m2@mail.com', 'vendedorm2');

      const successBefore = await valueOf('business_operations_total', { operation: 'TOKENS_SOLD', outcome: 'success' });
      const rejectedBefore = await valueOf('business_operations_total', { operation: 'TOKENS_SOLD', outcome: 'rejected' });
      const reasonBefore = await valueOf('market_order_rejections_total', { reason: 'insufficient_tokens' });
      const tokensBefore = await valueOf('market_tokens_traded_total', { side: 'sell' });
      const volumeBefore = await valueOf('market_volume_credits_total', { side: 'sell' });

      const res = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${seller.token}`)
        .send({ side: 'SELL', playerId: player.id, quantity: 5 });
      expect(res.status).toBe(400);

      expect(await valueOf('business_operations_total', { operation: 'TOKENS_SOLD', outcome: 'rejected' })).toBe(
        rejectedBefore + 1,
      );
      expect(await valueOf('market_order_rejections_total', { reason: 'insufficient_tokens' })).toBe(reasonBefore + 1);
      expect(await valueOf('business_operations_total', { operation: 'TOKENS_SOLD', outcome: 'success' })).toBe(
        successBefore,
      );
      expect(await valueOf('market_tokens_traded_total', { side: 'sell' })).toBe(tokensBefore);
      expect(await valueOf('market_volume_credits_total', { side: 'sell' })).toBe(volumeBefore);
    });

    it('un jugador inexistente cuenta como rechazo con motivo other', async () => {
      const buyer = await registerAndLogin('comprador-m3@mail.com', 'compradorm3');
      const otherBefore = await valueOf('market_order_rejections_total', { reason: 'other' });

      const res = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ side: 'BUY', playerId: randomUUID(), quantity: 1 });
      expect(res.status).toBe(404);

      expect(await valueOf('market_order_rejections_total', { reason: 'other' })).toBe(otherBefore + 1);
    });

    it('una validación de DTO fallida no cuenta como operación', async () => {
      const player = await insertPlayer();
      const buyer = await registerAndLogin('comprador-m4@mail.com', 'compradorm4');
      const before = (await scrape()).samples.filter((s) => s.name === 'business_operations_total');

      const res = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ side: 'BUY', playerId: player.id, quantity: 1, price: 999 });
      expect(res.status).toBe(400);

      const after = (await scrape()).samples.filter((s) => s.name === 'business_operations_total');
      const total = (samples: PromSample[]) =>
        samples.filter((s) => s.labels.operation?.startsWith('TOKENS_')).reduce((sum, s) => sum + s.value, 0);
      expect(total(after)).toBe(total(before));
    });

    it('todos los valores de las etiquetas pertenecen a los conjuntos cerrados', async () => {
      const { samples } = await scrape();
      const allowed: Record<string, readonly string[]> = {
        side: SIDES,
        reason: REJECTION_REASONS,
        source: SYNC_SOURCES,
        trigger: RUN_TRIGGERS,
        delivery: NOTIFICATION_DELIVERIES,
      };
      const businessNames: string[] = Object.values(BUSINESS_METRIC_NAMES);
      const business = samples.filter((s) => businessNames.some((n) => s.name === n || s.name.startsWith(`${n}_`)));
      expect(business.length).toBeGreaterThan(0);
      for (const sample of business) {
        for (const [label, value] of Object.entries(sample.labels)) {
          if (label === 'le') continue;
          if (label === 'operation') {
            expect(value).toMatch(/^[A-Z_]+$/);
          } else if (label === 'outcome') {
            const set = sample.name.startsWith('business_operations')
              ? OPERATION_OUTCOMES
              : sample.name.startsWith('sync_')
                ? SYNC_OUTCOMES
                : RECALCULATION_OUTCOMES;
            expect(set as readonly string[]).toContain(value);
          } else {
            expect(allowed[label]).toBeDefined();
            expect(allowed[label]).toContain(value);
          }
        }
      }
    });

    it('/metrics expone las doce familias de negocio, con las aclaraciones de HELP', async () => {
      const { text } = await scrape();
      for (const name of Object.values(BUSINESS_METRIC_NAMES)) {
        expect(text).toContain(`# TYPE ${name} `);
      }
      expect(text).toMatch(/# HELP business_operations_total .*corrida aceptada, no corrida terminada/);
      expect(text).toMatch(/# HELP market_order_rejections_total .*sólo el alta de órdenes/);
    });

    it('si medir falla, la operación medida responde igual', async () => {
      const boom = () => {
        throw new Error('métricas rotas');
      };
      const broken = {
        recordOperation: boom,
        recordTokensTraded: boom,
        recordOrderRejection: boom,
        recordSyncRun: boom,
        setSyncLastSuccess: boom,
        recordQuoteRecalculation: boom,
        recordAlertTriggered: boom,
        recordNotificationCreated: boom,
        sseConnectionOpened: boom,
        sseConnectionClosed: boom,
      };
      const ctxBroken = await createTestApp([{ token: BUSINESS_METRICS, useValue: broken }]);
      try {
        const srv = ctxBroken.app.getHttpServer();
        await request(srv).post('/auth/register').send({ email: 'roto@mail.com', password: 'Abcd1234!', username: 'rotouser' });
        const login = await request(srv).post('/auth/login').send({ email: 'roto@mail.com', password: 'Abcd1234!' });
        expect(login.status).toBe(200);
        const res = await request(srv)
          .post('/orders')
          .set('Authorization', `Bearer ${login.body.accessToken}`)
          .send({ side: 'BUY', playerId: randomUUID(), quantity: 1 });
        // Misma respuesta que sin medir: el jugador no existe (404), no un 500 por las métricas.
        expect(res.status).toBe(404);
      } finally {
        await ctxBroken.close();
      }
    });
  });

  /** Usuario admin con API key (las operaciones de sistema exigen `x-api-key` de admin). */
  const adminApiKey = async (email: string, username: string) => {
    await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!', username });
    await ctx.dataSource.getRepository(UserEntity).update({ email }, { role: 'admin' });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    const issued = await request(server())
      .post('/auth/api-key')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    return issued.body.apiKey as string;
  };

  describe('US2 — sincronización de datos', () => {
    const syncRun = (source: string, trigger: string, outcome: string) =>
      valueOf('sync_runs_total', { source, trigger, outcome });
    const lastSuccess = (source: string) =>
      valueOf('sync_last_success_timestamp_seconds', { source }).then((v) => (v === 0 ? undefined : v));

    beforeEach(() => {
      footballData.failingLeagues = [];
      whoScored.teams = [];
      whoScored.failingTeams = [];
    });

    it('Football-Data success: cuenta manual/success, observa la duración y crea el gauge de última sync', async () => {
      const apiKey = await adminApiKey('sync-fd1@mail.com', 'syncfd1');
      const before = await syncRun('football_data', 'manual', 'success');
      const durationBefore = await valueOf('sync_run_duration_seconds_count', { source: 'football_data', trigger: 'manual' });
      const startedAt = Date.now() / 1000;

      const res = await request(server()).post('/sync/football-data').set('x-api-key', apiKey);
      expect(res.status).toBe(200);

      expect(await syncRun('football_data', 'manual', 'success')).toBe(before + 1);
      expect(await valueOf('sync_run_duration_seconds_count', { source: 'football_data', trigger: 'manual' })).toBe(
        durationBefore + 1,
      );
      expect(await lastSuccess('football_data')).toBeGreaterThanOrEqual(Math.floor(startedAt));
      const rows = await ctx.dataSource.query('SELECT source FROM "sync_last_success" WHERE source = $1', ['football_data']);
      expect(rows).toHaveLength(1);
    });

    it('Football-Data partial: sube sólo partial y NO mueve el gauge de última sync', async () => {
      const apiKey = await adminApiKey('sync-fd2@mail.com', 'syncfd2');
      await request(server()).post('/sync/football-data').set('x-api-key', apiKey); // asegura un success previo
      const gaugeBefore = await lastSuccess('football_data');
      expect(gaugeBefore).toBeDefined();
      const partial = await syncRun('football_data', 'manual', 'partial');
      const success = await syncRun('football_data', 'manual', 'success');
      const failure = await syncRun('football_data', 'manual', 'failure');
      const durationBefore = await valueOf('sync_run_duration_seconds_count', { source: 'football_data', trigger: 'manual' });
      footballData.failingLeagues = ['PD'];
      await new Promise((resolve) => setTimeout(resolve, 1100)); // distingue el segundo si el gauge se moviera

      const res = await request(server()).post('/sync/football-data').set('x-api-key', apiKey);
      expect(res.status).toBe(200);

      expect(await syncRun('football_data', 'manual', 'partial')).toBe(partial + 1);
      expect(await syncRun('football_data', 'manual', 'success')).toBe(success);
      expect(await syncRun('football_data', 'manual', 'failure')).toBe(failure);
      expect(await valueOf('sync_run_duration_seconds_count', { source: 'football_data', trigger: 'manual' })).toBe(
        durationBefore + 1,
      );
      expect(await lastSuccess('football_data')).toBe(gaugeBefore);
    });

    it('Football-Data failure (todas las ligas fallan): sube failure y NO mueve el gauge', async () => {
      const apiKey = await adminApiKey('sync-fd3@mail.com', 'syncfd3');
      await request(server()).post('/sync/football-data').set('x-api-key', apiKey);
      const gaugeBefore = await lastSuccess('football_data');
      const failure = await syncRun('football_data', 'manual', 'failure');
      footballData.failingLeagues = 'ALL';
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await request(server()).post('/sync/football-data').set('x-api-key', apiKey);

      expect(await syncRun('football_data', 'manual', 'failure')).toBe(failure + 1);
      expect(await lastSuccess('football_data')).toBe(gaugeBefore);
    });

    /** Dispara WhoScored (202) y espera a que la corrida en segundo plano termine. */
    const runWhoScored = async (apiKey: string) => {
      const accepted = await request(server()).post('/sync/whoscored').set('x-api-key', apiKey);
      expect(accepted.status).toBe(202);
      const runId = accepted.body.runId as string;
      for (let i = 0; i < 100; i++) {
        const status = await request(server()).get(`/sync/whoscored/${runId}`).set('x-api-key', apiKey);
        if (status.body.status !== 'running') return status.body;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error('La corrida de WhoScored no terminó');
    };

    it('WhoScored: success, partial y failure por origen manual; sólo success mueve el gauge', async () => {
      const apiKey = await adminApiKey('sync-ws1@mail.com', 'syncws1');
      const acceptedBefore = await valueOf('business_operations_total', {
        operation: 'PLAYER_SYNC_TRIGGERED',
        outcome: 'success',
      });

      const successBefore = await syncRun('whoscored', 'manual', 'success');
      await runWhoScored(apiKey);
      expect(await syncRun('whoscored', 'manual', 'success')).toBe(successBefore + 1);
      const gaugeAfterSuccess = await lastSuccess('whoscored');
      expect(gaugeAfterSuccess).toBeDefined();
      // "success" de la operación = corrida aceptada (202), distinto del resultado de la corrida.
      expect(
        await valueOf('business_operations_total', { operation: 'PLAYER_SYNC_TRIGGERED', outcome: 'success' }),
      ).toBe(acceptedBefore + 1);

      whoScored.teams = [
        { externalTeamId: 't1', team: 'Equipo Uno' },
        { externalTeamId: 't2', team: 'Equipo Dos' },
      ];
      whoScored.failingTeams = ['t2'];
      const partialBefore = await syncRun('whoscored', 'manual', 'partial');
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await runWhoScored(apiKey);
      expect(await syncRun('whoscored', 'manual', 'partial')).toBe(partialBefore + 1);
      expect(await lastSuccess('whoscored')).toBe(gaugeAfterSuccess);

      whoScored.failingTeams = ['t1', 't2'];
      const failureBefore = await syncRun('whoscored', 'manual', 'failure');
      await runWhoScored(apiKey);
      expect(await syncRun('whoscored', 'manual', 'failure')).toBe(failureBefore + 1);
      expect(await lastSuccess('whoscored')).toBe(gaugeAfterSuccess);
    });

    it('al reiniciar el backend sobre la misma base, la última sync exitosa se conserva y los contadores vuelven a 0', async () => {
      const apiKey = await adminApiKey('sync-restart@mail.com', 'syncrestart');
      await request(server()).post('/sync/football-data').set('x-api-key', apiKey);
      const gauge = await lastSuccess('football_data');
      expect(gauge).toBeDefined();
      expect(await syncRun('football_data', 'manual', 'success')).toBeGreaterThan(0);

      const restarted = await createTestApp();
      try {
        const res = await request(restarted.app.getHttpServer()).get('/metrics');
        const samples = parsePrometheusText(res.text);
        expect(sampleValue(samples, 'sync_last_success_timestamp_seconds', { source: 'football_data' })).toBe(gauge);
        expect(sampleValue(samples, 'sync_runs_total', { source: 'football_data', trigger: 'manual', outcome: 'success' })).toBe(
          undefined,
        );
      } finally {
        await restarted.close();
      }
    });
  });

  describe('US3 — recálculos de cotización', () => {
    const recalcs = (trigger: string, outcome: string) =>
      valueOf('quote_recalculations_total', { trigger, outcome });

    it('POST /quotes/recalculate cuenta manual/success y observa la duración', async () => {
      const apiKey = await adminApiKey('quote-m1@mail.com', 'quotem1');
      const before = await recalcs('manual', 'success');
      const durationBefore = await valueOf('quote_recalculation_duration_seconds_count', { trigger: 'manual' });

      const res = await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);
      expect(res.status).toBe(200);

      expect(await recalcs('manual', 'success')).toBe(before + 1);
      expect(await valueOf('quote_recalculation_duration_seconds_count', { trigger: 'manual' })).toBe(durationBefore + 1);
      expect(await recalcs('scheduled', 'success')).toBe(0);
    });

    it('POST /admin/simulate-market incrementa quote_recalculations_total{trigger="manual"} exactamente en 1 (sin doble conteo)', async () => {
      // La simulación opera siempre sobre la cuenta ADMIN_EMAIL y necesita un catálogo con varios jugadores.
      for (let i = 0; i < 8; i++) await insertPlayer();
      const apiKey = await adminApiKey(process.env.ADMIN_EMAIL ?? 'admin@desapp.com', 'quotesim');
      const manualBefore =
        (await recalcs('manual', 'success')) + (await recalcs('manual', 'failure'));
      const successBefore = await recalcs('manual', 'success');

      const res = await request(server()).post('/admin/simulate-market').set('x-api-key', apiKey);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const manualAfter = (await recalcs('manual', 'success')) + (await recalcs('manual', 'failure'));
      expect(manualAfter).toBe(manualBefore + 1);
      expect(await recalcs('manual', 'success')).toBe(successBefore + 1);
    });
  });

  describe('US4 — alertas, notificaciones y conexiones SSE', () => {
    /** Abre el stream SSE y devuelve cuando llegaron los headers; `close()` corta la conexión. */
    const openStream = (jwt: string): Promise<{ close: () => void }> =>
      new Promise((resolve, reject) => {
        const { port } = ctx.app.getHttpServer().address() as { port: number };
        const req = http.get({ host: '127.0.0.1', port, path: `/notifications/stream?token=${jwt}` }, (res) => {
          res.on('data', () => undefined);
          resolve({ close: () => res.destroy() });
        });
        req.on('error', reject);
      });

    const waitForGauge = async (expected: number, timeoutMs = 3000): Promise<number> => {
      const deadline = Date.now() + timeoutMs;
      let value = await valueOf('sse_connections_active');
      while (value !== expected && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        value = await valueOf('sse_connections_active');
      }
      return value;
    };

    const createAlert = async (token: string, playerId: string) => {
      const res = await request(server())
        .post('/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send({ playerId, condition: 'PRICE_BELOW', targetValue: 999999 });
      expect(res.status).toBe(201);
    };

    it('alerta disparada con el usuario conectado: cuenta la alerta y la notificación como live', async () => {
      const player = await insertPlayer();
      const user = await registerAndLogin('alert-live@mail.com', 'alertlive');
      const apiKey = await adminApiKey('alert-live-admin@mail.com', 'alertliveadm');
      await createAlert(user.token, player.id);
      const connectionsBefore = await valueOf('sse_connections_active');
      const alertsBefore = await valueOf('alerts_triggered_total');
      const liveBefore = await valueOf('notifications_created_total', { delivery: 'live' });
      const storedBefore = await valueOf('notifications_created_total', { delivery: 'stored_only' });

      const stream = await openStream(user.token);
      expect(await waitForGauge(connectionsBefore + 1)).toBe(connectionsBefore + 1);
      await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);

      expect(await valueOf('alerts_triggered_total')).toBe(alertsBefore + 1);
      expect(await valueOf('notifications_created_total', { delivery: 'live' })).toBe(liveBefore + 1);
      expect(await valueOf('notifications_created_total', { delivery: 'stored_only' })).toBe(storedBefore);

      stream.close();
      expect(await waitForGauge(connectionsBefore)).toBe(connectionsBefore);
    });

    it('alerta disparada sin conexión: la notificación se cuenta como stored_only', async () => {
      const player = await insertPlayer();
      const user = await registerAndLogin('alert-stored@mail.com', 'alertstored');
      const apiKey = await adminApiKey('alert-stored-admin@mail.com', 'alertstoredadm');
      await createAlert(user.token, player.id);
      const alertsBefore = await valueOf('alerts_triggered_total');
      const liveBefore = await valueOf('notifications_created_total', { delivery: 'live' });
      const storedBefore = await valueOf('notifications_created_total', { delivery: 'stored_only' });

      await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);

      expect(await valueOf('alerts_triggered_total')).toBe(alertsBefore + 1);
      expect(await valueOf('notifications_created_total', { delivery: 'stored_only' })).toBe(storedBefore + 1);
      expect(await valueOf('notifications_created_total', { delivery: 'live' })).toBe(liveBefore);
    });

    it('tras desconectarse el cliente, la notificación siguiente ya queda stored_only y el gauge vuelve a su valor', async () => {
      const player = await insertPlayer();
      const user = await registerAndLogin('alert-gone@mail.com', 'alertgone');
      const apiKey = await adminApiKey('alert-gone-admin@mail.com', 'alertgoneadm');
      await createAlert(user.token, player.id);
      const connectionsBefore = await valueOf('sse_connections_active');
      const liveBefore = await valueOf('notifications_created_total', { delivery: 'live' });
      const storedBefore = await valueOf('notifications_created_total', { delivery: 'stored_only' });

      const stream = await openStream(user.token);
      expect(await waitForGauge(connectionsBefore + 1)).toBe(connectionsBefore + 1);
      stream.close(); // cierre abrupto del cliente
      expect(await waitForGauge(connectionsBefore)).toBe(connectionsBefore);

      await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);

      expect(await valueOf('notifications_created_total', { delivery: 'stored_only' })).toBe(storedBefore + 1);
      expect(await valueOf('notifications_created_total', { delivery: 'live' })).toBe(liveBefore);
    });
  });

  // MARCADOR-E2E: las historias siguientes agregan sus describe antes de esta línea.
});
