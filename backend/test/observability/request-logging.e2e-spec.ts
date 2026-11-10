import * as http from 'node:http';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, TestContext } from '../test-app';
import { createLogCapture, LogLine } from './helpers/log-capture';
import { LOG_CONFIG } from '../../src/modules/observability/logging.constants';
import { UserRepository } from '../../src/repositories/auth/user.repository';

/**
 * 028-structured-request-logging. Los logs se capturan en memoria sobrescribiendo
 * `LOG_CONFIG` (nivel info); la base es la efímera de Testcontainers.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const capture = createLogCapture();
let ctx: TestContext;
const server = () => ctx.app.getHttpServer();

/** `pino-http` escribe la línea de cierre en `finish`/`close`, un instante después de que el cliente recibe la respuesta. */
async function eventually<T>(read: () => T, ok: (value: T) => boolean, timeoutMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = read();
  while (!ok(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    value = read();
  }
  return value;
}

const completionLine = (id: string): LogLine | undefined =>
  capture.byCorrelationId(id).find((line) => line.msg === 'request completed');

const waitForCompletion = async (id: string): Promise<LogLine> => {
  const line = await eventually(() => completionLine(id), (l) => l !== undefined);
  if (!line) {
    throw new Error(`No se registró la línea de cierre del Correlation ID ${id}`);
  }
  return line;
};

beforeAll(async () => {
  ctx = await createTestApp([{ token: LOG_CONFIG, useValue: capture.config }]);
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(() => {
  capture.clear();
});

describe('US1: Correlation ID y traza completa (e2e, spec 028)', () => {
  it('GET / (200): devuelve X-Correlation-Id (UUID v4) y deja una línea con ese id', async () => {
    const res = await request(server()).get('/');

    const id = res.headers['x-correlation-id'];
    expect(res.status).toBe(200);
    expect(id).toMatch(UUID_V4);
    expect((await waitForCompletion(id)).correlationId).toBe(id);
  });

  it('401 por falta de autenticación: también devuelve el header y deja su línea', async () => {
    const res = await request(server()).get('/auth/me');

    const id = res.headers['x-correlation-id'];
    expect(res.status).toBe(401);
    expect(id).toMatch(UUID_V4);
    expect((await waitForCompletion(id)).res).toEqual({ statusCode: 401 });
  });

  it('404 por ruta inexistente: también devuelve el header y deja su línea', async () => {
    const res = await request(server()).get('/ruta-que-no-existe');

    const id = res.headers['x-correlation-id'];
    expect(res.status).toBe(404);
    expect(id).toMatch(UUID_V4);
    expect((await waitForCompletion(id)).res).toEqual({ statusCode: 404 });
  });

  it('400 por JSON mal formado (lo rechaza el parser): también devuelve el header y deja su línea', async () => {
    const res = await request(server())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"a":');

    const id = res.headers['x-correlation-id'];
    expect(res.status).toBe(400);
    expect(id).toMatch(UUID_V4);
    expect((await waitForCompletion(id)).res).toEqual({ statusCode: 400 });
  });

  it('una request rechazada (4xx) deja una sola línea: el filtro de excepciones no la repite', async () => {
    const res = await request(server()).get('/auth/me');
    const id = res.headers['x-correlation-id'];

    await waitForCompletion(id);
    const lines = capture.byCorrelationId(id);

    expect(lines).toHaveLength(1);
    expect(lines[0].msg).toBe('request completed');
    expect(capture.lines().some((line) => line.context === 'AllExceptionsFilter')).toBe(false);
  });

  it('requests concurrentes: cada id agrupa sólo las líneas de su request (FR-010)', async () => {
    const targets = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? '/' : '/auth/me'));

    const responses = await Promise.all(targets.map((url) => request(server()).get(url)));
    const ids = responses.map((res) => res.headers['x-correlation-id'] as string);
    await Promise.all(ids.map((id) => waitForCompletion(id)));

    expect(new Set(ids).size).toBe(10);
    let total = 0;
    responses.forEach((_, i) => {
      const lines = capture.byCorrelationId(ids[i]);
      total += lines.length;
      // Cada request deja exactamente una línea (la de cierre), también las rechazadas con 401.
      expect(lines).toHaveLength(1);
      expect(lines.every((line) => line.correlationId === ids[i])).toBe(true);
      expect((completionLine(ids[i])?.req as { url: string }).url).toBe(targets[i]);
    });
    expect(capture.lines().filter((line) => line.correlationId !== undefined)).toHaveLength(total);
  });
});

describe('US2: registro automático con los datos clave (e2e, spec 028)', () => {
  const registerAndLogin = async (email: string) => {
    const password = 'Abcd1234!';
    await request(server()).post('/auth/register').send({ email, password, username: 'user-logs' });
    const login = await request(server()).post('/auth/login').send({ email, password });
    return { token: login.body.accessToken as string, password };
  };

  beforeEach(async () => {
    await ctx.clearUsers();
    capture.clear();
  });

  it('request autenticada: usuario, método, URL, status, duración, hora y Correlation ID', async () => {
    const { token } = await registerAndLogin('ana.logs@mail.com');
    capture.clear();

    const res = await request(server()).get('/auth/me').set('Authorization', `Bearer ${token}`);
    const line = await waitForCompletion(res.headers['x-correlation-id']);

    expect(res.status).toBe(200);
    expect(line.userId).toBe(res.body.id);
    expect(line.req).toEqual({ method: 'GET', url: '/auth/me' });
    expect(line.res).toEqual({ statusCode: 200 });
    expect(typeof line.responseTime).toBe('number');
    expect(line.responseTime as number).toBeGreaterThanOrEqual(0);
    expect(typeof line.time).toBe('number');
    expect(line.level).toBe(30);
  });

  it('ruta pública sin credenciales: el usuario es "anónimo"', async () => {
    const res = await request(server()).get('/');

    expect((await waitForCompletion(res.headers['x-correlation-id'])).userId).toBe('anónimo');
  });

  it('request rechazada con cuerpo: queda el cuerpo, el status 401 y nivel warn', async () => {
    const res = await request(server())
      .post('/auth/login')
      .send({ email: 'nadie@mail.com', password: 'Abcd1234!' });
    const line = await waitForCompletion(res.headers['x-correlation-id']);

    expect(res.status).toBe(401);
    expect(line.res).toEqual({ statusCode: 401 });
    expect(line.level).toBe(40);
    expect(line.body).toBeDefined();
    expect(line.userId).toBe('anónimo');
  });

  it('parámetro de ruta y query: quedan el patrón, los params y la query', async () => {
    const { token } = await registerAndLogin('beto.logs@mail.com');
    // El catálogo arranca vacío en la base efímera: alcanza con que la ruta con parámetro se resuelva (JWT, sin API key).
    const playerId = '00000000-0000-4000-8000-000000000001';
    capture.clear();

    const res = await request(server())
      .get(`/players/${playerId}/quotes?origen=test`)
      .set('Authorization', `Bearer ${token}`);
    const line = await waitForCompletion(res.headers['x-correlation-id']);

    expect(res.status).not.toBe(401);
    expect(line.route).toBe('/players/:id/quotes');
    expect(line.params).toEqual({ id: playerId });
    expect(line.query).toEqual({ origen: 'test' });
    expect((line.req as { url: string }).url).toBe(`/players/${playerId}/quotes?origen=test`);
  });

  it('request sin cuerpo: la entrada no tiene la clave "body"', async () => {
    const res = await request(server()).get('/');
    const line = await waitForCompletion(res.headers['x-correlation-id']);

    expect(line).not.toHaveProperty('body');
  });

  it('no se registra el cuerpo de la respuesta (FR-013): ni el token del login exitoso', async () => {
    const { token } = await registerAndLogin('carla.logs@mail.com');

    expect(token).toBeTruthy();
    expect(capture.raw()).not.toContain(token);
    expect(capture.raw()).not.toContain('accessToken');
  });

  it('toda línea capturada, incluidas las que no son de requests, es JSON válido (FR-005)', async () => {
    await request(server()).get('/');
    await request(server()).get('/auth/me');

    expect(() => capture.lines()).not.toThrow();
    expect(capture.lines().length).toBeGreaterThan(0);
  });
});

describe('US3: ningún secreto ni dato personal en los logs (e2e, spec 028)', () => {
  const EMAIL = 'secreto.logs@mail.com';
  const PASSWORD = 'Abcd1234!';
  const USERNAME = 'nombre.privado';

  beforeEach(async () => {
    await ctx.clearUsers();
    capture.clear();
  });

  /** GET a la ruta indicada, esperando sólo los headers y cortando la conexión (la línea se emite al cerrar). */
  const openAndAbort = (path: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const { port } = ctx.app.getHttpServer().address() as { port: number };
      const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
        res.destroy();
        resolve();
      });
      req.on('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'ECONNRESET') resolve();
        else reject(error);
      });
    });

  it('contraseña, email, JWT, API key y token de la URL no aparecen en ninguna línea', async () => {
    const register = await request(server())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD, username: USERNAME });
    const login = await request(server()).post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    const jwt = login.body.accessToken as string;
    expect(jwt).toBeTruthy();

    const issued = await request(server()).post('/auth/api-key').set('Authorization', `Bearer ${jwt}`);
    const apiKey = issued.body.apiKey as string;
    expect(apiKey).toBeTruthy();
    await request(server())
      .get('/players/00000000-0000-4000-8000-000000000001')
      .set('x-api-key', apiKey);

    await request(server()).get('/notifications/stream?token=token-invalido');
    await openAndAbort(`/notifications/stream?token=${jwt}`);

    const streamLine = await eventually(
      () =>
        capture
          .lines()
          .filter((line) => (line.req as { url?: string } | undefined)?.url?.startsWith('/notifications/stream'))
          .find((line) => (line.req as { url: string }).url.includes('token=[REDACTED]') && line.res),
      (line) => line !== undefined,
    );

    expect(register.status).toBe(201);
    expect(streamLine).toBeDefined();
    const everything = capture.raw();
    for (const secret of [PASSWORD, EMAIL, USERNAME, jwt, apiKey, 'Bearer ', 'token-invalido']) {
      expect(everything).not.toContain(secret);
    }
  });

  it('el registro y el login dejan el cuerpo con contraseña y email redactados', async () => {
    const res = await request(server())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD, username: USERNAME });
    const line = await waitForCompletion(res.headers['x-correlation-id']);

    expect(line.body).toMatchObject({
      email: '[REDACTED]',
      password: '[REDACTED]',
      username: '[REDACTED]',
    });
  });
});

