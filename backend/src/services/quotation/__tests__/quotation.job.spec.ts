import { Logger } from '@nestjs/common';
import { RecalculationInProgressError } from '../../../domain/quotation/errors/recalculation-in-progress.error';
import { QuotationJob, QUOTATION_RECALCULATION_CRON } from '../quotation.job';
import { QuotationService } from '../quotation.service';

describe('QuotationJob', () => {
  let recalculateAll: jest.Mock;
  let job: QuotationJob;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    recalculateAll = jest.fn();
    job = new QuotationJob({ recalculateAll } as unknown as QuotationService);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispara el mismo recálculo global que el endpoint de administrador', async () => {
    recalculateAll.mockResolvedValue({ recalculated: [], skipped: [] });

    await job.recalculate();

    expect(recalculateAll).toHaveBeenCalledTimes(1);
  });

  it('loguea cuántas cotizaciones se calcularon y cuántas se saltearon', async () => {
    recalculateAll.mockResolvedValue({
      recalculated: [{ userId: 'u1', playerId: 'p1', value: 10, score: 0.1 }],
      skipped: [
        { userId: 'u1', playerId: 'p2', reason: 'x' },
        { userId: 'u1', playerId: 'p3', reason: 'y' },
      ],
    });

    await job.recalculate();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 cotizaciones, 2 salteadas'));
  });

  it('si ya hay un recálculo en curso, se saltea con una advertencia y no lanza', async () => {
    recalculateAll.mockRejectedValue(new RecalculationInProgressError());

    await expect(job.recalculate()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ya hay uno en curso'));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('ante un error inesperado lo registra y no lanza, para no tumbar el scheduler', async () => {
    recalculateAll.mockRejectedValue(new Error('base de datos caída'));

    await expect(job.recalculate()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('error inesperado'), expect.any(String));
  });

  describe('configuración del @Cron', () => {
    // No se puede esperar una semana real para ver disparar el cron; lo que sí
    // se fija es que el método siga decorado como documenta la spec 027
    // (mismo criterio que el test de PlayerSyncService).
    it('recalculate() está decorado con el cron semanal y waitForCompletion', () => {
      const options = Reflect.getMetadata('SCHEDULE_CRON_OPTIONS', QuotationJob.prototype.recalculate);

      expect(options).toEqual({ waitForCompletion: true, cronTime: QUOTATION_RECALCULATION_CRON });
    });

    it('corre los domingos a las 03:00, después de los jobs de sincronización de las 00:00', () => {
      expect(QUOTATION_RECALCULATION_CRON).toBe('0 3 * * 0');
    });
  });
});
