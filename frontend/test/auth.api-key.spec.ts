/**
 * T040 — Test de integración de authService.generateApiKey contra el backend real.
 * Ejecutar con: pnpm test:integration
 */
import { describe, it, expect } from 'vitest';

const API_URL = process.env.VITE_TEST_API_URL ?? 'http://localhost:3001';

async function apiPost(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('authService.generateApiKey — integración contra backend real', () => {
  const uniqueEmail = `apikey-test-${Date.now()}-${Math.random().toString(36).slice(2)}@mail.com`;
  const password = 'Password123!';
  let jwt: string;

  it('generateApiKey sin JWT devuelve 401', async () => {
    const res = await apiPost('/auth/api-key', {});
    expect(res.status).toBe(401);
  });

  it('generateApiKey con JWT válido devuelve DTO con apiKey pmk_', async () => {
    // 1. Registro
    await apiPost('/auth/register', { email: uniqueEmail, password });

    // 2. Login para obtener JWT
    const loginRes = await apiPost('/auth/login', { email: uniqueEmail, password });
    const loginBody = (await loginRes.json()) as { accessToken: string };
    jwt = loginBody.accessToken;

    // 3. Generar ApiKey
    const apiKeyRes = await apiPost('/auth/api-key', {}, jwt);
    expect(apiKeyRes.status).toBe(201);
    const body = (await apiKeyRes.json()) as { id: string; apiKey: string; createdAt: string };
    expect(body.id).toBeTruthy();
    expect(body.apiKey).toMatch(/^pmk_[0-9a-f]{64}$/);
    expect(body.createdAt).toBeTruthy();
  });

  it('un segundo generateApiKey invalida la clave previa y devuelve una nueva', async () => {
    const secondRes = await apiPost('/auth/api-key', {}, jwt);
    expect(secondRes.status).toBe(201);
    const body = (await secondRes.json()) as { id: string; apiKey: string };
    expect(body.apiKey).toMatch(/^pmk_[0-9a-f]{64}$/);
  });
});

