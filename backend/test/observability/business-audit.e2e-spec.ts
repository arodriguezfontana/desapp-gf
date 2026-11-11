import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { PlayerEntity } from '../../src/repositories/player/entities/player.entity';
import { TokenHoldingEntity } from '../../src/repositories/portfolio/entities/token-holding.entity';
import { UserEntity } from '../../src/repositories/auth/entities/user.entity';
import { LOG_CONFIG } from '../../src/modules/observability/logging.constants';
import { createLogCapture, LogLine } from './helpers/log-capture';
import { createTestApp, TestContext } from '../test-app';

/**
 * 028-structured-request-logging, User Story 5: auditoría de negocio transversal por AOP. Los logs se capturan en
 * memoria (nivel info) y la base es la efímera de Testcontainers.
 */
const capture = createLogCapture();
let ctx: TestContext;
const server = () => ctx.app.getHttpServer();

const PASSWORD = 'Abcd1234!';

const registerAndLogin = async (email: string, username: string) => {
  await request(server()).post('/auth/register').send({ email, password: PASSWORD, username });
  const login = await request(server()).post('/auth/login').send({ email, password: PASSWORD });
  const token = login.body.accessToken as string;
  const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${token}`);
  return { token, userId: me.body.id as string, email };
};

const insertPlayer = async (): Promise<PlayerEntity> => {
  const player: Partial<PlayerEntity> = {
    id: randomUUID(),
    externalId: `ext-${randomUUID()}`,
    name: 'Jugador Auditoría',
    league: 'Premier League',
    team: 'Audit FC',
    position: 'FW',
    rating: 7,
  };
  await ctx.dataSource.getRepository(PlayerEntity).save(player);
  return player as PlayerEntity;
};

const creditHolding = (userId: string, playerId: string, quantity: number) =>
  ctx.dataSource.getRepository(TokenHoldingEntity).save({ id: randomUUID(), userId, playerId, quantity, updatedAt: new Date() });

const placeOrder = (token: string, side: string, playerId: string, quantity: number) =>
  request(server()).post('/orders').set('Authorization', `Bearer ${token}`).send({ side, playerId, quantity });

const auditLines = (): LogLine[] => capture.lines().filter((line) => line.event === 'business_audit');

/** La línea de cierre de `pino-http` se emite un instante después de que el cliente recibe la respuesta. */
async function eventually<T>(read: () => T, ok: (value: T) => boolean, timeoutMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = read();
  while (!ok(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    value = read();
  }
  return value;
}

const technicalLine = (id: string): LogLine | undefined =>
  capture.byCorrelationId(id).find((line) => line.msg === 'request completed' || line.msg === 'request errored');

const waitForTechnical = (id: string) => eventually(() => technicalLine(id), (line) => line !== undefined);

beforeAll(async () => {
  ctx = await createTestApp([{ token: LOG_CONFIG, useValue: capture.config }]);
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await ctx.dataSource.query('DELETE FROM "token_transactions"');
  await ctx.dataSource.query('DELETE FROM "orders"');
  await ctx.dataSource.query('DELETE FROM "token_holdings"');
  await ctx.dataSource.query('DELETE FROM "notifications"');
  await ctx.dataSource.query('DELETE FROM "price_alerts"');
  await ctx.dataSource.query('DELETE FROM "api_keys"');
  await ctx.clearUsers();
  await ctx.dataSource.query('DELETE FROM "players"');
  capture.clear();
});

describe('US5: auditoría de negocio por AOP (e2e, spec 028)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('compra y venta por el mismo POST /orders dejan TOKENS_BOUGHT y TOKENS_SOLD, con su actor y resultado', async () => {
    const player = await insertPlayer();
    const seller = await registerAndLogin('audit-seller@mail.com', 'audit-seller');
    const buyer = await registerAndLogin('audit-buyer@mail.com', 'audit-buyer');
    await creditHolding(seller.userId, player.id, 10);
    capture.clear();

    const sell = await placeOrder(seller.token, 'SELL', player.id, 5);
    const buy = await placeOrder(buyer.token, 'BUY', player.id, 5);

    expect([sell.status, buy.status]).toEqual([201, 201]);
    expect(auditLines()).toEqual([
      expect.objectContaining({ operation: 'TOKENS_SOLD', actor: seller.userId, outcome: 'success', correlationId: sell.headers['x-correlation-id'] }),
      expect.objectContaining({ operation: 'TOKENS_BOUGHT', actor: buyer.userId, outcome: 'success', correlationId: buy.headers['x-correlation-id'] }),
    ]);
  });

  it('una venta con tenencia insuficiente es un fallo "rejected" (nivel warn), sin stack ni mensaje interno', async () => {
    const player = await insertPlayer();
    const user = await registerAndLogin('audit-poor@mail.com', 'audit-poor');
    capture.clear();

    const res = await placeOrder(user.token, 'SELL', player.id, 5);

    expect(res.status).toBe(400);
    const [line] = auditLines();
    expect(line).toMatchObject({
      operation: 'TOKENS_SOLD',
      actor: user.userId,
      outcome: 'failure',
      failureCategory: 'rejected',
      level: 40,
    });
    expect(line.err).toBeUndefined();
    expect(JSON.stringify(line)).not.toMatch(/tokens de este jugador/);
  });

  it('crear una alerta deja ALERT_CREATED con el UUID del usuario como actor', async () => {
    const player = await insertPlayer();
    const user = await registerAndLogin('audit-alert@mail.com', 'audit-alert');
    capture.clear();

    const res = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 15.5 });

    expect(res.status).toBe(201);
    expect(auditLines()).toEqual([
      expect.objectContaining({ operation: 'ALERT_CREATED', actor: user.userId, outcome: 'success' }),
    ]);
  });

  it('una operación de sistema por API key deja actor "sistema" y la API key no aparece en ninguna línea', async () => {
    const admin = await registerAndLogin('audit-admin@mail.com', 'audit-admin');
    await ctx.dataSource.getRepository(UserEntity).update({ email: admin.email }, { role: 'admin' });
    const issued = await request(server()).post('/auth/api-key').set('Authorization', `Bearer ${admin.token}`);
    const apiKey = issued.body.apiKey as string;
    expect(apiKey).toBeTruthy();
    capture.clear();

    const res = await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);

    expect(res.status).toBe(200);
    expect(auditLines()).toEqual([
      expect.objectContaining({ operation: 'QUOTES_RECALCULATED', actor: 'sistema', outcome: 'success' }),
    ]);
    await waitForTechnical(res.headers['x-correlation-id']);
    expect(capture.raw()).not.toContain(apiKey);
  });

  it('el alta y el login dejan USER_REGISTERED y USER_LOGGED_IN con actor "anónimo", sin email ni contraseña', async () => {
    const email = 'audit-anon@mail.com';

    await request(server()).post('/auth/register').send({ email, password: PASSWORD, username: 'audit-anon' });
    await request(server()).post('/auth/login').send({ email, password: PASSWORD });

    const lines = auditLines();
    expect(lines.map((l) => [l.operation, l.actor, l.outcome])).toEqual([
      ['USER_REGISTERED', 'anónimo', 'success'],
      ['USER_LOGGED_IN', 'anónimo', 'success'],
    ]);
    for (const line of lines) {
      expect(JSON.stringify(line)).not.toContain(email);
      expect(JSON.stringify(line)).not.toContain(PASSWORD);
    }
  });

  it('un login con credenciales inválidas es un fallo "rejected" con actor "anónimo"', async () => {
    const email = 'audit-bad@mail.com';
    await request(server()).post('/auth/register').send({ email, password: PASSWORD, username: 'audit-bad' });
    capture.clear();

    const res = await request(server()).post('/auth/login').send({ email, password: 'OtraClave1!' });

    expect(res.status).toBe(401);
    expect(auditLines()).toEqual([
      expect.objectContaining({ operation: 'USER_LOGGED_IN', actor: 'anónimo', outcome: 'failure', failureCategory: 'rejected' }),
    ]);
  });

  describe('lo que NO genera registro de auditoría de negocio', () => {
    it('una request sin autenticación (401) queda sólo en el log técnico', async () => {
      const res = await request(server()).post('/orders').send({ side: 'BUY', playerId: randomUUID(), quantity: 1 });
      const technical = await waitForTechnical(res.headers['x-correlation-id']);

      expect(res.status).toBe(401);
      expect(technical).toBeDefined();
      expect(auditLines()).toEqual([]);
    });

    it('una ruta inexistente (404) queda sólo en el log técnico', async () => {
      const res = await request(server()).post('/ruta-que-no-existe').send({});
      await waitForTechnical(res.headers['x-correlation-id']);

      expect(res.status).toBe(404);
      expect(auditLines()).toEqual([]);
    });

    it('un cuerpo JSON ilegible (400 del parser) queda sólo en el log técnico', async () => {
      const res = await request(server()).post('/auth/login').set('Content-Type', 'application/json').send('{"a":');
      await waitForTechnical(res.headers['x-correlation-id']);

      expect(res.status).toBe(400);
      expect(auditLines()).toEqual([]);
    });

    it('un cuerpo que no pasa la validación del DTO (400) no se audita: la operación nunca se ejecutó', async () => {
      const user = await registerAndLogin('audit-dto@mail.com', 'audit-dto');
      capture.clear();

      const res = await request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ side: 'BUY' });
      await waitForTechnical(res.headers['x-correlation-id']);

      expect(res.status).toBe(400);
      expect(auditLines()).toEqual([]);
    });

    it('una consulta de lectura no se audita', async () => {
      const user = await registerAndLogin('audit-read@mail.com', 'audit-read');
      capture.clear();

      const res = await request(server()).get('/orders').set('Authorization', `Bearer ${user.token}`);
      await waitForTechnical(res.headers['x-correlation-id']);

      expect(res.status).toBe(200);
      expect(auditLines()).toEqual([]);
    });
  });

  describe('relación con el log técnico', () => {
    it('la línea de negocio comparte el correlationId con la línea técnica de su request', async () => {
      const player = await insertPlayer();
      const user = await registerAndLogin('audit-corr@mail.com', 'audit-corr');
      capture.clear();

      const res = await request(server())
        .post('/alerts')
        .set('Authorization', `Bearer ${user.token}`)
        .set('X-Correlation-Id', 'trace-audit-1')
        .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 10 });
      await waitForTechnical('trace-audit-1');

      expect(res.headers['x-correlation-id']).toBe('trace-audit-1');
      const lines = capture.byCorrelationId('trace-audit-1');
      expect(lines.filter((l) => l.event === 'business_audit')).toHaveLength(1);
      expect(lines.filter((l) => l.msg === 'request completed')).toHaveLength(1);
    });

    it('la línea de negocio no repite campos técnicos y no contiene secretos', async () => {
      const player = await insertPlayer();
      const user = await registerAndLogin('audit-fields@mail.com', 'audit-fields');
      capture.clear();

      await request(server())
        .post('/alerts')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 10 });

      const [line] = auditLines();
      expect(line.msg).toBe('operación de negocio');
      expect(line.context).toBe('BusinessAudit');
      for (const technicalKey of ['req', 'res', 'responseTime', 'body', 'query', 'params', 'route', 'err']) {
        expect(line[technicalKey]).toBeUndefined();
      }
      expect(JSON.stringify(line)).not.toContain(user.token);
      expect(JSON.stringify(line)).not.toContain('audit-fields@mail.com');
    });
  });

  it('un fallo del sistema de logs al registrar la auditoría no cambia la respuesta (FR-025)', async () => {
    const player = await insertPlayer();
    const user = await registerAndLogin('audit-broken@mail.com', 'audit-broken');
    const original = Logger.prototype.log;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(function (this: Logger, ...args: unknown[]) {
      if ((args[0] as { event?: string } | undefined)?.event === 'business_audit') throw new Error('logger roto');
      return (original as (...a: unknown[]) => void).apply(this, args);
    });

    const res = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 12 });

    expect(res.status).toBe(201);
    expect(res.body.playerId).toBe(player.id);
  });
});
