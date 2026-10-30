import { Logger } from '@nestjs/common';
import { QuotationService, QUOTATION_RECALCULATION_CRON } from '../quotation.service';
import { FixedClock, SequentialIdGenerator } from '../../../adapters/runtime/fake-runtime';
import { ValuationStrategyRepository } from '../../../repositories/quotation/valuation-strategy.repository';
import { PlayerQuoteRepository } from '../../../repositories/quotation/player-quote.repository';
import { PlayerRepository } from '../../../repositories/player/player.repository';

describe('QuotationService — @Cron semanal de recálculo (spec 019, FR-016)', () => {
  let service: QuotationService;
  let strategyRepo: jest.Mocked<ValuationStrategyRepository>;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    strategyRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      selectStrategy: jest.fn(),
      findAllUserIds: jest.fn().mockResolvedValue([]),
    };
    const quoteRepo: jest.Mocked<PlayerQuoteRepository> = {
      saveMany: jest.fn().mockResolvedValue(undefined),
      findAllByPlayerIdAndUserId: jest.fn(),
      deleteAllByUserId: jest.fn(),
    };
    const playerRepo = {
      findAllActive: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
    } as unknown as jest.Mocked<PlayerRepository>;

    service = new QuotationService(
      strategyRepo,
      quoteRepo,
      playerRepo,
      { emit: jest.fn(), emitAsync: jest.fn() } as never,
      new FixedClock(),
      new SequentialIdGenerator('quote'),
    );
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispara el mismo recálculo global que el endpoint de administrador', async () => {
    const spy = jest.spyOn(service, 'recalculateAll');

    await service.handleCron();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(strategyRepo.findAllUserIds).toHaveBeenCalledTimes(1);
  });

  it('loguea cuántas cotizaciones se calcularon y cuántas se saltearon', async () => {
    jest.spyOn(service, 'recalculateAll').mockResolvedValue({
      recalculated: [{ userId: 'u1', playerId: 'p1', value: 10, score: 0.1 }],
      skipped: [
        { userId: 'u1', playerId: 'p2', reason: 'x' },
        { userId: 'u1', playerId: 'p3', reason: 'y' },
      ],
    });

    await service.handleCron();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 cotizaciones, 2 salteadas'));
  });

  it('si ya hay un recálculo en curso, se saltea con una advertencia y no inicia otro', async () => {
    let release!: () => void;
    strategyRepo.findAllUserIds.mockReturnValue(
      new Promise<string[]>((resolve) => {
        release = () => resolve([]);
      }),
    );
    const manual = service.recalculateAll();

    await expect(service.handleCron()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ya hay un recálculo en curso'));
    expect(strategyRepo.findAllUserIds).toHaveBeenCalledTimes(1);
    release();
    await manual;
  });

  it('ante un error inesperado lo registra y no lo propaga al scheduler', async () => {
    strategyRepo.findAllUserIds.mockRejectedValueOnce(new Error('base de datos caída'));

    await expect(service.handleCron()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('error inesperado'), expect.any(String));
  });

  it('tras un error libera el lock y el siguiente cron puede correr', async () => {
    strategyRepo.findAllUserIds.mockRejectedValueOnce(new Error('base de datos caída'));

    await service.handleCron();
    await expect(service.handleCron()).resolves.toBeUndefined();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(strategyRepo.findAllUserIds).toHaveBeenCalledTimes(2);
  });

  describe('configuración del @Cron', () => {
    // No se puede esperar una semana real para ver disparar el cron; lo que sí
    // se fija es que el método siga decorado como documenta la spec 019 (mismo
    // criterio que el test de PlayerSyncService).
    it('handleCron() está decorado con el cron semanal y waitForCompletion', () => {
      const options = Reflect.getMetadata('SCHEDULE_CRON_OPTIONS', QuotationService.prototype.handleCron);

      expect(options).toEqual({ waitForCompletion: true, cronTime: QUOTATION_RECALCULATION_CRON });
    });

    it('corre los domingos a las 03:00, después de los jobs de sincronización de las 00:00', () => {
      expect(QUOTATION_RECALCULATION_CRON).toBe('0 3 * * 0');
    });
  });
});