describe('US4: reutilizar el Correlation ID entrante (e2e, spec 028)', () => {
  beforeEach(() => {
    capture.clear();
  });

  it('un id entrante válido se devuelve igual y queda en el log', async () => {
    const res = await request(server()).get('/').set('X-Correlation-Id', 'mi-id-123');

    expect(res.headers['x-correlation-id']).toBe('mi-id-123');
    expect((await waitForCompletion('mi-id-123')).correlationId).toBe('mi-id-123');
  });

  it('tres requests con el mismo id se recuperan juntas con un solo filtro', async () => {
    const id = 'retry-7f3a-001';

    const responses = [
      await request(server()).get('/').set('X-Correlation-Id', id),
      await request(server()).get('/auth/me').set('X-Correlation-Id', id),
      await request(server()).get('/ruta-que-no-existe').set('X-Correlation-Id', id),
    ];
    responses.forEach((res) => expect(res.headers['x-correlation-id']).toBe(id));

    const lines = await eventually(
      () => capture.byCorrelationId(id).filter((line) => line.msg === 'request completed'),
      (found) => found.length === 3,
    );
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => (line.req as { url: string }).url).sort()).toEqual(
      ['/', '/auth/me', '/ruta-que-no-existe'].sort(),
    );
  });

  it.each([
    ['con espacio y comillas', 'a b"c'],
    ['de 65 caracteres', 'x'.repeat(65)],
    ['con barra', 'a/b'],
    ['con tilde', 'identificación'],
  ])('un id entrante %s se descarta y se genera un UUID propio', async (_label, incoming) => {
    const res = await request(server()).get('/').set('X-Correlation-Id', incoming);

    const id = res.headers['x-correlation-id'];
    expect(id).not.toBe(incoming);
    expect(id).toMatch(UUID_V4);
    expect((await waitForCompletion(id)).correlationId).toBe(id);
    expect(capture.raw()).not.toContain(incoming);
  });

  it('un id entrante vacío se reemplaza por un UUID propio', async () => {
    const res = await request(server()).get('/').set('X-Correlation-Id', '');

    expect(res.headers['x-correlation-id']).toMatch(UUID_V4);
  });

  it('el id entrante se reutiliza también en las respuestas de error', async () => {
    const res = await request(server()).get('/auth/me').set('X-Correlation-Id', 'err-id-1');

    expect(res.status).toBe(401);
    expect(res.headers['x-correlation-id']).toBe('err-id-1');
    expect((await waitForCompletion('err-id-1')).correlationId).toBe('err-id-1');
  });
});

