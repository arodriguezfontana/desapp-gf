/**
 * Métricas de negocio (spec 031): nombres, conjuntos cerrados de etiquetas, buckets, textos de ayuda y la
 * interfaz que consumen los services. Sin imports de `prom-client` ni del dominio: la implementación vive
 * en `services/observability/business-metrics.service.ts`.
 *
 * Todo valor de etiqueta sale de uno de los conjuntos cerrados de abajo y nunca identifica a un usuario, un
 * jugador, una orden, una alerta ni una corrida puntual.
 */

/** Token de inyección de `BusinessMetrics` (lo provee y exporta `MetricsModule`). */
export const BUSINESS_METRICS = Symbol('BUSINESS_METRICS');

// ---- Conjuntos cerrados de etiquetas ---------------------------------------------------------------

export const SIDES = ['buy', 'sell'] as const;
export type MetricSide = (typeof SIDES)[number];

/** Resultado de una operación de escritura de la API. */
export const OPERATION_OUTCOMES = ['success', 'rejected', 'unexpected'] as const;
export type OperationOutcome = (typeof OPERATION_OUTCOMES)[number];

/** Resultado de una corrida de sincronización: `partial` = algunas unidades fallaron y otras no. */
export const SYNC_OUTCOMES = ['success', 'partial', 'failure'] as const;
export type SyncOutcome = (typeof SYNC_OUTCOMES)[number];

/** Resultado de un recálculo de cotizaciones. */
export const RECALCULATION_OUTCOMES = ['success', 'failure'] as const;
export type RecalculationOutcome = (typeof RECALCULATION_OUTCOMES)[number];

export const REJECTION_REASONS = [
  'insufficient_balance',
  'insufficient_tokens',
  'tokens_unavailable',
  'other',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const SYNC_SOURCES = ['whoscored', 'football_data'] as const;
export type SyncSource = (typeof SYNC_SOURCES)[number];

export const RUN_TRIGGERS = ['scheduled', 'manual'] as const;
export type RunTrigger = (typeof RUN_TRIGGERS)[number];

export const NOTIFICATION_DELIVERIES = ['live', 'stored_only'] as const;
export type NotificationDelivery = (typeof NOTIFICATION_DELIVERIES)[number];

// ---- Nombres de las métricas -----------------------------------------------------------------------

export const BUSINESS_METRIC_NAMES = {
  operations: 'business_operations_total',
  tokensTraded: 'market_tokens_traded_total',
  volumeCredits: 'market_volume_credits_total',
  orderRejections: 'market_order_rejections_total',
  syncRuns: 'sync_runs_total',
  syncDuration: 'sync_run_duration_seconds',
  syncLastSuccess: 'sync_last_success_timestamp_seconds',
  quoteRecalculations: 'quote_recalculations_total',
  quoteRecalculationDuration: 'quote_recalculation_duration_seconds',
  alertsTriggered: 'alerts_triggered_total',
  notificationsCreated: 'notifications_created_total',
  sseConnections: 'sse_connections_active',
} as const;

// ---- Textos de ayuda (HELP) ------------------------------------------------------------------------

export const BUSINESS_METRIC_HELP = {
  operations:
    'Operaciones de escritura de la API por tipo y resultado. success significa operación aceptada: para PLAYER_SYNC_TRIGGERED es corrida aceptada, no corrida terminada (su resultado real está en sync_runs_total).',
  tokensTraded: 'Tokens operados por compra y venta (sólo operaciones registradas)',
  volumeCredits: 'Volumen operado en créditos por compra y venta (sólo operaciones registradas)',
  orderRejections:
    'Órdenes de compra y venta rechazadas al crearse, por motivo. Mide sólo el alta de órdenes: no incluye las cancelaciones.',
  syncRuns:
    'Corridas de sincronización por fuente, origen y resultado (success: todas las unidades bien; partial: algunas fallaron; failure: se abortó o ninguna terminó bien)',
  syncDuration: 'Duración de las corridas de sincronización, en segundos',
  syncLastSuccess:
    'Momento (segundos Unix) de la última sincronización exitosa de cada fuente; una corrida parcial o fallida no lo modifica',
  quoteRecalculations: 'Recálculos de cotizaciones por origen y resultado',
  quoteRecalculationDuration: 'Duración de los recálculos de cotizaciones, en segundos',
  alertsTriggered: 'Alertas de precio disparadas',
  notificationsCreated: 'Notificaciones creadas, según llegaron en vivo o quedaron sólo guardadas',
  sseConnections: 'Conexiones abiertas del stream de notificaciones en tiempo real',
} as const;

// ---- Buckets (segundos) ----------------------------------------------------------------------------

/** Sync: de segundos a decenas de minutos (Football-Data ≈ 70 s; WhoScored bastante más). */
export const SYNC_DURATION_BUCKETS_SECONDS: readonly number[] = [1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800];

/** Recálculo: misma escala, con extremo inferior más fino. */
export const RECALCULATION_DURATION_BUCKETS_SECONDS: readonly number[] = [
  0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300,
];

// ---- Clasificación de una corrida de sync ----------------------------------------------------------

/** Lo que hace falta saber de una corrida para clasificarla. */
export interface SyncRunSummary {
  /** La corrida se interrumpió con una excepción. */
  aborted: boolean;
  /** Unidades de trabajo (equipos o ligas) que terminaron bien. */
  unitsSucceeded: number;
  /** Unidades de trabajo que fallaron. */
  unitsFailed: number;
}

/**
 * `success` si no se abortó y todas las unidades terminaron bien; `failure` si se abortó o ninguna unidad
 * terminó bien; `partial` en cualquier otro caso (algunas fallaron y otras no).
 */
export function classifySyncRun(summary: SyncRunSummary): SyncOutcome {
  if (summary.aborted) return 'failure';
  if (summary.unitsFailed === 0) return 'success';
  if (summary.unitsSucceeded === 0) return 'failure';
  return 'partial';
}

// ---- Interfaz --------------------------------------------------------------------------------------

/**
 * Destino de las mediciones de negocio. Ningún método lanza ni devuelve nada: medir nunca altera el
 * resultado de la operación medida (spec 031, FR-013).
 */
export interface BusinessMetrics {
  /** Cuenta una operación de escritura de la API; `operation` sale del catálogo cerrado de `@AuditedOperation`. */
  recordOperation(operation: string, outcome: OperationOutcome): void;
  /** Suma tokens y volumen en créditos de una operación ya registrada (después del commit). */
  recordTokensTraded(side: MetricSide, tokens: number, credits: number): void;
  recordOrderRejection(reason: RejectionReason): void;
  recordSyncRun(source: SyncSource, trigger: RunTrigger, outcome: SyncOutcome, durationSeconds: number): void;
  /** Fija el momento de la última sincronización exitosa de la fuente. */
  setSyncLastSuccess(source: SyncSource, at: Date): void;
  recordQuoteRecalculation(trigger: RunTrigger, outcome: RecalculationOutcome, durationSeconds: number): void;
  recordAlertTriggered(): void;
  recordNotificationCreated(delivery: NotificationDelivery): void;
  sseConnectionOpened(): void;
  sseConnectionClosed(): void;
}
