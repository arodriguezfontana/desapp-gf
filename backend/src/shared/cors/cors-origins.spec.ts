import { DEFAULT_CORS_ORIGIN, parseCorsOrigins } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('sin CORS_ORIGIN usa el origen de desarrollo local', () => {
    expect(parseCorsOrigins(undefined)).toEqual([DEFAULT_CORS_ORIGIN]);
  });

  it('con un valor vacío o solo espacios usa el origen de desarrollo local', () => {
    expect(parseCorsOrigins('')).toEqual([DEFAULT_CORS_ORIGIN]);
    expect(parseCorsOrigins('   ')).toEqual([DEFAULT_CORS_ORIGIN]);
  });

  it('devuelve un único origen tal cual', () => {
    expect(parseCorsOrigins('https://futval.example.com')).toEqual(['https://futval.example.com']);
  });

  it('separa varios orígenes por coma y descarta espacios y vacíos', () => {
    expect(parseCorsOrigins(' https://futval.example.com , http://localhost:5173,, ')).toEqual([
      'https://futval.example.com',
      'http://localhost:5173',
    ]);
  });
});
