import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram } from 'prom-client';
import {
  BUSINESS_METRIC_HELP,
  BUSINESS_METRIC_NAMES,
  BusinessMetrics,
  MetricSide,
  NotificationDelivery,
  OperationOutcome,
  RECALCULATION_DURATION_BUCKETS_SECONDS,
  RecalculationOutcome,
  RejectionReason,
  RunTrigger,
  SYNC_DURATION_BUCKETS_SECONDS,
  SyncOutcome,
  SyncSource,
} from '../../shared/observability/metrics/business-metrics';
import { MetricsService } from './metrics.service';

/**
 * Métricas de negocio (spec 031), separadas de las técnicas de la API (spec 029) pero en el mismo
 * `Registry`, para que todo salga en el mismo `GET /metrics`.
 *
 * Cada método es tipado por los conjuntos cerrados de etiquetas (un valor fuera del conjunto no compila)
 * y NUNCA lanza: medir no puede alterar el resultado de la operación medida (FR-013).
 */
@Injectable()
export class BusinessMetricsService implements BusinessMetrics {
  private readonly operations: Counter<'operation' | 'outcome'>;
  private readonly tokensTraded: Counter<'side'>;
  private readonly volumeCredits: Counter<'side'>;
  private readonly orderRejections: Counter<'reason'>;
  private readonly syncRuns: Counter<'source' | 'trigger' | 'outcome'>;
  private readonly syncDuration: Histogram<'source' | 'trigger'>;
  private readonly syncLastSuccess: Gauge<'source'>;
  private readonly quoteRecalculations: Counter<'trigger' | 'outcome'>;
  private readonly quoteRecalculationDuration: Histogram<'trigger'>;
  private readonly alertsTriggered: Counter;
  private readonly notificationsCreated: Counter<'delivery'>;
  private readonly sseConnections: Gauge;

  constructor(metrics: MetricsService) {
    const registers = [metrics.registry];
    const names = BUSINESS_METRIC_NAMES;
    const help = BUSINESS_METRIC_HELP;

    this.operations = new Counter({
      name: names.operations,
      help: help.operations,
      labelNames: ['operation', 'outcome'],
      registers,
    });
    this.tokensTraded = new Counter({ name: names.tokensTraded, help: help.tokensTraded, labelNames: ['side'], registers });
    this.volumeCredits = new Counter({ name: names.volumeCredits, help: help.volumeCredits, labelNames: ['side'], registers });
    this.orderRejections = new Counter({
      name: names.orderRejections,
      help: help.orderRejections,
      labelNames: ['reason'],
      registers,
    });
    this.syncRuns = new Counter({
      name: names.syncRuns,
      help: help.syncRuns,
      labelNames: ['source', 'trigger', 'outcome'],
      registers,
    });
    this.syncDuration = new Histogram({
      name: names.syncDuration,
      help: help.syncDuration,
      labelNames: ['source', 'trigger'],
      buckets: [...SYNC_DURATION_BUCKETS_SECONDS],
      registers,
    });
    this.syncLastSuccess = new Gauge({
      name: names.syncLastSuccess,
      help: help.syncLastSuccess,
      labelNames: ['source'],
      registers,
    });
    this.quoteRecalculations = new Counter({
      name: names.quoteRecalculations,
      help: help.quoteRecalculations,
      labelNames: ['trigger', 'outcome'],
      registers,
    });
    this.quoteRecalculationDuration = new Histogram({
      name: names.quoteRecalculationDuration,
      help: help.quoteRecalculationDuration,
      labelNames: ['trigger'],
      buckets: [...RECALCULATION_DURATION_BUCKETS_SECONDS],
      registers,
    });
    this.alertsTriggered = new Counter({ name: names.alertsTriggered, help: help.alertsTriggered, registers });
    this.notificationsCreated = new Counter({
      name: names.notificationsCreated,
      help: help.notificationsCreated,
      labelNames: ['delivery'],
      registers,
    });
    this.sseConnections = new Gauge({ name: names.sseConnections, help: help.sseConnections, registers });

    // Sin etiquetas: existen desde el arranque, en 0.
    this.alertsTriggered.inc(0);
    this.sseConnections.set(0);
  }

  recordOperation(operation: string, outcome: OperationOutcome): void {
    this.safely(() => this.operations.inc({ operation, outcome }));
  }

  recordTokensTraded(side: MetricSide, tokens: number, credits: number): void {
    this.safely(() => {
      this.tokensTraded.inc({ side }, tokens);
      this.volumeCredits.inc({ side }, credits);
    });
  }

  recordOrderRejection(reason: RejectionReason): void {
    this.safely(() => this.orderRejections.inc({ reason }));
  }

  recordSyncRun(source: SyncSource, trigger: RunTrigger, outcome: SyncOutcome, durationSeconds: number): void {
    this.safely(() => {
      this.syncRuns.inc({ source, trigger, outcome });
      this.syncDuration.observe({ source, trigger }, durationSeconds);
    });
  }

  setSyncLastSuccess(source: SyncSource, at: Date): void {
    this.safely(() => this.syncLastSuccess.set({ source }, at.getTime() / 1000));
  }

  recordQuoteRecalculation(trigger: RunTrigger, outcome: RecalculationOutcome, durationSeconds: number): void {
    this.safely(() => {
      this.quoteRecalculations.inc({ trigger, outcome });
      this.quoteRecalculationDuration.observe({ trigger }, durationSeconds);
    });
  }

  recordAlertTriggered(): void {
    this.safely(() => this.alertsTriggered.inc());
  }

  recordNotificationCreated(delivery: NotificationDelivery): void {
    this.safely(() => this.notificationsCreated.inc({ delivery }));
  }

  sseConnectionOpened(): void {
    this.safely(() => this.sseConnections.inc());
  }

  sseConnectionClosed(): void {
    this.safely(() => this.sseConnections.dec());
  }

  /** Cualquier fallo interno de la medición se ignora: nunca debe llegar a la operación medida. */
  private safely(work: () => void): void {
    try {
      work();
    } catch {
      // Ignorado a propósito (spec 031, FR-013).
    }
  }
}
