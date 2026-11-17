import { buildCacheKey, buildUserRankingCacheKey, hashParams } from './build-cache-key';

describe('buildCacheKey', () => {
  it('genera el mismo hash independientemente del orden de los parámetros', () => {
    const key1 = buildCacheKey('catalog', { league: 'Premier League', page: 1, position: 'FW' });
    const key2 = buildCacheKey('catalog', { position: 'FW', page: 1, league: 'Premier League' });

    expect(key1).toBe(key2);
    expect(key1).toMatch(/^futval:catalog:[a-f0-9]{16}$/);
  });

  it('omite parámetros nulos, indefinidos o cadenas vacías', () => {
    const keyWithEmpties = buildCacheKey('catalog', {
      league: 'La Liga',
      team: '',
      position: null,
      extra: undefined,
    });
    const keyClean = buildCacheKey('catalog', { league: 'La Liga' });

    expect(keyWithEmpties).toBe(keyClean);
  });

  it('aplica trim sobre cadenas para evitar divergencias por espacios', () => {
    const key1 = buildCacheKey('catalog', { team: 'Arsenal  ' });
    const key2 = buildCacheKey('catalog', { team: 'Arsenal' });

    expect(key1).toBe(key2);
  });

  it('devuelve hash "default" cuando el objeto de parámetros está vacío o sólo contiene valores vacíos', () => {
    const hash = hashParams({});
    expect(hash).toBe('default');

    const key = buildCacheKey('catalog', { a: null, b: undefined, c: '' });
    expect(key).toBe('futval:catalog:default');
  });

  it('permite personalizar el prefijo global', () => {
    const key = buildCacheKey('player', { id: 'uuid-123' }, { prefix: 'test' });
    expect(key).toMatch(/^test:player:[a-f0-9]{16}$/);
  });

  it('preserva el número 0 y no lo trata como valor falsy o vacío', () => {
    const hashZero = hashParams({ offset: 0, page: 1 });
    const hashWithoutZero = hashParams({ page: 1 });

    expect(hashZero).not.toBe(hashWithoutZero);
  });

  it('procesa correctamente caracteres con tilde, diacríticos y símbolos internacionales', () => {
    const key1 = buildCacheKey('catalog', { team: 'Atlético de Madrid', player: 'Müller' });
    const key2 = buildCacheKey('catalog', { player: 'Müller', team: 'Atlético de Madrid' });

    expect(key1).toBe(key2);
    expect(key1).toMatch(/^futval:catalog:[a-f0-9]{16}$/);
  });
});

describe('buildUserRankingCacheKey', () => {
  it('aisla la clave con el userId autenticado en el namespace', () => {
    const userId1 = 'user-uuid-1';
    const userId2 = 'user-uuid-2';
    const params = { page: 1, pageSize: 10 };

    const keyUser1 = buildUserRankingCacheKey(userId1, params);
    const keyUser2 = buildUserRankingCacheKey(userId2, params);

    expect(keyUser1).not.toBe(keyUser2);
    expect(keyUser1).toContain(`futval:ranking:${userId1}:`);
    expect(keyUser2).toContain(`futval:ranking:${userId2}:`);
  });
});
