import * as request from 'supertest';
import { createTestApp, TestContext } from '../test-app';
import { parsePrometheusText } from './helpers/prom-text';
import { compareRouteSets, listDeclaredSla, listRouterRoutes } from './helpers/route-inventory';
import { DURATION_BUCKETS_SECONDS } from '../../src/shared/observability/metrics/request-metrics';
import { SLA_CLASSES, slaLatencyThresholdsSeconds } from '../../src/shared/observability/metrics/sla';

/**
 * 029-http-metrics-sla: el SLA declarado con `@Sla` se verifica contra lo que el backend publica
 * de verdad (el router de Express) y contra las métricas que expone.
 */
describe('SLA por endpoint: cobertura y consistencia (e2e, spec 029)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('cada endpoint publicado tiene exactamente una entrada de SLA y cada SLA corresponde a un endpoint (FR-017)', () => {
    const published = listRouterRoutes(ctx.app);
    const declared = listDeclaredSla(ctx.app).map((entry) => entry.id);

    expect(published.length).toBeGreaterThan(0);
    expect(compareRouteSets(published, declared)).toEqual({
      missingSla: [],
      orphanSla: [],
      duplicateSla: [],
    });
  });

  it('el identificador de cada SLA es el mismo método + patrón que las etiquetas de las métricas (FR-015)', async () => {
    // Los endpoints públicos se pueden consultar sin credenciales: la serie que dejan debe ser su id de SLA.
    const publicEndpoints = ['GET /', 'GET /health', 'GET /metrics'];
    const declared = new Set(listDeclaredSla(ctx.app).map((entry) => entry.id));
    for (const id of publicEndpoints) {
      expect(declared.has(id)).toBe(true);
      await request(ctx.app.getHttpServer()).get(id.split(' ')[1]);
    }

    const samples = await waitForSeries(publicEndpoints);

    const labelIds = new Set(
      samples
        .filter((s) => s.name === 'http_requests_total')
        .map((s) => `${s.labels.method} ${s.labels.route}`),
    );
    for (const id of publicEndpoints) {
      expect(labelIds.has(id)).toBe(true);
    }
  });

  it('todo umbral de latencia declarado es un límite del histograma, también en la salida real de /metrics (FR-016)', async () => {
    const thresholds = slaLatencyThresholdsSeconds();
    await request(ctx.app.getHttpServer()).get('/');
    const res = await request(ctx.app.getHttpServer()).get('/metrics');
    const exposedLimits = new Set(
      parsePrometheusText(res.text)
        .filter((s) => s.name === 'http_request_duration_seconds_bucket')
        .map((s) => Number(s.labels.le)),
    );

    expect(thresholds.length).toBeGreaterThan(0);
    for (const threshold of thresholds) {
      expect(DURATION_BUCKETS_SECONDS).toContain(threshold);
      expect(exposedLimits.has(threshold)).toBe(true);
    }
    // Y cada clase con objetivo de latencia usa un umbral de esa lista.
    for (const sla of Object.values(SLA_CLASSES)) {
      if (sla.p95Ms !== null) expect(thresholds).toContain(sla.p95Ms / 1000);
    }
  });

  it('/metrics, /health y la raíz tienen SLA', () => {
    const byId = new Map(listDeclaredSla(ctx.app).map((entry) => [entry.id, entry.sla]));

    expect(byId.get('GET /metrics')).toBe('technical');
    expect(byId.get('GET /health')).toBe('technical');
    expect(byId.get('GET /')).toBe('ping');
  });

  it('el stream y las operaciones de larga duración están declarados sin objetivo de latencia', () => {
    const byId = new Map(listDeclaredSla(ctx.app).map((entry) => [entry.id, entry.sla]));

    expect(byId.get('GET /notifications/stream')).toBe('stream');
    expect(byId.get('POST /quotes/recalculate')).toBe('system-long');
    expect(byId.get('POST /admin/simulate-market')).toBe('system-long');
  });

  describe('meta-test: la verificación realmente falla ante una discrepancia', () => {
    const published = ['GET /a', 'POST /b', 'GET /c/:id'];

    it('sin discrepancias no reporta nada', () => {
      expect(compareRouteSets(published, [...published])).toEqual({
        missingSla: [],
        orphanSla: [],
        duplicateSla: [],
      });
    });

    it('un endpoint publicado sin SLA se reporta como missingSla', () => {
      expect(compareRouteSets(published, ['GET /a', 'GET /c/:id']).missingSla).toEqual(['POST /b']);
    });

    it('un SLA sin endpoint publicado se reporta como orphanSla', () => {
      expect(compareRouteSets(published, [...published, 'DELETE /ya-no-existe']).orphanSla).toEqual([
        'DELETE /ya-no-existe',
      ]);
    });

    it('un endpoint con dos entradas de SLA se reporta como duplicateSla', () => {
      expect(compareRouteSets(published, [...published, 'GET /a']).duplicateSla).toEqual(['GET /a']);
    });
  });

  /** `pino-http` registra en `finish`/`close`: reconsulta `/metrics` hasta ver las series pedidas. */
  async function waitForSeries(ids: string[]) {
    const deadline = Date.now() + 3000;
    let samples = parsePrometheusText((await request(ctx.app.getHttpServer()).get('/metrics')).text);
    const seen = () =>
      new Set(samples.filter((s) => s.name === 'http_requests_total').map((s) => `${s.labels.method} ${s.labels.route}`));
    while (!ids.every((id) => seen().has(id)) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      samples = parsePrometheusText((await request(ctx.app.getHttpServer()).get('/metrics')).text);
    }
    return samples;
  }
});
