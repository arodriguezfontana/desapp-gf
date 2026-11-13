import type { BusinessMetrics } from './business-metrics';

/** Doble de test de `BusinessMetrics`: cada método es un `jest.fn()` (sin lógica, sin lanzar). */
export type BusinessMetricsDouble = { [K in keyof BusinessMetrics]: jest.Mock };

export function createBusinessMetricsDouble(): BusinessMetricsDouble {
  return {
    recordOperation: jest.fn(),
    recordTokensTraded: jest.fn(),
    recordOrderRejection: jest.fn(),
    recordSyncRun: jest.fn(),
    setSyncLastSuccess: jest.fn(),
    recordQuoteRecalculation: jest.fn(),
    recordAlertTriggered: jest.fn(),
    recordNotificationCreated: jest.fn(),
    sseConnectionOpened: jest.fn(),
    sseConnectionClosed: jest.fn(),
  };
}

/** Hace que todos los métodos del doble lancen: sirve para probar que medir nunca altera la operación. */
export function makeBusinessMetricsDoubleThrow(double: BusinessMetricsDouble): void {
  for (const method of Object.values(double)) {
    method.mockImplementation(() => {
      throw new Error('métricas rotas');
    });
  }
}
