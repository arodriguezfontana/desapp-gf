import { REDACTED, redactBody, redactQuery, redactUrl } from './redaction';

describe('redactBody', () => {
  it.each([
    'password',
    'Password',
    'accessToken',
    'refresh_token',
    'apiKey',
    'x-api-key',
    'Authorization',
    'email',
    'EMAIL',
    'username',
    'userName',
    'user_name',
    'clientSecret',
    'credentials',
  ])('redacta el valor de la clave sensible "%s"', (key) => {
    expect(redactBody({ [key]: 'valor-secreto' })).toEqual({ [key]: REDACTED });
  });

  it('deja intactos los campos no sensibles (incluido userId, que no es el nombre de usuario)', () => {
    const body = { playerId: 'abc', userId: 'u-1', quantity: 3, side: 'BUY', nested: { price: 10.5 } };

    expect(redactBody(body)).toEqual(body);
  });

  it('redacta a cualquier profundidad y dentro de arreglos', () => {
    const body = {
      user: { profile: { Token: 'T', name: 'Ana' } },
      items: [{ apiKey: 'K', id: 1 }, { id: 2 }],
    };

    expect(redactBody(body)).toEqual({
      user: { profile: { Token: REDACTED, name: 'Ana' } },
      items: [{ apiKey: REDACTED, id: 1 }, { id: 2 }],
    });
  });

  it('redacta el valor completo aunque sea un objeto', () => {
    expect(redactBody({ credentials: { user: 'a', pass: 'b' } })).toEqual({
      credentials: REDACTED,
    });
  });

  it('no muta el objeto original', () => {
    const body = { password: 'p', nested: { token: 't' } };

    redactBody(body);

    expect(body).toEqual({ password: 'p', nested: { token: 't' } });
  });

  it('corta con "[Truncated]" una estructura demasiado profunda en vez de recursar sin fin', () => {
    let deep: Record<string, unknown> = { leaf: 'x' };
    for (let i = 0; i < 20; i++) {
      deep = { child: deep };
    }

    expect(JSON.stringify(redactBody(deep))).toContain('[Truncated]');
  });

  it('no se cuelga con referencias circulares', () => {
    const body: Record<string, unknown> = { name: 'a' };
    body.self = body;

    expect(() => redactBody(body)).not.toThrow();
    expect(JSON.stringify(redactBody(body))).toContain('[Truncated]');
  });

  it('los primitivos, null y undefined pasan sin cambios', () => {
    expect(redactBody('texto')).toBe('texto');
    expect(redactBody(5)).toBe(5);
    expect(redactBody(null)).toBeNull();
    expect(redactBody(undefined)).toBeUndefined();
  });
});

describe('redactQuery', () => {
  it('aplica la misma regla que el cuerpo', () => {
    expect(redactQuery({ token: 'abc', league: 'PL', ApiKey: 'k' })).toEqual({
      token: REDACTED,
      league: 'PL',
      ApiKey: REDACTED,
    });
  });
});

describe('redactUrl', () => {
  it('redacta el token del stream de notificaciones', () => {
    expect(redactUrl('/notifications/stream?token=abc&x=1')).toBe(
      '/notifications/stream?token=[REDACTED]&x=1',
    );
  });

  it('deja igual una URL sin query', () => {
    expect(redactUrl('/players/123')).toBe('/players/123');
  });

  it('deja igual una query sin claves sensibles', () => {
    expect(redactUrl('/players?league=PL&page=2')).toBe('/players?league=PL&page=2');
  });

  it('redacta todas las claves sensibles, sin distinguir mayúsculas', () => {
    expect(redactUrl('/x?Token=a&password=b&ok=1&API_KEY=c')).toBe(
      '/x?Token=[REDACTED]&password=[REDACTED]&ok=1&API_KEY=[REDACTED]',
    );
  });

  it('redacta una clave sensible sin valor y una con valor vacío', () => {
    expect(redactUrl('/x?token=&flag')).toBe('/x?token=[REDACTED]&flag');
  });

  it('redacta aunque la clave venga codificada', () => {
    expect(redactUrl('/x?access%5Ftoken=abc')).toBe('/x?access%5Ftoken=[REDACTED]');
  });
});
