import * as http from 'node:http';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, TestContext } from './test-app';
import { createLogCapture } from './helpers/log-capture';
import { familyNames, parsePrometheusText, PromSample, sampleValue } from './helpers/prom-text';
import { LOG_CONFIG } from '../src/modules/logging/logging.constants';
import { UserRepository } from '../src/repositories/auth/user.repository';

/**
 * 029-http-metrics-sla. Se usa `createTestApp()` SIN sobrescribir `LOG_CONFIG`: el logger queda en
 * `silent` y así se comprueba que la medición no depende del nivel de log. La base es la efímera de
 * Testcontainers. Los contadores acumulan durante todo el archivo; las comparaciones son por diferencia.
 */
let ctx: TestContext;
const server = () => ctx.app.getHttpServer();

/** Consulta `/metrics` (sin credenciales) y devuelve el texto y sus muestras. */
async function scrape(): Promise<{ text: string; samples: PromSample[]; status: number }> {
  const res = await request(server()).get('/metrics');
  return { text: res.text, samples: parsePrometheusText(res.text), status: res.status };
}

const COUNTER = 'http_requests_total';
const DURATION_COUNT = 'http_request_duration_seconds_count';

type Labels = { method: string; route: string; status_code: string };

/** Valor actual (0 si la serie aún no existe) de una muestra de `/metrics`. */
async function valueOf(name: string, labels: Labels): Promise<number> {
  return sampleValue((await scrape()).samples, name, labels) ?? 0;
}

/**
 * `pino-http` registra la request en `finish`/`close`, un instante después de que el cliente recibe la
 * respuesta: se reconsulta `/metrics` hasta que la serie llegue al valor esperado.
 */
async function waitForValue(
  name: string,
  labels: Labels,
  expected: number,
  timeoutMs = 3000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let value = await valueOf(name, labels);
  while (value < expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    value = await valueOf(name, labels);
  }
  return value;
}

/** Ejecuta `action` y devuelve cuánto aumentó el contador y el conteo del histograma de esa serie. */
async function increaseOf(
  labels: Labels,
  action: () => Promise<unknown>,
): Promise<{ counter: number; histogram: number }> {
  const counterBefore = await valueOf(COUNTER, labels);
  const histogramBefore = await valueOf(DURATION_COUNT, labels);
  await action();
  const counter = (await waitForValue(COUNTER, labels, counterBefore + 1)) - counterBefore;
  const histogram = (await waitForValue(DURATION_COUNT, labels, histogramBefore + 1)) - histogramBefore;
  return { counter, histogram };
}

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.close();
});

