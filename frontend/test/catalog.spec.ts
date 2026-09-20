/**
 * T022 — Test de integración de Catálogo contra el backend real.
 * Ejecutar con: pnpm test:integration
 */
import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.VITE_TEST_API_URL ?? 'http://localhost:3001';

async function apiGet(path: string, apiKey?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (apiKey) headers['X-Api-Key'] = apiKey;

  return fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers,
  });
}

async function apiPost(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('Catálogo de Jugadores — integración contra backend real', () => {
  const uniqueEmail = `catalog-test-${Date.now()}-${Math.random().toString(36).slice(2)}@mail.com`;
  const password = 'Password123!';
  let apiKey: string;
  let oldApiKey: string;

  beforeAll(async () => {
    // Generar ApiKey para las pruebas
    await apiPost('/auth/register', { email: uniqueEmail, password });
    const loginRes = await apiPost('/auth/login', { email: uniqueEmail, password });
    const { accessToken } = (await loginRes.json()) as { accessToken: string };

    const apiKeyRes = await apiPost('/auth/api-key', {}, accessToken);
    const body = (await apiKeyRes.json()) as { apiKey: string };
    apiKey = body.apiKey;
  });

  it('GET /players sin header X-Api-Key devuelve 401 No Autorizado', async () => {
    const res = await apiGet('/players');
    expect(res.status).toBe(401);
  });

  it('GET /players con X-Api-Key válida devuelve 200 y estructura de paginación', async () => {
    const res = await apiGet('/players', apiKey);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: Array<{ id: string; name: string; league: string; team: string; position: string }>;
      meta: { total: number; page: number; pageSize: number; totalPages: number };
    };

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toHaveProperty('total');
    expect(body.meta).toHaveProperty('page');
    expect(body.meta).toHaveProperty('pageSize');
  });

  it('GET /players con filtro de equipo sin coincidencias devuelve 200 con lista vacía', async () => {
    const res = await apiGet('/players?team=EquipoInexistenteXZY999', apiKey);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toEqual([]);
  });

  it('GET /players/:id con ID inexistente devuelve 404 y mensaje en el body', async () => {
    const res = await apiGet('/players/id-inexistente-123456789', apiKey);
    expect(res.status).toBe(404);

    const body = (await res.json()) as { statusCode: number; message: string };
    expect(body.statusCode).toBe(404);
    expect(body.message).toBeTruthy();
  });

  it('re-generar ApiKey invalida la clave previa devolviendo 401 para la clave antigua', async () => {
    oldApiKey = apiKey;

    // Obtener JWT nuevamente
    const loginRes = await apiPost('/auth/login', { email: uniqueEmail, password });
    const { accessToken } = (await loginRes.json()) as { accessToken: string };

    // Generar nueva clave
    await apiPost('/auth/api-key', {}, accessToken);

    // Intentar consultar con la clave previa
    const res = await apiGet('/players', oldApiKey);
    expect(res.status).toBe(401);
  });
});

