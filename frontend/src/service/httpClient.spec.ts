import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpClient, httpEvents, ApiError } from './httpClient';
import { authStorage } from './authStorage';
import { apiKeyStorage } from './apiKeyStorage';

function fakeResponse(overrides: {
  status: number;
  ok: boolean;
  headers?: Record<string, string>;
  json?: () => Promise<unknown>;
}): Response {
  const headerMap = overrides.headers ?? {};
  return {
    status: overrides.status,
    ok: overrides.ok,
    headers: { get: (key: string) => headerMap[key] ?? null },
    json: overrides.json ?? (() => Promise.resolve({})),
  } as unknown as Response;
}

describe('httpClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('GET no agrega header Authorization si no hay token guardado', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeResponse({ status: 200, ok: true, json: () => Promise.resolve({ ok: 1 }) }),
    );

    const result = await httpClient.get<{ ok: number }>('/foo');

    expect(result).toEqual({ ok: 1 });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe('GET');
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('POST agrega el header Authorization con el token guardado', async () => {
    authStorage.setToken('jwt-abc');
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeResponse({ status: 200, ok: true, json: () => Promise.resolve({ id: 1 }) }),
    );

    await httpClient.post('/auth/api-key', { foo: 'bar' });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/auth/api-key');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ foo: 'bar' }));
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer jwt-abc');
  });

  it('GET con useApiKey: true usa el header X-Api-Key de apiKeyStorage', async () => {
    apiKeyStorage.setApiKey('test-api-key-xyz');
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeResponse({ status: 200, ok: true, json: () => Promise.resolve({ data: [] }) }),
    );

    await httpClient.get('/players', { useApiKey: true });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-Api-Key']).toBe('test-api-key-xyz');
    expect(headers.Authorization).toBeUndefined();
  });

  it('ante un 401 con useApiKey: true limpia la apiKey y emite apiKeyUnauthorized', async () => {
    apiKeyStorage.setApiKey('api-key-invalida');
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse({ status: 401, ok: false }));

    const handler = vi.fn();
    httpEvents.addEventListener('apiKeyUnauthorized', handler);

    await expect(httpClient.get('/players', { useApiKey: true })).rejects.toMatchObject({
      statusCode: 401,
      message: 'ApiKey no válida o expirada.',
    });

    expect(apiKeyStorage.getApiKey()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);

    httpEvents.removeEventListener('apiKeyUnauthorized', handler);
  });

  it('ante un 401 sin useApiKey limpia el token JWT y emite el evento unauthorized', async () => {
    authStorage.setToken('jwt-vencido');
    vi.mocked(fetch).mockResolvedValueOnce(fakeResponse({ status: 401, ok: false }));

    const handler = vi.fn();
    httpEvents.addEventListener('unauthorized', handler);

    await expect(httpClient.get('/private')).rejects.toMatchObject({
      statusCode: 401,
      message: 'No autorizado.',
    });
    expect(authStorage.getToken()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);

    httpEvents.removeEventListener('unauthorized', handler);
  });

  it('ante un error con body parseable, propaga statusCode y message del backend', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeResponse({
        status: 409,
        ok: false,
        json: () => Promise.resolve({ statusCode: 409, message: 'Email ya en uso' }),
      }),
    );

    await expect(httpClient.post('/auth/register', {})).rejects.toEqual(
      new ApiError(409, 'Email ya en uso'),
    );
  });

  it('ante un error con body no parseable, usa el status y un mensaje genérico', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeResponse({
        status: 500,
        ok: false,
        json: () => Promise.reject(new Error('body no es JSON')),
      }),
    );

    await expect(httpClient.get('/roto')).rejects.toEqual(
      new ApiError(500, 'Error inesperado.'),
    );
  });

  it('con 204 No Content devuelve undefined sin parsear el body', async () => {
    const jsonSpy = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeResponse({ status: 204, ok: true, json: jsonSpy }),
    );

    const result = await httpClient.post('/auth/logout', {});

    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('con content-length 0 devuelve undefined aunque el status no sea 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      fakeResponse({ status: 200, ok: true, headers: { 'content-length': '0' } }),
    );

    const result = await httpClient.get('/vacio');

    expect(result).toBeUndefined();
  });
});
