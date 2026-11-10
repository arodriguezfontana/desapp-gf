import { createCorsOptions, DEFAULT_CORS_ORIGIN } from './cors-origins';

describe('createCorsOptions', () => {
  it('expone el header X-Correlation-Id al frontend', () => {
    expect(createCorsOptions(undefined).exposedHeaders).toEqual(['X-Correlation-Id']);
  });

  it('mantiene las credenciales habilitadas', () => {
    expect(createCorsOptions(undefined).credentials).toBe(true);
  });

  it('sin CORS_ORIGIN permite sólo el origen de desarrollo local', () => {
    expect(createCorsOptions(undefined).origin).toEqual([DEFAULT_CORS_ORIGIN]);
    expect(createCorsOptions('').origin).toEqual([DEFAULT_CORS_ORIGIN]);
  });

  it('respeta la lista de orígenes de CORS_ORIGIN', () => {
    expect(createCorsOptions('https://app.example.com, http://localhost:5173').origin).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
    ]);
  });
});
