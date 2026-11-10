/* eslint-disable @typescript-eslint/no-explicit-any -- las opciones de pino-http se inspeccionan como objeto suelto */
import pino from 'pino';
import { RequestMetricsRecorder } from '../metrics/request-metrics';
import { buildRequestLogOptions } from './request-log-options';

/**
 * 029-http-metrics-sla: las métricas se registran en los mismos callbacks de cierre que arman la
 * línea de log de la 028 (`customSuccessObject` / `customErrorObject`), con los mismos valores.
 */
type AnyFn = (...args: any[]) => any;

const logger = pino({ level: 'silent' });

const reqOf = (method: string, route?: { path: string }) =>
  ({ method, route, params: {}, query: {}, body: undefined, url: '/x' }) as any;

const resOf = (statusCode: number, contentType?: string) =>
  ({
    statusCode,
    getHeader: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : undefined),
  }) as any;

describe('hook de métricas en buildRequestLogOptions', () => {
  let recorder: { record: jest.Mock };

  beforeEach(() => {
    recorder = { record: jest.fn() };
  });

  const options = (withRecorder = true) =>
    buildRequestLogOptions(logger, withRecorder ? (recorder as RequestMetricsRecorder) : undefined) as any;

  describe('customSuccessObject', () => {
    it('registra la muestra con los mismos valores del log: método, patrón de ruta, estado y responseTime', () => {
      const res = resOf(200, 'application/json');

      const logged = (options().customSuccessObject as AnyFn)(
        reqOf('GET', { path: '/players/:id' }),
        res,
        { res, responseTime: 120 },
      );

      expect(recorder.record).toHaveBeenCalledTimes(1);
      expect(recorder.record).toHaveBeenCalledWith({
        method: 'GET',
        route: '/players/:id',
        statusCode: 200,
        durationSeconds: 0.12,
      });
      // La misma ruta y el mismo responseTime que quedan en la línea de log.
      expect(logged.route).toBe('/players/:id');
      expect(logged.responseTime).toBe(120);
    });

    it('sin ruta resuelta (404, 400 del parser) usa unmatched', () => {
      const res = resOf(404);

      (options().customSuccessObject as AnyFn)(reqOf('GET'), res, { res, responseTime: 2 });

      expect(recorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ route: 'unmatched', statusCode: 404 }),
      );
    });

    it('un stream se registra sin duración', () => {
      const res = resOf(200, 'text/event-stream');

      (options().customSuccessObject as AnyFn)(
        reqOf('GET', { path: '/notifications/stream' }),
        res,
        { res, responseTime: 90000 },
      );

      expect(recorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ route: '/notifications/stream', durationSeconds: null }),
      );
    });

    it('un recorder que lanza una excepción no rompe el objeto de log ni la request (FR-013)', () => {
      recorder.record.mockImplementation(() => {
        throw new Error('fallo de métricas');
      });
      const res = resOf(200);

      let logged: any;
      expect(() => {
        logged = (options().customSuccessObject as AnyFn)(reqOf('GET', { path: '/' }), res, {
          res,
          responseTime: 1,
        });
      }).not.toThrow();
      expect(logged.route).toBe('/');
      expect(logged.responseTime).toBe(1);
    });

    it('sin recorder (parámetro omitido) el log funciona igual', () => {
      const res = resOf(200);

      const logged = (options(false).customSuccessObject as AnyFn)(reqOf('GET', { path: '/' }), res, {
        res,
        responseTime: 5,
      });

      expect(logged.route).toBe('/');
    });
  });

  describe('customErrorObject (5xx)', () => {
    it('registra la muestra con el estado 5xx y los mismos valores del log', () => {
      const res = resOf(500, 'application/json');

      const logged = (options().customErrorObject as AnyFn)(
        reqOf('POST', { path: '/orders' }),
        res,
        new Error('x'),
        { res, responseTime: 30, err: new Error('fabricado') },
      );

      expect(recorder.record).toHaveBeenCalledTimes(1);
      expect(recorder.record).toHaveBeenCalledWith({
        method: 'POST',
        route: '/orders',
        statusCode: 500,
        durationSeconds: 0.03,
      });
      expect(logged.err).toBeUndefined();
      expect(logged.responseTime).toBe(30);
    });

    it('un recorder que lanza una excepción no rompe el objeto de log (FR-013)', () => {
      recorder.record.mockImplementation(() => {
        throw new Error('fallo de métricas');
      });
      const res = resOf(500);

      expect(() =>
        (options().customErrorObject as AnyFn)(reqOf('GET', { path: '/x' }), res, new Error('x'), {
          res,
          responseTime: 3,
        }),
      ).not.toThrow();
    });
  });

  describe('customLogLevel nunca devuelve silent', () => {
    // Si devolviera `silent`, pino-http no evaluaría los callbacks y esa ruta dejaría de medirse.
    it.each([200, 201, 204, 301, 400, 401, 403, 404, 429, 500, 503])('estado %i', (statusCode) => {
      expect((options().customLogLevel as AnyFn)(reqOf('GET'), resOf(statusCode))).not.toBe('silent');
    });

    it('con error', () => {
      expect((options().customLogLevel as AnyFn)(reqOf('GET'), resOf(200), new Error('x'))).not.toBe('silent');
    });
  });
});
