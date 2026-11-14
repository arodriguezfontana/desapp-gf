import { DURATION_BUCKETS_SECONDS } from '../../shared/observability/metrics/request-metrics';
import { MetricsService } from './metrics.service';

const typeLines = (text: string): string[] => text.split('\n').filter((l) => l.startsWith('# TYPE '));

describe('MetricsService', () => {
  it('dos instancias en el mismo proceso no chocan (registro propio por instancia)', () => {
    expect(() => {
      new MetricsService();
      new MetricsService();
    }).not.toThrow();
  });

  it('record incrementa el contador y observa el histograma con sus etiquetas', async () => {
    const service = new MetricsService();

    service.record({ method: 'GET', route: '/players/:id', statusCode: 200, durationSeconds: 0.12 });
    const text = await service.render();

    expect(text).toContain('http_requests_total{method="GET",route="/players/:id",status_code="200"} 1');
    expect(text).toContain(
      'http_request_duration_seconds_count{method="GET",route="/players/:id",status_code="200"} 1',
    );
    expect(text).toContain(
      'http_request_duration_seconds_sum{method="GET",route="/players/:id",status_code="200"} 0.12',
    );
  });

  it('durationSeconds null cuenta la request pero no toca el histograma', async () => {
    const service = new MetricsService();

    service.record({ method: 'GET', route: '/notifications/stream', statusCode: 200, durationSeconds: null });
    const text = await service.render();

    expect(text).toContain('http_requests_total{method="GET",route="/notifications/stream",status_code="200"} 1');
    expect(text).not.toContain('http_request_duration_seconds_count{method="GET",route="/notifications/stream"');
  });

  it('expone las dos familias de requests', async () => {
    const service = new MetricsService();
    service.record({ method: 'GET', route: 'unmatched', statusCode: 404, durationSeconds: 0.001 });

    const types = typeLines(await service.render());

    expect(types).toContain('# TYPE http_request_duration_seconds histogram');
    expect(types).toContain('# TYPE http_requests_total counter');
  });

  it('expone también las métricas por defecto del proceso Node (CPU, memoria, heap, event loop)', async () => {
    const text = await new MetricsService().render();

    expect(text).toContain('# TYPE process_cpu_seconds_total counter');
    expect(text).toContain('# TYPE process_resident_memory_bytes gauge');
    expect(text).toContain('# TYPE nodejs_heap_size_used_bytes gauge');
    expect(text).toContain('# TYPE nodejs_eventloop_lag_seconds gauge');
  });

  it('las métricas del proceso no llevan las etiquetas de requests', async () => {
    const service = new MetricsService();
    service.record({ method: 'GET', route: '/health', statusCode: 200, durationSeconds: 0.01 });

    const processLines = (await service.render())
      .split('\n')
      .filter((l) => /^(process|nodejs)_/.test(l));

    expect(processLines.length).toBeGreaterThan(0);
    for (const line of processLines) {
      expect(line).not.toMatch(/route=|status_code=/);
    }
  });

  it('el histograma tiene un límite por cada intervalo definido', async () => {
    const service = new MetricsService();
    service.record({ method: 'GET', route: '/', statusCode: 200, durationSeconds: 0.01 });

    const text = await service.render();

    for (const bucket of DURATION_BUCKETS_SECONDS) {
      expect(text).toContain(`le="${bucket}"`);
    }
    expect(text).toContain('le="+Inf"');
  });

  it('las instancias no comparten muestras', async () => {
    const a = new MetricsService();
    const b = new MetricsService();
    a.record({ method: 'GET', route: '/', statusCode: 200, durationSeconds: 0.01 });

    expect(await b.render()).not.toContain('route="/"');
  });

  it('contentType es el formato de texto de Prometheus', () => {
    expect(new MetricsService().contentType).toMatch(/^text\/plain; version=0\.0\.4/);
  });
});
