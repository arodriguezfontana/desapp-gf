/* eslint-disable @typescript-eslint/no-explicit-any -- las opciones de pino-http se inspeccionan como objeto suelto */
import { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import { buildRequestLogOptions } from './request-log-options';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type AnyFn = (...args: any[]) => any;

const options = () => buildRequestLogOptions(pino({ level: 'silent' })) as any;

describe('buildRequestLogOptions', () => {
  describe('US1: Correlation ID', () => {
    it('lleva sólo el id en el child logger y lo nombra correlationId', () => {
      const opts = options();

      expect(opts.quietReqLogger).toBe(true);
      expect(opts.customAttributeKeys.reqId).toBe('correlationId');
    });

    it('sin header entrante genera un UUID v4 y lo devuelve en X-Correlation-Id', () => {
      const setHeader = jest.fn();
      const req = { headers: {} } as unknown as IncomingMessage;
      const res = { setHeader } as unknown as ServerResponse;

      const id = (options().genReqId as AnyFn)(req, res);

      expect(id).toMatch(UUID_V4);
      expect(setHeader).toHaveBeenCalledWith('X-Correlation-Id', id);
    });

    it('dos requests sin header reciben ids distintos', () => {
      const res = { setHeader: jest.fn() } as unknown as ServerResponse;
      const req = { headers: {} } as unknown as IncomingMessage;

      const genReqId = options().genReqId as AnyFn;

      expect(genReqId(req, res)).not.toBe(genReqId(req, res));
    });
  });

  describe('serializadores y nivel', () => {
    it('el serializador de res emite sólo el código de estado (no el cuerpo ni los headers)', () => {
      const serialized = options().serializers.res({
        statusCode: 201,
        headers: { 'content-type': 'application/json' },
        body: { accessToken: 'x' },
      });

      expect(serialized).toEqual({ statusCode: 201 });
    });

    it('el serializador de req emite sólo método y URL, sin headers', () => {
      const serialized = options().serializers.req({
        method: 'GET',
        url: '/players?league=PL',
        headers: { authorization: 'Bearer x', 'x-api-key': 'pmk_y' },
      });

      expect(serialized).toEqual({ method: 'GET', url: '/players?league=PL' });
    });

    it('la URL serializada pasa por la redacción', () => {
      const serialized = options().serializers.req({
        method: 'GET',
        url: '/notifications/stream?token=eyJ.a.b',
      });

      expect(serialized.url).toBe('/notifications/stream?token=[REDACTED]');
    });

    it('customLogLevel: error para 5xx o error, warn para 4xx e info para el resto', () => {
      const customLogLevel = options().customLogLevel as AnyFn;
      const req = {} as IncomingMessage;

      expect(customLogLevel(req, { statusCode: 500 })).toBe('error');
      expect(customLogLevel(req, { statusCode: 200 }, new Error('x'))).toBe('error');
      expect(customLogLevel(req, { statusCode: 404 })).toBe('warn');
      expect(customLogLevel(req, { statusCode: 401 })).toBe('warn');
      expect(customLogLevel(req, { statusCode: 201 })).toBe('info');
      expect(customLogLevel(req, { statusCode: 302 })).toBe('info');
    });
  });
});

describe('buildRequestLogOptions: campos de la entrada (US2)', () => {
  const base = { responseTime: 3, res: { statusCode: 200 } };
  const success = (req: Record<string, unknown>) =>
    (options().customSuccessObject as AnyFn)(req, {}, base) as Record<string, unknown>;

  it('conserva lo que ya trae pino-http y agrega el usuario autenticado', () => {
    const fields = success({ user: { userId: 'u-1' } });

    expect(fields).toMatchObject({ responseTime: 3, res: { statusCode: 200 }, userId: 'u-1' });
  });

  it('registra "anónimo" (nunca null) cuando la request no tiene usuario', () => {
    expect(success({}).userId).toBe('anónimo');
    expect(success({ user: undefined }).userId).toBe('anónimo');
  });

  it('agrega el patrón de ruta, los params y la query (redactada)', () => {
    const fields = success({
      route: { path: '/players/:id' },
      params: { id: 'abc-123' },
      query: { league: 'PL', token: 'secreto' },
    });

    expect(fields.route).toBe('/players/:id');
    expect(fields.params).toEqual({ id: 'abc-123' });
    expect(fields.query).toEqual({ league: 'PL', token: '[REDACTED]' });
  });

  it('sin ruta resuelta omite "route" y deja params y query como objetos vacíos', () => {
    const fields = success({});

    expect(fields).not.toHaveProperty('route');
    expect(fields.params).toEqual({});
    expect(fields.query).toEqual({});
  });

  it('agrega el cuerpo redactado cuando existe', () => {
    const fields = success({ body: { playerId: 'p1', quantity: 2, password: 'x' } });

    expect(fields.body).toEqual({ playerId: 'p1', quantity: 2, password: '[REDACTED]' });
  });

  it('omite el cuerpo cuando no hay o está vacío', () => {
    expect(success({})).not.toHaveProperty('body');
    expect(success({ body: undefined })).not.toHaveProperty('body');
    expect(success({ body: {} })).not.toHaveProperty('body');
    expect(success({ body: '' })).not.toHaveProperty('body');
  });

  it('trunca un cuerpo que supera los 2048 caracteres y lo marca', () => {
    const fields = success({ body: { blob: 'x'.repeat(5000) } });

    expect(fields.body).toEqual({ _truncated: true, preview: expect.any(String) });
    expect((fields.body as { preview: string }).preview).toHaveLength(2048);
  });

  it('un cuerpo justo en el límite no se trunca', () => {
    const exact = { a: 'x'.repeat(2048 - JSON.stringify({ a: '' }).length) };
    expect(JSON.stringify(exact)).toHaveLength(2048);

    expect(success({ body: exact }).body).toEqual(exact);
  });

  it('un cuerpo no serializable se marca en lugar de fallar', () => {
    const fields = success({ body: { n: BigInt(1) } });

    expect(fields.body).toEqual({ _unserializable: true });
  });

  it('si armar los campos lanza, devuelve lo que ya había y no relanza (FR-015)', () => {
    const hostile = {
      get query() {
        throw new Error('boom');
      },
    };

    expect(() => success(hostile)).not.toThrow();
    expect(success(hostile)).toEqual(base);
  });

  it('customErrorObject agrega los mismos campos', () => {
    const fields = (options().customErrorObject as AnyFn)(
      { user: { userId: 'u-2' }, body: { quantity: 1 } },
      {},
      new Error('x'),
      base,
    ) as Record<string, unknown>;

    expect(fields).toMatchObject({ userId: 'u-2', body: { quantity: 1 }, responseTime: 3 });
  });
});

describe('buildRequestLogOptions: sin secretos en el log (US3)', () => {
  const success = (req: Record<string, unknown>) =>
    (options().customSuccessObject as AnyFn)(req, {}, {}) as Record<string, unknown>;

  it('el serializador de req no emite ningún header (authorization, x-api-key, cookie)', () => {
    const serialized = options().serializers.req({
      method: 'POST',
      url: '/orders',
      headers: { authorization: 'Bearer abc', 'x-api-key': 'pmk_xyz', cookie: 'sid=1' },
    });

    expect(JSON.stringify(serialized)).not.toMatch(/abc|pmk_xyz|sid=1|authorization|cookie/i);
  });

  it('la URL del stream de notificaciones sale con el token redactado', () => {
    const serialized = options().serializers.req({
      method: 'GET',
      url: '/notifications/stream?token=eyJ.a.b',
    });

    expect(serialized.url).toBe('/notifications/stream?token=[REDACTED]');
  });

  it('redacta contraseña, email y tokens del cuerpo, con cualquier capitalización y anidamiento', () => {
    const fields = success({
      body: {
        email: 'ana@mail.com',
        Password: 'Abcd1234!',
        profile: { accessToken: 'jwt', nickname: 'ana' },
        sessions: [{ refresh_token: 'r', device: 'web' }],
      },
    });

    expect(fields.body).toEqual({
      email: '[REDACTED]',
      Password: '[REDACTED]',
      profile: { accessToken: '[REDACTED]', nickname: 'ana' },
      sessions: [{ refresh_token: '[REDACTED]', device: 'web' }],
    });
    expect(JSON.stringify(fields)).not.toMatch(/ana@mail\.com|Abcd1234!|jwt/);
  });

  it('redacta la query sensible y deja el resto', () => {
    const fields = success({ query: { token: 'jwt', ApiKey: 'k', league: 'PL' } });

    expect(fields.query).toEqual({ token: '[REDACTED]', ApiKey: '[REDACTED]', league: 'PL' });
  });

  it('redacta aun cuando el cuerpo se trunca: el preview sale de la copia ya redactada', () => {
    const fields = success({ body: { password: 'SECRETO-LARGO', blob: 'x'.repeat(5000) } });

    expect(JSON.stringify(fields)).not.toContain('SECRETO-LARGO');
  });
});

describe('buildRequestLogOptions: error de un 5xx', () => {
  it('customErrorObject descarta el Error fabricado por pino-http (su stack no es el del fallo real)', () => {
    const fields = (options().customErrorObject as AnyFn)(
      {},
      {},
      new Error('failed with status code 500'),
      { responseTime: 3, res: { statusCode: 500 }, err: new Error('failed with status code 500') },
    ) as Record<string, unknown>;

    expect(fields).not.toHaveProperty('err');
    expect(fields).toMatchObject({ responseTime: 3, res: { statusCode: 500 }, userId: 'anónimo' });
  });
});
