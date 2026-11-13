import { InfoService } from '../../services/observability/info.service';
import { InfoController } from './info.controller';

describe('InfoController', () => {
  it('devuelve lo que arma el servicio, sin tocarlo', () => {
    const info = {
      name: 'backend',
      version: '1.0.0',
      commit: null,
      environment: 'test',
      node: 'v22.0.0',
      startedAt: '2026-11-11T12:00:00.000Z',
      uptimeSeconds: 5,
    };
    const infoService = { getInfo: jest.fn().mockReturnValue(info) };

    const controller = new InfoController(infoService as unknown as InfoService);

    expect(controller.getInfo()).toBe(info);
    expect(infoService.getInfo).toHaveBeenCalledTimes(1);
  });
});
