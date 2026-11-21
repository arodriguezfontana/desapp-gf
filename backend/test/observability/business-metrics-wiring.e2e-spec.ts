import { Type } from '@nestjs/common';
import { AlertNotificationListener } from '../../src/services/notifications/alert-notification.listener';
import { FootballDataSyncService } from '../../src/services/competition/football-data-sync.service';
import { MarketSimulationService } from '../../src/services/simulation/market-simulation.service';
import { NotificationsService } from '../../src/services/notifications/notifications.service';
import { OrdersService } from '../../src/services/orders/orders.service';
import { PlayerSyncService } from '../../src/services/player-sync/player-sync.service';
import { QuoteRecalculatedListener } from '../../src/services/alerts/quote-recalculated.listener';
import { QuotationService } from '../../src/services/quotation/quotation.service';
import { BusinessMetricsService } from '../../src/services/observability/business-metrics.service';
import { createTestApp, TestContext } from '../test-app';

/**
 * 031: los services que miden el negocio reciben `BusinessMetrics` por inyección OPCIONAL (así se pueden construir sin
 * métricas en los tests unitarios). La contracara es que, si un módulo se olvida de importar `MetricsModule`, Nest no
 * falla y la medición se omite en silencio. Este test cierra ese hueco: en la app real, cada service instrumentado tiene
 * que tener la implementación real inyectada.
 *
 * El `BusinessAuditInterceptor` (global, vía `APP_INTERCEPTOR`) no se puede obtener por su clase: su cableado lo cubre
 * `business-metrics.e2e-spec.ts`, donde `business_operations_total` sube con cada operación.
 */
describe('Cableado de las métricas de negocio (e2e, spec 031)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const INSTRUMENTED: Array<[string, Type<unknown>]> = [
    ['OrdersService', OrdersService],
    ['PlayerSyncService', PlayerSyncService],
    ['FootballDataSyncService', FootballDataSyncService],
    ['QuotationService', QuotationService],
    ['MarketSimulationService', MarketSimulationService],
    ['NotificationsService', NotificationsService],
    ['AlertNotificationListener', AlertNotificationListener],
    ['QuoteRecalculatedListener', QuoteRecalculatedListener],
  ];

  it.each(INSTRUMENTED)('%s tiene inyectado el BusinessMetricsService real', (_name, type) => {
    const instance = ctx.app.get(type, { strict: false }) as unknown as { metrics?: unknown };

    expect(instance.metrics).toBeInstanceOf(BusinessMetricsService);
  });
});