describe('US1: consultar las métricas sin credenciales (e2e, spec 029)', () => {
  it('GET /metrics sin credenciales responde 200 (nunca 401) en formato de texto de Prometheus', async () => {
    const res = await request(server()).get('/metrics');

    expect(res.status).toBe(200);
    // Express reordena los parámetros del media type (agrega charset antes de version): ambos son válidos para Prometheus.
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.headers['content-type']).toContain('version=0.0.4');
  });

  it('expone exactamente las dos familias definidas, sin métricas del proceso', async () => {
    const { text } = await scrape();

    expect(familyNames(text).sort()).toEqual(['http_request_duration_seconds', 'http_requests_total']);
  });

  it('los demás endpoints protegidos siguen exigiendo autenticación', async () => {
    expect((await request(server()).get('/auth/me')).status).toBe(401);
    expect((await request(server()).get('/orders')).status).toBe(401);
  });

  it('no contiene datos de usuarios, credenciales ni tokens usados en el test (FR-012)', async () => {
    await ctx.clearUsers();
    const email = 'privado.metricas@mail.com';
    const password = 'Abcd1234!';
    const username = 'nombre.privado.m';
    await request(server()).post('/auth/register').send({ email, password, username });
    const login = await request(server()).post('/auth/login').send({ email, password });
    const jwt = login.body.accessToken as string;
    await request(server()).get('/auth/me').set('Authorization', `Bearer ${jwt}`);
    expect(jwt).toBeTruthy();

    const { text } = await scrape();

    for (const secret of [email, password, username, jwt]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe('US2: toda request se mide, también las rechazadas (e2e, spec 029)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('200: GET /health suma al contador y al histograma de su serie', async () => {
    const labels = { method: 'GET', route: '/health', status_code: '200' };

    const delta = await increaseOf(labels, () => request(server()).get('/health'));

    expect(delta).toEqual({ counter: 1, histogram: 1 });
  });

  it('401 por falta de token: queda medida con su patrón de ruta, aunque nunca llegó al controller', async () => {
    const labels = { method: 'GET', route: '/auth/me', status_code: '401' };

    const delta = await increaseOf(labels, async () => {
      expect((await request(server()).get('/auth/me')).status).toBe(401);
    });

    expect(delta).toEqual({ counter: 1, histogram: 1 });
  });

  it('404 por ruta inexistente: se contabiliza bajo route="unmatched"', async () => {
    const labels = { method: 'GET', route: 'unmatched', status_code: '404' };

    const delta = await increaseOf(labels, async () => {
      expect((await request(server()).get('/ruta-que-no-existe')).status).toBe(404);
    });

    expect(delta).toEqual({ counter: 1, histogram: 1 });
  });

  it('400 por JSON malformado (lo rechaza el parser antes de routing): se contabiliza bajo route="unmatched" y no se pierde', async () => {
    const labels = { method: 'POST', route: 'unmatched', status_code: '400' };

    const delta = await increaseOf(labels, async () => {
      const res = await request(server())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"a":');
      expect(res.status).toBe(400);
    });

    expect(delta).toEqual({ counter: 1, histogram: 1 });
  });

  it('5xx forzado: queda medido con su código 5xx y el patrón de la ruta', async () => {
    const labels = { method: 'GET', route: '/auth/me', status_code: '500' };
    // `findById` lo usa el JwtAuthGuard tras validar el token: si falla con un Error común, la request termina en 500.
    jest
      .spyOn(ctx.app.get(UserRepository), 'findById')
      .mockRejectedValue(new Error('fallo inesperado de prueba'));
    const token = ctx.app.get(JwtService).sign({ sub: 'u-1' });

    const delta = await increaseOf(labels, async () => {
      const res = await request(server()).get('/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
    });

    expect(delta).toEqual({ counter: 1, histogram: 1 });
  });

  it('una consulta OPTIONS se mide con method="OPTIONS" y, al no resolver una ruta, bajo unmatched', async () => {
    const labels = { method: 'OPTIONS', route: 'unmatched', status_code: '404' };

    const delta = await increaseOf(labels, () => request(server()).options('/ruta-que-no-existe'));

    expect(delta).toEqual({ counter: 1, histogram: 1 });
  });

  it('la medición funciona con el logger en silent: no depende del nivel de log', async () => {
    // El `createTestApp()` de este archivo no sobrescribe LOG_CONFIG: el logger de los tests es `silent`.
    const labels = { method: 'GET', route: '/', status_code: '200' };

    const delta = await increaseOf(labels, () => request(server()).get('/'));

    expect(delta.counter).toBe(1);
  });
});

describe('US2: el total de las métricas coincide con el log de requests (e2e, spec 029, FR-005)', () => {
  const capture = createLogCapture();
  let logged: TestContext;

  beforeAll(async () => {
    logged = await createTestApp([{ token: LOG_CONFIG, useValue: capture.config }]);
  });

  afterAll(async () => {
    await logged.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cada request cuenta exactamente una vez en cada fuente: mismo total y misma duración', async () => {
    const srv = () => logged.app.getHttpServer();
    const token = logged.app.get(JwtService).sign({ sub: 'u-2' });
    jest
      .spyOn(logged.app.get(UserRepository), 'findById')
      .mockRejectedValue(new Error('fallo de prueba'));
    capture.clear();

    // Muestra mixta: éxito, 401, 404, 400 de parser y 5xx.
    await request(srv()).get('/');
    await request(srv()).get('/health');
    await request(srv()).get('/auth/me');
    await request(srv()).get('/ruta-que-no-existe');
    await request(srv()).post('/auth/login').set('Content-Type', 'application/json').send('{"a":');
    await request(srv()).get('/auth/me').set('Authorization', `Bearer ${token}`);
    const EXPECTED = 6;

    const isClosing = (line: Record<string, unknown>) =>
      line.msg === 'request completed' || line.msg === 'request errored';
    const deadline = Date.now() + 3000;
    while (capture.lines().filter(isClosing).length < EXPECTED && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const closingLines = capture.lines().filter(isClosing);
    expect(closingLines).toHaveLength(EXPECTED);

    const res = await request(srv()).get('/metrics');
    const samples = parsePrometheusText(res.text);
    const sum = (name: string) => samples.filter((s) => s.name === name).reduce((acc, s) => acc + s.value, 0);
    const loggedSeconds = closingLines.reduce((acc, line) => acc + (line.responseTime as number) / 1000, 0);

    expect(sum(COUNTER)).toBe(EXPECTED);
    expect(sum(DURATION_COUNT)).toBe(EXPECTED);
    expect(sum('http_request_duration_seconds_sum')).toBeCloseTo(loggedSeconds, 6);
  });
});

describe('US3: cardinalidad de etiquetas acotada (e2e, spec 029)', () => {
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
  const STANDARD_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'OTHER'];

  it('un mismo endpoint con ids distintos produce un solo patrón de ruta, sin los ids', async () => {
    await ctx.clearUsers();
    const token = await registerAndLogin('cardinalidad.a@mail.com', 'card-a');
    const idA = '11111111-1111-4111-8111-111111111111';
    const idB = '22222222-2222-4222-8222-222222222222';
    const before = (await scrape()).samples
      .filter((s) => s.name === COUNTER && s.labels.route === '/players/:id/quotes')
      .reduce((acc, s) => acc + s.value, 0);

    await request(server()).get(`/players/${idA}/quotes`).set('Authorization', `Bearer ${token}`);
    await request(server()).get(`/players/${idB}/quotes`).set('Authorization', `Bearer ${token}`);

    const deadline = Date.now() + 3000;
    let samples = (await scrape()).samples;
    const totalOf = (all: PromSample[]) =>
      all.filter((s) => s.name === COUNTER && s.labels.route === '/players/:id/quotes').reduce((a, s) => a + s.value, 0);
    while (totalOf(samples) < before + 2 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      samples = (await scrape()).samples;
    }

    const playerRoutes = new Set(samples.filter((s) => s.labels.route?.includes('players')).map((s) => s.labels.route));
    expect(totalOf(samples)).toBe(before + 2);
    expect([...playerRoutes]).toEqual(['/players/:id/quotes']);
    expect((await scrape()).text).not.toContain(idA);
    expect((await scrape()).text).not.toContain(idB);
  });

  it('50 URLs inexistentes distintas no agregan series: todas caen en una única ruta genérica', async () => {
    const labels = { method: 'GET', route: 'unmatched', status_code: '404' };
    const countUnmatchedSeries = (samples: PromSample[]) =>
      new Set(samples.filter((s) => s.name === COUNTER && s.labels.route === 'unmatched').map((s) => JSON.stringify(s.labels))).size;
    const before404 = await valueOf(COUNTER, labels);
    await request(server()).get('/x-0');
    await waitForValue(COUNTER, labels, before404 + 1);
    const seriesAfterFirst = countUnmatchedSeries((await scrape()).samples);

    for (let i = 1; i <= 50; i++) {
      await request(server()).get(`/x-${i}`);
    }
    const reached = await waitForValue(COUNTER, labels, before404 + 51);

    const { text, samples } = await scrape();
    expect(reached).toBe(before404 + 51);
    expect(countUnmatchedSeries(samples)).toBe(seriesAfterFirst);
    expect(text).not.toContain('/x-');
  });

  it('la query string no forma parte de ninguna etiqueta', async () => {
    const labels = { method: 'GET', route: '/health', status_code: '200' };
    const before = await valueOf(COUNTER, labels);

    await request(server()).get('/health?foo=bar&token=abc123');
    await waitForValue(COUNTER, labels, before + 1);

    const { text } = await scrape();
    expect(text).not.toContain('foo=bar');
    expect(text).not.toContain('abc123');
  });

  it('toda etiqueta es un patrón de ruta o unmatched, sin ids; todo método es del conjunto cerrado', async () => {
    const { samples, text } = await scrape();

    const routes = new Set(samples.map((s) => s.labels.route).filter((r) => r !== undefined));
    const methods = new Set(samples.map((s) => s.labels.method).filter((m) => m !== undefined));
    expect(routes.size).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route === 'unmatched' || /^\/[A-Za-z/:-]*$/.test(route)).toBe(true);
    }
    for (const method of methods) {
      expect(STANDARD_METHODS).toContain(method);
    }
    expect(text).not.toMatch(UUID);
  });
});

