import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SyncLastSuccessRepository } from '../../repositories/sync/sync-last-success.repository';
import { BUSINESS_METRICS, BusinessMetrics, SyncSource } from '../../shared/observability/metrics/business-metrics';

/**
 * Última sincronización exitosa por fuente (spec 031, FR-008). Persiste el momento en `sync_last_success` y
 * lo refleja en el gauge `sync_last_success_timestamp_seconds`; al arrancar siembra el gauge desde la tabla,
 * para que el dato sobreviva al reinicio del backend. Una fuente sin fila queda ausente.
 *
 * Sólo debe llamarse tras una corrida `success`: una `partial` o `failure` no modifica este momento.
 * Un fallo al leer o escribir se registra en el log y nunca afecta a la corrida ni al arranque.
 */
@Injectable()
export class SyncLastSuccessService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncLastSuccessService.name);

  constructor(
    private readonly repository: SyncLastSuccessRepository,
    @Inject(BUSINESS_METRICS) private readonly metrics: BusinessMetrics,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      for (const row of await this.repository.findAll()) {
        this.metrics.setSyncLastSuccess(row.source, row.succeededAt);
      }
    } catch (error) {
      this.logger.error(
        'No se pudo sembrar la última sincronización exitosa desde la base.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Registra una corrida exitosa de `source` terminada en `at`. Nunca lanza. */
  async record(source: SyncSource, at: Date): Promise<void> {
    try {
      this.metrics.setSyncLastSuccess(source, at);
      await this.repository.upsert(source, at);
    } catch (error) {
      this.logger.error(
        `No se pudo guardar la última sincronización exitosa de ${source}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
