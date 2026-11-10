import { Response } from 'express';
import { HealthService } from '../../services/observability/health.service';
import { HealthController } from './health.controller';
import { HealthResponseDto } from './dto/health-response.dto';

describe('HealthController', () => {
  const okReport: HealthResponseDto = {
    status: 'ok',
    info: { database: { status: 'up' } },
    error: {},
    details: { database: { status: 'up' } },
  };
  const errorReport: HealthResponseDto = {
    status: 'error',
    info: {},
    error: { database: { status: 'down' } },
    details: { database: { status: 'down' } },
  };

  let healthService: { check: jest.Mock };
  let res: { status: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    healthService = { check: jest.fn() };
    res = { status: jest.fn() };
    controller = new HealthController(healthService as unknown as HealthService);
  });

  it('devuelve el informe sin fijar 503 cuando el estado es ok (queda 200)', async () => {
    healthService.check.mockResolvedValue(okReport);

    await expect(controller.getHealth(res as unknown as Response)).resolves.toEqual(okReport);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('fija 503 y devuelve el informe cuando el estado es error', async () => {
    healthService.check.mockResolvedValue(errorReport);

    await expect(controller.getHealth(res as unknown as Response)).resolves.toEqual(errorReport);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('fija 503 también durante el apagado (shutting_down)', async () => {
    healthService.check.mockResolvedValue({ ...errorReport, status: 'shutting_down' });

    await controller.getHealth(res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(503);
  });
});
