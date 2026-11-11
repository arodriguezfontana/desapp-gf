import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  DURATION_BUCKETS_SECONDS,
  isStreamResponse,
  normalizeMethod,
  OTHER_METHOD,
  resolveRouteLabel,
  toMetricSample,
  UNMATCHED_ROUTE,
} from './request-metrics';

const responseWith = (headers: Record<string, string>, statusCode = 200): ServerResponse =>
  ({
    statusCode,
    getHeader: (name: string) => headers[name.toLowerCase()],
  }) as unknown as ServerResponse;

const requestWith = (method: string | undefined, route?: { path?: unknown }): IncomingMessage =>
  ({
    method,
    route,
    url: '/players/123?token=secreto',
    originalUrl: '/players/123?token=secreto',
  }) as unknown as IncomingMessage;

describe('normalizeMethod', () => {
  it.each(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('conserva %s', (method) => {
    expect(normalizeMethod(method)).toBe(method);
  });

  it('pasa a mayúsculas antes de comparar', () => {
    expect(normalizeMethod('get')).toBe('GET');
  });

  it.each([['FOO'], ['PROPFIND'], [''], [undefined]])('agrupa %p bajo OTHER', (method) => {
    expect(normalizeMethod(method)).toBe(OTHER_METHOD);
  });
});

describe('resolveRouteLabel', () => {
  it('devuelve el patrón de la ruta resuelta, no el path pedido', () => {
    const req = requestWith('GET', { path: '/players/:id' });
    expect(resolveRouteLabel(req)).toBe('/players/:id');
  });

  it.each([
    ['sin route (404 / 400 del parser)', undefined],
    ['route sin path', {}],
    ['comodín *', { path: '*' }],
    ['comodín de Express 5', { path: '/{*splat}' }],
    ['path que no es string', { path: /regex/ }],
  ])('devuelve unmatched: %s', (_label, route) => {
    expect(resolveRouteLabel(requestWith('GET', route as { path?: unknown }))).toBe(UNMATCHED_ROUTE);
  });

  it('nunca usa la URL cruda como etiqueta', () => {
    const label = resolveRouteLabel(requestWith('GET', undefined));
    expect(label).toBe('unmatched');
    expect(label).not.toContain('123');
    expect(label).not.toContain('secreto');
  });
});

describe('isStreamResponse', () => {
  it('detecta text/event-stream (también con parámetros)', () => {
    expect(isStreamResponse(responseWith({ 'content-type': 'text/event-stream' }))).toBe(true);
    expect(isStreamResponse(responseWith({ 'content-type': 'text/event-stream; charset=utf-8' }))).toBe(true);
  });

  it('no marca como stream a JSON ni a una respuesta sin content-type', () => {
    expect(isStreamResponse(responseWith({ 'content-type': 'application/json' }))).toBe(false);
    expect(isStreamResponse(responseWith({}))).toBe(false);
  });
});

describe('toMetricSample', () => {
  it('arma la muestra con método normalizado, ruta, estado numérico y duración en segundos', () => {
    const sample = toMetricSample(
      requestWith('get', { path: '/players/:id' }),
      responseWith({ 'content-type': 'application/json' }, 200),
      120,
    );
    expect(sample).toEqual({ method: 'GET', route: '/players/:id', statusCode: 200, durationSeconds: 0.12 });
  });

  it('usa unmatched y OTHER cuando no hay ruta ni método estándar', () => {
    const sample = toMetricSample(requestWith('BREW', undefined), responseWith({}, 404), 3);
    expect(sample).toEqual({ method: 'OTHER', route: 'unmatched', statusCode: 404, durationSeconds: 0.003 });
  });

  it('un stream deja la duración en null (se cuenta pero no entra al histograma)', () => {
    const sample = toMetricSample(
      requestWith('GET', { path: '/notifications/stream' }),
      responseWith({ 'content-type': 'text/event-stream' }, 200),
      60000,
    );
    expect(sample.durationSeconds).toBeNull();
    expect(sample.route).toBe('/notifications/stream');
  });
});

describe('DURATION_BUCKETS_SECONDS', () => {
  it('son los intervalos definidos (incluyen cada umbral de SLA) y están en orden ascendente', () => {
    expect(DURATION_BUCKETS_SECONDS).toEqual([
      0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 0.6, 0.8, 1, 2.5, 5, 10,
    ]);
    const sorted = [...DURATION_BUCKETS_SECONDS].sort((a, b) => a - b);
    expect(DURATION_BUCKETS_SECONDS).toEqual(sorted);
  });
});
