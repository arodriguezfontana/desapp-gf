import {
  BUSINESS_OPERATIONS,
  NOTIFICATION_DELIVERIES,
  OPERATION_OUTCOMES,
  RECALCULATION_OUTCOMES,
  REJECTION_REASONS,
  RUN_TRIGGERS,
  SIDES,
  SYNC_OUTCOMES,
  SYNC_SOURCES,
} from '../../shared/observability/metrics/business-metrics';
import { BusinessMetricsService } from './business-metrics.service';
import { MetricsService } from './metrics.service';

/**
 * Las series de los conjuntos cerrados nacen en 0 al arrancar: Prometheus calcula `increase()` entre dos muestras y
 * una serie que aparece ya en 1 no tiene muestra previa, así que su primer evento no se contaría.
 */
describe('BusinessMetricsService — series inicializadas en 0', () => {
  let metrics: MetricsService;
  let business: BusinessMetricsService;
  let text: string;

  beforeEach(async () => {
    metrics = new MetricsService();
    business = new BusinessMetricsService(metrics);
    text = await metrics.render();
  });

  it('business_operations_total: toda operación del catálogo con cada resultado, en 0', () => {
    for (const operation of BUSINESS_OPERATIONS) {
      for (const outcome of OPERATION_OUTCOMES) {
        expect(text).toContain(`business_operations_total{operation="${operation}",outcome="${outcome}"} 0`);
      }
    }
  });

  it('tokens y créditos por lado, y rechazos por motivo, en 0', () => {
    for (const side of SIDES) {
      expect(text).toContain(`market_tokens_traded_total{side="${side}"} 0`);
      expect(text).toContain(`market_volume_credits_total{side="${side}"} 0`);
    }
    for (const reason of REJECTION_REASONS) expect(text).toContain(`market_order_rejections_total{reason="${reason}"} 0`);
  });

  it('corridas de sync por fuente, origen y resultado, y su histograma, en 0', () => {
    for (const source of SYNC_SOURCES) {
      for (const trigger of RUN_TRIGGERS) {
        expect(text).toContain(`sync_run_duration_seconds_count{source="${source}",trigger="${trigger}"} 0`);
        for (const outcome of SYNC_OUTCOMES) {
          expect(text).toContain(`sync_runs_total{source="${source}",trigger="${trigger}",outcome="${outcome}"} 0`);
        }
      }
    }
  });

  it('recálculos por origen y resultado, y su histograma, en 0', () => {
    for (const trigger of RUN_TRIGGERS) {
      expect(text).toContain(`quote_recalculation_duration_seconds_count{trigger="${trigger}"} 0`);
      for (const outcome of RECALCULATION_OUTCOMES) {
        expect(text).toContain(`quote_recalculations_total{trigger="${trigger}",outcome="${outcome}"} 0`);
      }
    }
  });

  it('notificaciones por forma de entrega, en 0', () => {
    for (const delivery of NOTIFICATION_DELIVERIES) {
      expect(text).toContain(`notifications_created_total{delivery="${delivery}"} 0`);
    }
  });

  it('NO inicializa la última sync exitosa: sin ninguna corrida exitosa no hay valor', () => {
    expect(text).not.toContain('sync_last_success_timestamp_seconds{');
  });

  it('el primer evento suma sobre la serie ya existente (0 -> 1), no la crea', async () => {
    business.recordOperation('TOKENS_SOLD', 'rejected');
    const after = await metrics.render();
    expect(after).toContain('business_operations_total{operation="TOKENS_SOLD",outcome="rejected"} 1');
    expect(after).toContain('business_operations_total{operation="TOKENS_SOLD",outcome="success"} 0');
  });
});