describe('Un fallo inesperado (5xx) conserva el log del filtro con el Correlation ID (e2e, spec 028, FR-008)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('el 5xx deja la línea de cierre (nivel error) y la del filtro con el stack, ambas con el mismo id', async () => {
    capture.clear();
    // `findById` lo usa el JwtAuthGuard tras validar el token: si falla con un Error común, la request termina en 500.
    jest
      .spyOn(ctx.app.get(UserRepository), 'findById')
      .mockRejectedValue(new Error('fallo inesperado de prueba'));
    const token = ctx.app.get(JwtService).sign({ sub: 'u-1' });

    const res = await request(server()).get('/auth/me').set('Authorization', `Bearer ${token}`);
    const id = res.headers['x-correlation-id'];

    const lines = await eventually(
      () => capture.byCorrelationId(id),
      (found) => found.length >= 2,
    );
    const completed = lines.find((line) => line.msg === 'request errored');
    const fromFilter = lines.find((line) => line.context === 'AllExceptionsFilter');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Ocurrió un error inesperado.');
    expect(lines).toHaveLength(2);
    expect(completed?.level).toBe(50);
    expect(completed?.res).toEqual({ statusCode: 500 });
    expect(fromFilter?.level).toBe(50);
    // El stack real queda sólo en la línea del filtro; la de cierre no repite un error fabricado.
    expect(JSON.stringify(fromFilter)).toContain('fallo inesperado de prueba');
    expect(completed).not.toHaveProperty('err');
    // El mensaje interno nunca llega al cliente.
    expect(JSON.stringify(res.body)).not.toContain('fallo inesperado');
  });
});
