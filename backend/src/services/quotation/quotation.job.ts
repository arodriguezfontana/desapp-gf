import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RecalculationInProgressError } from '../../domain/quotation/errors/recalculation-in-progress.error';
import { QuotationService } from './quotation.service';

/**
 * Domingos a las 03:00. Los jobs de sincronización de jugadores y de partidos
 * corren los domingos a las 00:00 (`CronExpression.EVERY_WEEK`); el recálculo
 * va unas horas después para valuar con las métricas ya sincronizadas y no
 * con las de la semana anterior.
 */
export const QUOTATION_RECALCULATION_CRON = '0 3 * * 0';

/**
 * Recálculo semanal automático de cotizaciones (spec 027). Llama al mismo
 * método del Service que el endpoint manual de administrador
 * (`POST /quotes/recalculate`) para no duplicar lógica, y comparte con él el
 * lock a nivel sistema: si hay un recálculo en curso, se saltea sin lanzar
 * (mismo patrón que `PlayerSyncService`).
 */
@Injectable()
export class QuotationJob {
  private readonly logger = new Logger(QuotationJob.name);

  constructor(private readonly quotationService: QuotationService) {}

  @Cron(QUOTATION_RECALCULATION_CRON, { waitForCompletion: true })
  async recalculate(): Promise<void> {
    try {
      const result = await this.quotationService.recalculateAll();
      this.logger.log(
        `[Cron] Recálculo semanal completado: ${result.recalculated.length} cotizaciones, ${result.skipped.length} salteadas.`,
      );
    } catch (err) {
      if (err instanceof RecalculationInProgressError) {
        this.logger.warn('[Cron] El recálculo semanal se saltea porque ya hay uno en curso.');
        return;
      }
      this.logger.error(
        '[Cron] El recálculo semanal falló con un error inesperado.',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
