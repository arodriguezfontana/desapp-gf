import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';
import {
  DURATION_BUCKETS_SECONDS,
  RequestMetricSample,
  RequestMetricsRecorder,
} from '../../shared/observability/metrics/request-metrics';

/**
 * Métricas técnicas de requests (spec 029): histograma de duración y contador de requests,
 * ambos por método, ruta y código de estado.
 *
 * Usa un `Registry` propio y no el global de `prom-client`: con el global, una segunda app Nest
 * en el mismo proceso (los tests crean varias) lanza "metric already registered". Tampoco se
 * activan las métricas por defecto: la spec define exactamente dos métricas.
 */
@Injectable()
export class MetricsService implements RequestMetricsRecorder {
  private readonly registry = new Registry();

  private readonly duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duración de las requests HTTP, en segundos',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [...DURATION_BUCKETS_SECONDS],
    registers: [this.registry],
  });

  private readonly requests = new Counter({
    name: 'http_requests_total',
    help: 'Requests HTTP atendidas',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  /** Cuenta la request y, salvo en los streams (`durationSeconds` null), observa su duración. */
  record(sample: RequestMetricSample): void {
    const labels = {
      method: sample.method,
      route: sample.route,
      status_code: String(sample.statusCode),
    };
    this.requests.inc(labels);
    if (sample.durationSeconds !== null) {
      this.duration.observe(labels, sample.durationSeconds);
    }
  }

  /** Texto en formato Prometheus con las dos familias. */
  render(): Promise<string> {
    return this.registry.metrics();
  }

  /** `Content-Type` del texto de `render()`. */
  get contentType(): string {
    return this.registry.contentType;
  }
}
