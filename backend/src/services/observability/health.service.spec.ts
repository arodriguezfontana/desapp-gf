import { ServiceUnavailableException } from '@nestjs/common';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const okResult = {
    status: 'ok' as const,
    info: { database: { status: 'up' as const } },
    error: {},
    details: { database: { status: 'up' as const } },
  };
  const errorResult = {
    status: 'error' as const,
    info: {},
    error: { database: { status: 'down' as const } },
    details: { database: { status: 'down' as const } },
  };

  let healthCheck: { check: jest.Mock };
  let typeOrm: { pingCheck: jest.Mock };
  let service: HealthService;

  beforeEach(() => {
    healthCheck = { check: jest.fn() };
    typeOrm = { pingCheck: jest.fn().mockResolvedValue(okResult.details) };
    service = new HealthService(
      healthCheck as unknown as HealthCheckService,
      typeOrm as unknown as TypeOrmHealthIndicator,
    );
  });

  it('devuelve el informe cuando la base de datos responde', async () => {
    healthCheck.check.mockResolvedValue(okResult);

    await expect(service.check()).resolves.toEqual(okResult);
  });

  it('devuelve el informe de error en lugar de relanzar la ServiceUnavailableException de Terminus', async () => {
    healthCheck.check.mockRejectedValue(new ServiceUnavailableException(errorResult));

    await expect(service.check()).resolves.toEqual(errorResult);
  });

  it('relanza los errores inesperados que no son una ServiceUnavailableException', async () => {
    const unexpected = new Error('fallo inesperado');
    healthCheck.check.mockRejectedValue(unexpected);

    await expect(service.check()).rejects.toBe(unexpected);
  });

  it('verifica únicamente la base de datos con un timeout de 3000 ms', async () => {
    healthCheck.check.mockImplementation(async (indicators: Array<() => Promise<unknown>>) => {
      expect(indicators).toHaveLength(1);
      await indicators[0]();
      return okResult;
    });

    await service.check();

    expect(typeOrm.pingCheck).toHaveBeenCalledTimes(1);
    expect(typeOrm.pingCheck).toHaveBeenCalledWith('database', { timeout: 3000 });
  });
});
