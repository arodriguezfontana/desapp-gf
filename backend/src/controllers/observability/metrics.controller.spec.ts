import { Response } from 'express';
import { MetricsService } from '../../services/observability/metrics.service';
import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  let metricsService: { render: jest.Mock; contentType: string };
  let res: { type: jest.Mock };
  let controller: MetricsController;

  beforeEach(() => {
    metricsService = {
      render: jest.fn(),
      contentType: 'text/plain; version=0.0.4; charset=utf-8',
    };
    res = { type: jest.fn() };
    controller = new MetricsController(metricsService as unknown as MetricsService);
  });

  it('devuelve el texto que arma el servicio, sin tocarlo', async () => {
    metricsService.render.mockResolvedValue('# TYPE http_requests_total counter\n');

    await expect(controller.getMetrics(res as unknown as Response)).resolves.toBe(
      '# TYPE http_requests_total counter\n',
    );
    expect(metricsService.render).toHaveBeenCalledTimes(1);
  });

  it('fija el Content-Type del formato de Prometheus que informa el servicio', async () => {
    metricsService.render.mockResolvedValue('');

    await controller.getMetrics(res as unknown as Response);

    expect(res.type).toHaveBeenCalledWith('text/plain; version=0.0.4; charset=utf-8');
  });
});