describe('US4: tasa de error honesta, 5xx separados de 4xx (e2e, spec 029)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Suma, por código de estado, del contador de un endpoint. */
  const byStatus = (samples: PromSample[], method: string, route: string): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const s of samples) {
      if (s.name === COUNTER && s.labels.method === method && s.labels.route === route) {
        result[s.labels.status_code] = (result[s.labels.status_code] ?? 0) + s.value;
      }
    }
    return result;
  };
  const sumOf = (record: Record<string, number>, predicate: (status: string) => boolean = () => true) =>
    Object.entries(record)
      .filter(([status]) => predicate(status))
      .reduce((acc, [, value]) => acc + value, 0);

  it('9×200, 2×401 y 1×500 sobre un endpoint: la tasa de error es 1/12 (sólo 5xx) y los 4xx se leen aparte', async () => {
    await ctx.clearUsers();
    const token = await registerAndLogin('error.rate@mail.com', 'error-rate');
    const before = byStatus((await scrape()).samples, 'GET', '/auth/me');
    const bearer = { Authorization: `Bearer ${token}` };

    for (let i = 0; i < 9; i++) {
      expect((await request(server()).get('/auth/me').set(bearer)).status).toBe(200);
    }
    expect((await request(server()).get('/auth/me')).status).toBe(401);
    expect((await request(server()).get('/auth/me').set({ Authorization: 'Bearer token-invalido' })).status).toBe(401);
    jest
      .spyOn(ctx.app.get(UserRepository), 'findById')
      .mockRejectedValueOnce(new Error('fallo inesperado de prueba'));
    expect((await request(server()).get('/auth/me').set(bearer)).status).toBe(500);

    const deadline = Date.now() + 3000;
    let after = byStatus((await scrape()).samples, 'GET', '/auth/me');
    while (sumOf(after) < sumOf(before) + 12 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      after = byStatus((await scrape()).samples, 'GET', '/auth/me');
    }
    const delta = (status: string) => (after[status] ?? 0) - (before[status] ?? 0);
    const total = sumOf(after) - sumOf(before);
    const errors5xx = sumOf(after, (s) => s.startsWith('5')) - sumOf(before, (s) => s.startsWith('5'));

    expect(total).toBe(12);
    expect(errors5xx / total).toBeCloseTo(1 / 12, 10);
    expect(delta('200')).toBe(9);
    expect(delta('401')).toBe(2);
    expect(delta('500')).toBe(1);
  });

  it('un 503 del health check por base de datos caída cuenta como 5xx de GET /health', async () => {
    const labels = { method: 'GET', route: '/health', status_code: '503' };
    jest.spyOn(ctx.dataSource, 'query').mockRejectedValue(new Error('boom'));

    const delta = await increaseOf(labels, async () => {
      expect((await request(server()).get('/health')).status).toBe(503);
    });

    expect(delta).toEqual({ counter: 1, histogram: 1 });
  });

  it('el stream en vivo se cuenta pero no entra al histograma de duración (FR-011)', async () => {
    await ctx.clearUsers();
    const jwt = await registerAndLogin('stream.metricas@mail.com', 'stream-m');
    const labels = { method: 'GET', route: '/notifications/stream', status_code: '200' };
    const counterBefore = await valueOf(COUNTER, labels);
    const histogramBefore = await valueOf(DURATION_COUNT, labels);

    await openAndAbort(`/notifications/stream?token=${jwt}`);
    const counterAfter = await waitForValue(COUNTER, labels, counterBefore + 1);

    expect(counterAfter).toBe(counterBefore + 1);
    expect(await valueOf(DURATION_COUNT, labels)).toBe(histogramBefore);
  });

  it('el conteo del histograma iguala al del contador en toda serie que no sea el stream', async () => {
    const { samples } = await scrape();

    const counters = samples.filter((s) => s.name === COUNTER && s.labels.route !== '/notifications/stream');
    expect(counters.length).toBeGreaterThan(0);
    for (const counter of counters) {
      expect({ labels: counter.labels, count: sampleValue(samples, DURATION_COUNT, counter.labels) }).toEqual({
        labels: counter.labels,
        count: counter.value,
      });
    }
  });
});

/** Alta + login de un usuario nuevo; devuelve su JWT. */
async function registerAndLogin(email: string, username: string): Promise<string> {
  const password = 'Abcd1234!';
  await request(server()).post('/auth/register').send({ email, password, username });
  const login = await request(server()).post('/auth/login').send({ email, password });
  return login.body.accessToken as string;
}

/** GET esperando sólo los headers y cortando la conexión (la línea de cierre se emite al cerrar). */
function openAndAbort(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
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
}
