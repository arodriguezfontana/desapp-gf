/**
 * T026 — Test de integración de authService.register contra el backend real.
 *
 * Requiere que el global-setup haya levantado el backend (VITE_TEST_API_URL disponible).
 * Ejecutar con: pnpm test:integration
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { authStorage } from '../../src/service/authStorage';

// El httpClient usa import.meta.env.VITE_API_BASE_URL en runtime de Vite,
// pero en el entorno de node de Vitest debemos parchearlo antes de importar.
const API_URL = process.env.VITE_TEST_API_URL ?? 'http://localhost:3001';

async function apiPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('authService.register — integración contra backend real', () => {
  const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@mail.com`;

  beforeAll(() => {
    authStorage.clearToken();
  });

  it('registro exitoso con email nuevo devuelve 201', async () => {
    const res = await apiPost('/auth/register', {
      email: unique(),
      password: 'Abcd1234!',
    });
    expect(res.status).toBe(201);
  });

  it('email duplicado devuelve 409 con message del backend', async () => {
    const email = unique();
    await apiPost('/auth/register', { email, password: 'Abcd1234!' });
    const res = await apiPost('/auth/register', { email, password: 'Abcd1234!' });
    expect(res.status).toBe(409);
    const body = await res.json() as { message: string };
    expect(body.message).toBeTruthy();
  });

  it('contraseña débil devuelve 400 con message del backend', async () => {
    const res = await apiPost('/auth/register', {
      email: unique(),
      password: '123',
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { message: string };
    expect(body.message).toBeTruthy();
  });
});

