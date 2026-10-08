import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecalculationInProgressError } from '../../domain/quotation/errors/recalculation-in-progress.error';
import { QuotationService } from './quotation.service';

/**
 * Job semanal de recálculo de cotizaciones (012-valuation-strategies, spec FR-014).
 * Llama al mismo método del Service que usa el endpoint manual para no duplicar lógica.
 * Si hay un recálculo en curso retorna silenciosamente (mismo patrón que PlayerSyncService).
 */
@Injectable()
export class QuotationJob {
  private readonly logger = new Logger(QuotationJob.name);

  constructor(private readonly quotationService: QuotationService) {}

  @Cron(CronExpression.EVERY_WEEK, { waitForCompletion: true })
  async recalculate(): Promise<void> {
    try {
      const result = await this.quotationService.recalculateAll();
      this.logger.log(
        `[Cron] Recálculo semanal completado: ${result.processedPlayers} jugadores, ${result.errors} errores, ${result.durationMs} ms`,
      );
    } catch (err) {
      if (err instanceof RecalculationInProgressError) {
        this.logger.warn(
          '[Cron] El recálculo semanal se saltea porque ya hay uno en curso.',
        );
        return;
      }
      this.logger.error(
        '[Cron] El recálculo semanal falló con un error inesperado.',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
