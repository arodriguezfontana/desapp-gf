import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';
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
 * en el mismo proceso (los tests crean varias) lanza "metric already registered".
 *
 * Además de las dos métricas de requests expone las métricas por defecto de `prom-client` (CPU,
 * memoria, heap, event loop lag, GC, handles), el equivalente a las métricas de JVM y de proceso de
 * Actuator. Van al mismo `Registry` propio, así que también quedan aisladas por instancia.
 */
@Injectable()
export class MetricsService implements RequestMetricsRecorder {
  private readonly registryInstance = new Registry();

  private readonly duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duración de las requests HTTP, en segundos',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [...DURATION_BUCKETS_SECONDS],
    registers: [this.registryInstance],
  });

  private readonly requests = new Counter({
    name: 'http_requests_total',
    help: 'Requests HTTP atendidas',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registryInstance],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registryInstance });
  }

  /** `Registry` propio, compartido con las métricas de negocio (spec 031) para que salgan en el mismo `/metrics`. */
  get registry(): Registry {
    return this.registryInstance;
  }

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

  /** Texto en formato Prometheus: las dos familias de requests y las métricas del proceso. */
  render(): Promise<string> {
    return this.registryInstance.metrics();
  }

  /** `Content-Type` del texto de `render()`. */
  get contentType(): string {
    return this.registryInstance.contentType;
  }
}
